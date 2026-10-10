# Database

PostgreSQL on Supabase. All schema lives in `supabase/migrations/` (applied in filename order). UUID primary keys everywhere except append-only logs. Money is stored as integer minor units (`*_minor`, e.g. paise) next to an ISO-4217 `currency`.

## Migrations

| File | Contents |
| --- | --- |
| `…000100_foundation.sql` | Enums, helpers (`set_updated_at`, `slugify`, `is_direct_user_request`), `profiles`, `user_roles`, `user_settings`, `admin_actions`, role helpers (`has_role`, `is_admin`, `current_user_is_active`) |
| `…000200_catalog.sql` | `categories`, `skills`, `specialist_profiles`, `specialist_skills`, `specialist_categories`, `portfolio_items`, `services`, `verification_requests`, new-user trigger, `become_specialist`, `submit_verification_request` |
| `…000300_requirements.sql` | `requirements`, `requirement_skills`, `requirement_attachments`, `requirement_matches`, `requirement_invitations`, `offers` + their rules |
| `…000400_orders.sql` | `platform_settings`, `orders`, `payments`, `refunds`, `payment_webhook_events`, `order_transitions`, `order_events`, `order_submissions`, `order_deliverables`, `disputes`, `dispute_attachments`, transition engine and order RPCs |
| `…000500_payments.sql` | Service-role-only payment/refund functions, `admin_mark_payout` |
| `…000600_engagement.sql` | `conversations`, `conversation_participants`, `messages`, `reports`, `reviews`, `saved_specialists`, `notifications`, `analytics_events`, notification triggers, reputation function |
| `…000700_discovery_admin.sql` | `search_services`, `search_specialists`, `get_match_candidates`, admin functions and metrics |
| `…000800_storage.sql` | Buckets and storage object policies |
| `…000900_reference_data.sql` | Initial categories and skills (real configuration, not sample data) |
| `…001000_api_grants.sql` | Restricts which functions anonymous visitors may execute |
| `…001100_messaging_outbox_contact.sql` | Inbox RPC, email outbox, `contact_messages` |
| `…001200_requirement_match_timestamp.sql` | `requirements.matches_computed_at` |
| `…20261010000100_account_status_deleted.sql` | `deleted` value for `account_status` (separate file: a new enum value can't be used in the transaction that adds it) |
| `…20261010000200_account_deletion.sql` | `account_deletion_blocker`, `delete_my_account`, deleted profiles readable as "Deleted user", admins can't revive deleted accounts |
| `…20261010000300_enquiries.sql` | Pre-order chats: `conversations.kind` (`order`/`enquiry`), `buyer_id`, `specialist_id`, `service_id`; `start_enquiry`; enquiries text-only; order note in the pair's enquiry; inbox includes enquiries |

**Applying migrations**

- Local: `npm run db:reset` (drops and recreates the local database, then runs `supabase/seed.sql`, which is intentionally empty).
- Hosted: `npx supabase link --project-ref <ref>` then `npx supabase db push`. See DEPLOYMENT.md.
- New changes: always add a new timestamped migration; never edit one that has been applied to a shared environment.
- After schema changes: `npm run db:types` to regenerate `src/lib/supabase/database.types.ts`, and `npm run db:lint`.

## Entity relationships

```
auth.users 1─1 profiles 1─* user_roles
                 │ 1─1 user_settings (private)
                 │ 1─0..1 specialist_profiles ─* specialist_skills *─1 skills *─1 categories (self-parent)
                 │                             ─* specialist_categories, portfolio_items, services, verification_requests
                 │
requirements (buyer) ─* requirement_skills, requirement_attachments, requirement_matches (private), requirement_invitations, offers (specialist)
                 │
orders ── from services (Mode A) or offers+requirements (Mode B)
   ├─* payments ─* refunds          ├─ order_events (append-only)
   ├─* order_submissions ─* order_deliverables
   ├─* disputes ─* dispute_attachments
   ├─1 conversations ─* conversation_participants, messages
   └─* reviews (one per reviewer per order)
notifications, saved_specialists, reports, analytics_events, contact_messages, admin_actions, payment_webhook_events
```

## Key tables

| Table | Notes |
| --- | --- |
| `profiles` | Public identity only (no email/phone). `account_status` and `is_sample` are trigger-protected. |
| `user_roles` | `buyer`, `specialist`, `admin`; unique per user/role. Users may insert buyer/specialist for themselves only. |
| `specialist_profiles` | `verification_status`, `rating_avg`, `rating_count`, `completed_orders_count` are trigger-protected. Publication requires headline ≥10 chars, bio ≥50, experience level and ≥1 skill. |
| `services` | `slug` generated from title; `removed` is moderation-only; deletion is blocked once ordered (FK `restrict`). |
| `requirements` | `draft` → `open` → `hired`/`closed`. A CHECK constraint enforces completeness outside draft. `hired` only via `accept_offer`. |
| `requirement_matches` | Shortlist with internal score and buyer-facing reasons; visible to the owner only. |
| `requirement_invitations` / `offers` | Max 10 invitations per requirement; only invited specialists can offer; one pending offer per specialist; one accepted offer per requirement. |
| `orders` | Immutable `scope_snapshot`; `price_minor`, `buyer_fee_minor`, `specialist_fee_minor`, generated `total_minor`; `revisions_used ≤ revisions_included`; must originate from a service or an offer. No direct user writes. |
| `order_events` | Append-only history; no user INSERT/UPDATE/DELETE grants. |
| `payments` | One row per attempt; unique `(provider, provider_order_id)`; written only by the service role. |
| `payment_webhook_events` | Unique `(provider, provider_event_id)` gives webhook idempotency. No raw payloads stored. |
| `reviews` | One per reviewer per order; insert only when the order is completed and reviewer/reviewee are its two parties; immutable. `reviewee_role` set by trigger. |
| `notifications` | Created by triggers; users can only mark as read via RPC. `emailed_at` is the email outbox marker. |

## Cached aggregates

`specialist_profiles.rating_avg`/`rating_count` are refreshed by the `reviews_after_insert` trigger (only reviews of the specialist side count). `completed_orders_count` is refreshed when an order becomes `completed`. They exist so discovery can filter/sort by rating cheaply; everything else (on-time rate, repeat clients, cancellation rate) is derived on demand by `get_specialist_reputation()`.

## Important functions (RPC)

| Function | Caller | Purpose |
| --- | --- | --- |
| `create_service_order(service, brief)` | buyer | Mode A order with server-side price/scope snapshot |
| `accept_offer(offer)` / `decline_offer(offer)` | requirement owner | Mode B order creation |
| `perform_order_action(order, action, note)` | participant | accept, decline, submit, request_revision, approve, cancel |
| `open_dispute(order, reason, description)` | participant | Moves order to `disputed` |
| `resolve_dispute(dispute, outcome, resolution)` | admin | Complete, refund or resume |
| `apply_payment_success/failure`, `apply_refund_success/failure`, `mark_refund_processing` | **service role only** | Payment state from verified provider responses |
| `get_match_candidates(requirement)` | requirement owner | Candidate data for the matching engine |
| `search_services`, `search_specialists` | anyone | Discovery with filters and pagination (RLS applies) |
| `get_specialist_reputation(specialist)` | anyone | Aggregates only |
| `admin_*` | admin | Metrics, user search/suspension, verification, moderation, reports, payouts |
| `start_enquiry(specialist, service?)` | signed-in user | Opens (or reuses) the one pre-order chat between the caller and a published specialist, optionally about one of their gigs. Max 20 new enquiries per buyer per day; no self-messaging. |
| `account_deletion_blocker()` / `delete_my_account(confirmation)` | signed-in user | Self-service deletion. Blocked while orders are in progress, disputed or a payout is owed. Without order history the auth user is deleted (everything cascades); with history the account is anonymised ("Deleted user", login and personal data removed, email freed) so the other party keeps the order, messages and reviews. Unpaid orders are cancelled. |

## RLS summary

- Public read: active categories/skills, active and deleted (anonymised) profiles, published specialist profiles and their skills/portfolio/services, reviews, platform settings.
- Owner only: user settings, requirements (plus invited specialists), requirement matches, saved specialists, notifications.
- Participants only: orders and everything attached (events, submissions, deliverables — drafts only for the specialist — disputes, conversations, messages, payments for the buyer), and pre-order enquiry conversations (created only through `start_enquiry`).
- Admins: read everything needed for moderation; writes through audited functions.
- Storage: see `…000800_storage.sql` — owner folders for public buckets; requirement and order participants for private buckets; deliverable uploads only by the assigned specialist while work is in progress.
