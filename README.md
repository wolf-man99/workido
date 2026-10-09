# Workido

Workido is a two-sided marketplace for micro-gigs and small professional tasks. Buyers describe a task or buy a ready-made gig; skilled specialists get matched, deliver the work and build a reputation from real, completed orders.

This repository is a production-minded MVP: real accounts, a secured database, the complete order lifecycle, payments behind a provider abstraction, messaging, reviews, repeat hiring and an admin panel.

> **Brand note:** the Workido tagline has not been approved. Nothing in the app hard-codes one. Set `NEXT_PUBLIC_BRAND_TAGLINE` once a tagline is approved.

## What's in the box

| Area | Highlights |
| --- | --- |
| Buyers | Browse gigs and specialists with filters, buy a gig, post a custom task (multi-step, drafts, attachments), get a ranked shortlist with reasons, invite specialists, compare offers, pay, chat, review deliveries, request revisions, approve, review, hire again, save specialists |
| Specialists | Onboarding (skills, categories, experience), portfolio uploads and links, services with fixed scope/price/delivery/revisions, availability, verification requests, invitations and offers, accept/decline paid orders, deliver files and links |
| Trust | Ratings and metrics only from completed orders ("Not enough data yet" otherwise), admin-reviewed verification, disputes, abuse reports, clearly labelled sample data |
| Payments | Provider abstraction, Razorpay adapter (REST + HMAC), clearly labelled development adapter, server-side verification, idempotent webhooks, refunds via provider, manual payout records |
| Admin | Platform metrics (GTV vs revenue), users and suspension, verification queue, listing moderation, categories, orders, disputes, refunds and payouts, reports and support inbox — all audit-logged |
| Security | Row Level Security on every table, privileged changes only through database functions that authorise the caller, append-only order history, private files via short-lived signed URLs, magic-byte upload validation |

## Tech stack

Next.js 16 (App Router, TypeScript strict) · React 19 · Tailwind CSS v4 with Radix primitives · React Hook Form + Zod · Supabase (Postgres, Auth, Storage, Realtime) · Vitest · Playwright + axe-core.

## Quick start (local)

Requirements: Node.js 22+, Docker.

```bash
npm install
npm run db:start              # local Supabase stack (Postgres, Auth, Storage, Realtime, Mailpit)
cp .env.example .env.local    # then paste values from `npx supabase status`
npm run db:reset              # apply all migrations
npm run seed:dev              # optional: fictional sample users, gigs and orders
npm run dev                   # http://localhost:3000
```

For local development set `PAYMENT_PROVIDER=dev` and a long random `DEV_PAYMENTS_SECRET` so checkout works in test mode. Sample accounts created by the seed use the password `Workido-sample-2026` (e.g. `sample-buyer-nisha@sample.workido.test`, `sample-admin@sample.workido.test`). Local auth emails are captured by Mailpit at http://127.0.0.1:54324.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests (domain logic, payments, validation) |
| `npm run test:integration` | RLS/permission and lifecycle tests against the local database |
| `npm run test:e2e` | Playwright journeys, accessibility and mobile checks |
| `npm run db:start` / `db:stop` / `db:reset` / `db:lint` / `db:types` | Local Supabase helpers |
| `npm run seed:dev` | Development seed (refuses production and remote projects by default) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — structure, rendering model, security model
- [Database](docs/DATABASE.md) — schema, relationships, RLS, functions, migrations
- [Environment variables](docs/ENVIRONMENT.md)
- [Deployment](docs/DEPLOYMENT.md) — Supabase project setup and hosting (Vercel)
- [Payments](docs/PAYMENTS.md) — provider abstraction, Razorpay activation, webhooks, refunds, payouts
- [Order lifecycle](docs/ORDERS.md)
- [Matching engine](docs/MATCHING.md)
- [Testing](docs/TESTING.md)
- [Known limitations & external dependencies](docs/KNOWN_LIMITATIONS.md)
- [Implementation checklist](IMPLEMENTATION_CHECKLIST.md)

## Project structure

```
src/
  app/                 Routes: (site) public pages, (auth), dashboard/, admin/, api/
  components/          ui/ primitives, layout/, marketplace/, forms/, orders/, messages/, admin/
  lib/
    domain/            Pure business logic: money, order state machine, matching, reputation
    actions/           Server actions (validate → authorise → call database)
    data/              Server-side queries
    payments/          Provider interface, Razorpay + dev adapters, verification, webhooks
    notifications/     Email channel, outbox dispatcher, WhatsApp integration point
    storage/           Upload validation, signed downloads
    supabase/          Clients (browser, server, service role) and generated types
    validation/        Zod schemas shared by client and server
supabase/
  migrations/          Schema, RLS, functions, storage, reference data
scripts/seed-dev.ts    Development seed
tests/                 unit/, integration/, e2e/
```
