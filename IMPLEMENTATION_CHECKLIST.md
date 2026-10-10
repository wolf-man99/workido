# Implementation checklist

Status of the Workido MVP against the product and engineering brief. `[x]` = implemented and verified by tests or a manual run; `[~]` = implemented with a documented simplification; `[ ]` = not implemented (see [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)).

_Last updated: 2026-10-09._

## Latest verification

| Check | Result |
| --- | --- |
| `npm run lint` | Clean |
| `npm run typecheck` | Clean |
| `npm test` (unit) | 70 passed, 7 files |
| `npm run test:integration` (local Supabase) | 56 passed, 7 files |
| `npx playwright test` (desktop + mobile) | 32 passed |
| `npm run db:lint` | No schema errors |
| `next build` | Succeeds, no warnings |

Hosted Supabase project `bquiwujcuynajxrxequh`: all 12 migrations applied via the SQL editor. A read-only check (public anon key) confirmed every table and column, the reference data (13 categories, 44 skills), all four storage buckets, public search functions working, and payment/admin/outbox functions refusing anonymous callers. The app was run against it and the public pages loaded with the real categories, correct empty states and real 404s. No accounts or data were created there.

## Phase 0 — Inspection and plan
- [x] Repository inspected (empty); stack chosen: Next.js 16 App Router, TypeScript strict, Tailwind v4, Radix, RHF + Zod, Supabase
- [x] Directory structure (`src/app`, `src/components`, `src/lib/{domain,actions,data,payments,notifications,storage,validation}`, `supabase/migrations`, `tests/`)
- [x] Missing credentials and external dependencies identified (KNOWN_LIMITATIONS.md)

## Phase 1 — Foundation and visual system
- [x] Brand tokens (#FF6B35, #171717, #FFFDF8, #FFD166, #35C98A, #F1F2F4), Space Grotesk + Inter, accessible text variants
- [x] UI primitives: buttons, inputs, selects, checkboxes, cards, badges, alerts, skeletons, empty states, dialogs, sheets, menus, pagination, avatars
- [x] Public layout, responsive header with mobile menu, footer (social links only when configured)
- [x] Homepage, category cards, service cards, specialist cards
- [x] Authentication screens (login, sign-up with role choice, forgot/reset password)
- [x] Loading, error and not-found states
- [x] No hard-coded tagline (`NEXT_PUBLIC_BRAND_TAGLINE`, empty by default)

## Phase 2 — Authentication and database
- [x] Supabase clients (browser, server with cookies, service role server-only), `proxy.ts` session refresh and route protection
- [x] 12 ordered migrations with constraints, indexes, triggers, RLS on every table
- [x] Profiles, settings, multi-role model (buyer, specialist, admin); admin never grantable at sign-up or by users
- [x] Sign-up, login, logout, password recovery, email confirmation callback (PKCE and token-hash)
- [x] Profile and account settings editing, avatar upload
- [x] Self-service account deletion for buyers and specialists (typed confirmation "Delete my Workido account"; erased without order history, anonymised with it; blocked while orders or payouts are open)
- [x] Development seed with clearly labelled sample data and production/remote guards
- [x] Integration tests for role escalation, profile protection, private settings

## Phase 3 — Specialist marketplace
- [x] Specialist onboarding: headline, bio, skills, categories, experience level and years, location, website
- [x] Portfolio (uploads with magic-byte validation, external links)
- [x] Services with fixed scope (description + deliverables), price, delivery time, revisions, buyer instructions; draft/publish; admin moderation
- [x] Availability (available / busy / unavailable)
- [x] Gig and specialist discovery with search, category, skill, price, delivery time, rating, availability and experience filters, sorting, pagination
- [x] Public specialist profiles and gig pages with metrics only from completed orders ("Not enough data yet" otherwise)
- [x] Category pages
- [~] Search is substring (`ILIKE`) based, no full-text ranking
- [ ] Service FAQ and image gallery, specialist languages, review replies

## Phase 4 — Requirements and matching
- [x] Multi-step requirement wizard with validation, drafts, attachments, editing, closing
- [x] Deterministic matching engine with documented weights, eligibility rules and reasons (docs/MATCHING.md)
- [x] New specialists not excluded for lacking reviews; reliability only with enough history
- [x] Shortlist with qualitative labels and reasons; "Find matches"/"Refresh"
- [x] Invitations, specialist opportunities inbox, offers (price, delivery, revisions, message), decline
- [x] Offer comparison and acceptance (creates the order; other offers closed)
- [ ] Re-matching when new specialists join; public requirement board

## Phase 5 — Orders and delivery
- [x] Orders from gigs and accepted offers with server-side price and scope snapshots
- [x] Explicit state machine mirrored in TS and SQL with a parity test (docs/ORDERS.md)
- [~] Accepted + in progress merged; approved + completed merged
- [x] Order detail with timeline, checkout panel, role-specific actions
- [x] Order-scoped realtime messaging with attachments and notifications
- [x] Private file uploads (progress, server-side type inspection), signed short-lived downloads
- [x] Deliverable submission (files + links, versioned), revisions within the included limit, approval, completion
- [x] Append-only order event history
- [x] Disputes (open, admin resolve: complete / refund / resume)
- [ ] Auto-approval, auto-cancellation, overdue reminders (need a scheduler)

## Phase 6 — Payments
- [x] Provider interface; Razorpay adapter (REST + HMAC); development adapter labelled "Test mode — no real money"
- [x] Server-side amount, checkout signature verification, payment ↔ order ↔ buyer checks
- [x] Webhook endpoint with raw-body signature verification and per-event idempotency
- [x] Failure states and retry, late/duplicate payment → automatic refund record
- [x] Refund tracking (pending → processing → succeeded/failed) via provider API; manual payout records
- [x] No client path can mark an order paid (integration-tested)
- [ ] Live Razorpay credentials (external), escrow/split settlement (requires provider product and legal review)

## Phase 7 — Reputation, repeat hiring, administration
- [x] Reviews only for participants of completed orders, once per side (buyer and specialist)
- [x] Reputation metrics from real orders (rating, completed orders, on-time rate, repeat clients) with minimum samples
- [x] Repeat hiring: "Hire again" (direct gig or prefilled requirement inviting the specialist), saved specialists
- [x] Admin panel: metrics (GTV vs platform revenue), users and suspension, verification queue, listing moderation, categories, orders, disputes, refunds and payouts, reports, contact inbox; all actions audit-logged
- [x] Notifications: in-app via database triggers, email outbox + dispatcher (Resend or dev log), WhatsApp integration point
- [x] Analytics events stored in `analytics_events`

## Phase 8 — Quality and deployment
- [x] Unit, integration and end-to-end suites (docs/TESTING.md), including all nine required journeys
- [x] Accessibility: axe WCAG A/AA checks on public and dashboard pages
- [x] Responsive: mobile overflow, mobile navigation and logout, collapsible filters
- [x] Security review: RLS and function grants tested; security headers; secrets server-only; upload validation; webhook verification
- [x] Error handling: friendly action errors (no raw database messages), error boundaries, not-found pages with real 404s on public pages
- [x] Production build
- [x] CI workflow (`.github/workflows/ci.yml`): lint, types, unit, build; database integration + e2e on a local Supabase stack
- [x] Documentation: README, architecture, database, environment, deployment, payments, orders, matching, testing, known limitations

## Configuration required (outside the code)

1. ~~Apply migrations to the hosted project~~ Done (SQL editor). Run new migration files the same way, or run `supabase migration repair` once before switching to `supabase db push` (see DEPLOYMENT.md).
2. Set environment variables in hosting: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Configure Supabase Auth: Site URL, redirect URL `/auth/callback`, custom SMTP, optionally token-hash email templates.
4. Grant the first admin with SQL.
5. Payments: Razorpay KYC, keys and webhook (or `PAYMENT_PROVIDER=dev` for a private test deployment).
6. Emails: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` and a schedule for `/api/notifications/dispatch`.
7. Legal review of Terms, Privacy Policy and the payment/payout model before taking real money.

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md), [docs/PAYMENTS.md](docs/PAYMENTS.md).
