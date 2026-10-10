# Testing

Three layers, all runnable locally and in CI (`.github/workflows/ci.yml`).

| Layer | Command | Needs | What it proves |
| --- | --- | --- | --- |
| Unit | `npm test` | Nothing | Pure business logic: money, fees, order state machine, matching, file validation, filters, dates, payment signatures, webhook idempotency |
| Integration | `npm run test:integration` | Local Supabase | RLS, grants and database functions behave as designed when called the way the app (or an attacker) would call them |
| End-to-end | `npm run test:e2e` | Local Supabase + seed | Real user journeys through the browser, accessibility (axe) and mobile layout |

Plus static checks: `npm run lint`, `npm run typecheck`, `npm run db:lint` (Postgres function linter) and `npm run build`.

## Safety

- Integration and e2e tests **refuse to run against a non-local Supabase URL** (`tests/support/supabase.ts`). They create real users and orders.
- `npm run seed:dev` refuses `NODE_ENV=production` and non-local URLs unless `ALLOW_REMOTE_DEV_SEED=true`.
- No test needs real payment, email or storage credentials: payments use the development adapter, emails go to the local Mailpit inbox.

## Running everything locally

```bash
npm run db:start          # first time: downloads the Supabase images
npm run db:reset          # fresh schema (optional, wipes local data)
npm run seed:dev          # e2e access-control checks use seeded orders
npm test
npm run test:integration
npm run test:e2e          # starts `next dev` on E2E_PORT (default 3000) or reuses a running server
```

`.env.local` must contain the local stack's URL, anon key and service-role key (`npx supabase status`), `PAYMENT_PROVIDER=dev` and a `DEV_PAYMENTS_SECRET`. Useful variants:

```bash
npx playwright test --project=desktop            # journeys + accessibility
npx playwright test --project=mobile             # Pixel 7 layout checks
npx playwright test tests/e2e/auth.spec.ts --ui  # debug one spec
VITEST_INTEGRATION=1 npx vitest run tests/integration/payments-webhook.test.ts
```

## Coverage against the MVP requirements

### Authentication
| Requirement | Test |
| --- | --- |
| Registration | e2e `marketplace.spec.ts` (buyer and specialist sign-up), integration `accounts-and-roles` (profile/role bootstrap) |
| Login, wrong password | e2e `auth.spec.ts` |
| Logout | e2e `auth.spec.ts` (account menu), `responsive.spec.ts` (mobile menu) |
| Password recovery | e2e `auth.spec.ts` — requests a reset, follows the emailed link from Mailpit, sets a new password, old password rejected |
| Account deletion | integration `account-deletion` (confirmation sentence, erase vs anonymise, blocked by active orders and pending payouts, unpaid orders cancelled, email reusable, admins), e2e `account-deletion.spec.ts` (buyer and specialist through the dialog, blocked state) |
| Protected routes | e2e `access-control.spec.ts`, `auth.spec.ts` (redirect to login and back to the requested page) |

### Roles and permissions
| Requirement | Test |
| --- | --- |
| Buyer can't see another buyer's requirements | integration `requirements-offers` ("keeps requirements private to their owner") |
| Specialist can't modify another's services | integration `catalogue` |
| Non-admin can't use admin functions | integration `accounts-and-roles`, e2e `access-control.spec.ts` (404) |
| Can't self-assign admin (incl. via sign-up metadata) | integration `accounts-and-roles` |
| Can't edit own account status / verification / reputation | integration `accounts-and-roles` |

### Requirements
Creation, required-field validation (database constraints), drafts, editing, ownership and "hired" status protection: integration `requirements-offers`; full wizard: e2e `marketplace.spec.ts`.

### Matching
Unit `matching-engine.test.ts`: skill overlap, mandatory vs optional skills, category preference, budget compatibility (and no points when no comparable price exists), availability (unavailable excluded, busy excluded only for urgent tasks, busy scored lower), delivery time vs deadline (unknown delivery time never excludes), **new specialists without reviews are not excluded and still score strongly**, no reliability points without enough history, 0–100 normalisation, custom weights, deterministic ranking and tie-breaking by completed work. Candidate access (owner only): integration `requirements-offers`. Candidate selection by category/subcategory happens in SQL (`get_match_candidates`) and is exercised by the e2e requirement journey rather than a dedicated test.

### Orders
| Requirement | Test |
| --- | --- |
| Valid creation with server-side price snapshot | integration `order-lifecycle` |
| Invalid transitions rejected | unit `order-state-machine`, integration `order-lifecycle`; `order-transitions` fails if the TS and database transition tables ever differ |
| Only participants can access | integration `order-lifecycle`, e2e `access-control.spec.ts` |
| Submission and revision flow, revision limit | integration `order-lifecycle`, e2e `marketplace.spec.ts` |
| Approval / completion / history | integration `order-lifecycle` (append-only events, no history rewriting) |
| Refunds and disputes | integration `order-lifecycle`, e2e `admin.spec.ts` |

### Payments
Unit `payments.test.ts`: Razorpay checkout signature verification, webhook signature verification, API request shape, dev adapter, processor idempotency/duplicates/failures. Integration `payments-webhook` and `order-lifecycle`: forged/unsigned webhooks rejected without side effects, valid webhook applied exactly once, duplicate success idempotent, unknown payments acknowledged, users can't call `apply_payment_success` or write `payments`.

### Messaging and files
Integration `messaging-files`: participants only, no sender spoofing or system messages, notifications, private order files, deliverable upload rules, bucket MIME restrictions, own avatar folder only. Unit `file-validation`: magic-byte sniffing, extension/MIME/size rules, safe file names. E2e `access-control.spec.ts`: signed download URL refused for non-participants.

### Pre-order chat
Integration `enquiries`: one chat per buyer and specialist, no self-messaging or unpublished specialists or other people's gigs, hidden from the specialist until the buyer writes, participants only, notifications name the gig, text only, order note without a notification, daily limit, removed with a deleted account. E2e `marketplace.spec.ts` (journey 3).

### Reviews
Integration `order-lifecycle` (participants of completed orders only, once each, not before completion); e2e `marketplace.spec.ts` (one review per order, then "Hire again").

### End-to-end journeys (`tests/e2e/`)
| # | Journey | Spec |
| --- | --- | --- |
| 1 | Buyer registers and publishes a requirement | `marketplace.spec.ts` |
| 2 | Specialist creates a profile and publishes a service | `marketplace.spec.ts` |
| 3 | Buyer browses a predefined service, chats with the specialist first, then orders it from the chat and pays | `marketplace.spec.ts` |
| 4 | Buyer posts a custom requirement and selects an offer | `marketplace.spec.ts` |
| 5 | Specialist submits deliverables, buyer approves | `marketplace.spec.ts` |
| 6 | Buyer requests a revision | `marketplace.spec.ts` |
| 7 | Completed order accepts an eligible review | `marketplace.spec.ts` |
| 8 | Buyer initiates a repeat hire | `marketplace.spec.ts` |
| 9 | Unauthorised user denied private data | `access-control.spec.ts` |
| + | Admin: verification, dispute resolution, refund | `admin.spec.ts` |
| + | Auth: logout, login redirect, password recovery | `auth.spec.ts` |

### Accessibility and responsiveness
- `accessibility.spec.ts` runs axe (WCAG 2.0/2.1 A and AA) on the public pages and the main buyer dashboard pages and fails on any violation.
- `responsive.spec.ts` (Pixel 7) checks for horizontal overflow on public pages, the mobile menu (navigation and logout) and collapsible gig filters.

## Not automated (check manually before launch)

- Razorpay test-mode checkout, a failed payment, a refund and a webhook redelivery (see PAYMENTS.md). The adapter is unit-tested against mocked HTTP only.
- Email delivery through your real provider (Resend) and the dispatch schedule.
- Realtime chat between two real browsers on a deployed environment.
- Auth emails from your production SMTP and your Supabase email templates.
- Screen-reader walkthroughs (axe catches a subset of accessibility issues).

## Troubleshooting

- **Styles look stale after editing CSS tokens:** stop the dev server, `rm -rf .next/dev`, start again.
- **"Integration tests only run against a local Supabase instance":** `.env.local` points at a hosted project; use the local values from `npx supabase status`.
- **Sign-ups start failing during long runs:** local Auth rate limits (`[auth.rate_limit]` in `supabase/config.toml`) reset after five minutes.
- **The access-control order check is skipped:** run `npm run seed:dev` (or the marketplace spec) first so an order exists.
