# Architecture

## Overview

```
Browser ──► Next.js (App Router, Node runtime)
              │  Server Components: read data as the signed-in user (RLS applies)
              │  Server Actions:    validate (Zod) → authorise → call Postgres
              │  Route handlers:    /api/files (signed downloads), /api/payments/webhook/[provider],
              │                     /api/notifications/dispatch (cron)
              ▼
           Supabase
              ├─ Postgres: tables + RLS + SECURITY DEFINER business functions + triggers
              ├─ Auth: email/password, email confirmation, password recovery
              ├─ Storage: public (avatars, portfolio) and private (requirement-files, order-files) buckets
              └─ Realtime: messages and notifications (RLS-enforced)
```

## Principles applied in code

- **The database is the security boundary.** The anon/publishable key is public and every signed-in user holds a JWT, so anyone can call the Data API directly. Every table therefore has Row Level Security, and every multi-party or privileged change (orders, payments, offers, disputes, admin actions) goes through a `SECURITY DEFINER` function that checks `auth.uid()`, roles and current state itself. Server actions add validation and friendly errors on top, but are not relied on for security.
- **Business rules live in one place per concern.**
  - Order transitions: `src/lib/domain/orders/state-machine.ts` (TypeScript) mirrored by `public.order_transitions` (database). An integration test fails if they ever differ.
  - Matching: `src/lib/domain/matching/engine.ts` (pure, unit-tested). The database only supplies candidate data.
  - Money: `src/lib/domain/money.ts` (integer minor units, BigInt fee maths) mirrored by `public.calculate_fee_minor`.
- **Columns users must never change** (verification status, cached ratings, account status, moderation notes) are protected by triggers that reject direct user writes; only definer functions and the service role can change them.
- **The service-role key is used only where no user session exists or trust is required:** payment verification/webhooks, refunds, and the email outbox. It lives in `src/lib/supabase/admin.ts`, which is `server-only`.

## Rendering model

`cacheComponents` / Partial Prefetching are **disabled** (`next.config.ts`). Almost every page depends on the signed-in user's session (header, dashboards), and the classic dynamic rendering model keeps the Supabase SSR auth flow simple and predictable. Revisit when public pages need static caching: they would need the session-dependent header moved behind a Suspense boundary.

`src/proxy.ts` (Next 16's replacement for middleware) refreshes the Supabase session cookie on each request and redirects signed-out visitors away from `/dashboard` and `/admin`. It is a convenience; pages and actions re-check the user.

## Module boundaries

| Layer | Location | Notes |
| --- | --- | --- |
| UI primitives | `src/components/ui` | Accessible, brand-token based (Radix where needed) |
| Feature components | `src/components/{marketplace,orders,messages,admin,forms}` | Client components only where interactive |
| Pages | `src/app/**` | Server Components by default |
| Server actions | `src/lib/actions/*` | Return `ActionResult` (`ok` / `fail` with field errors) |
| Data access | `src/lib/data/*` | Read-only queries with the user's client |
| Domain logic | `src/lib/domain/*` | Pure functions, no I/O |
| Integrations | `src/lib/payments`, `src/lib/notifications`, `src/lib/storage` | Provider interfaces + adapters |
| Validation | `src/lib/validation/*` | Zod schemas shared by client forms and server actions |

## Authentication & authorisation

- Sign-up collects name, email, password and an initial role. The `handle_new_user` trigger creates the profile, private settings and the role. Only `buyer` or `specialist` can be requested; admin is granted out-of-band (see DEPLOYMENT.md).
- Users can hold both buyer and specialist capabilities. Placing an order or posting a task grants the buyer role automatically.
- `getCurrentUser()` (`src/lib/auth/session.ts`) verifies the JWT with `auth.getClaims()` and loads profile + roles once per request.
- Suspended accounts can sign in and read their history but every write path checks `current_user_is_active()`.
- Admin pages return 404 to non-admins (`requireAdmin`), and every admin function re-checks `is_admin()` in the database and writes `admin_actions`.

## Files

1. Browser validates type/size, then uploads directly to Storage (XHR with progress) using the user's JWT; storage RLS policies decide where the user may write (e.g. only the assigned specialist may write `order-files/<order>/deliverables/` while work is in progress).
2. A server action then inspects the stored object (size, declared type) and reads its first bytes to verify the file signature. Mismatches (e.g. HTML renamed to `.png`) are deleted. SVG/HTML are never accepted.
3. Private files are downloaded through `/api/files`, which creates a 60-second signed URL with the user's own session (so storage RLS decides) and forces `Content-Disposition: attachment`.

## Notifications

In-app notifications are written by database triggers (orders, offers, invitations, messages, reviews, verification, moderation), so they cannot be forged or forgotten. Email is an outbox: `/api/notifications/dispatch` (cron) sends emails for important types to users who opted in, then stamps `emailed_at`. WhatsApp is an explicit, disabled integration point (`src/lib/notifications/channels.ts`).

## Analytics

`src/lib/analytics/track.ts` records typed product events to `analytics_events` with a property sanitiser that drops anything resembling personal data. Forward events to an external tool from that one function if needed.
