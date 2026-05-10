# Quazom Admin

Internal analytics console for the Quazom platform. Surfaces aggregate
and per-user behaviour — sign-ups, sign-ins, curricula / lesson
generations, note + annotation activity, AI token usage, and referral
sources — across configurable time ranges. Deliberately read-only and
content-free: the admin sees counts and timestamps, never the actual
curricula, lessons, or notes a user writes.

## Running locally

```bash
# From the repo root
npm install
npm run dev:admin   # serves on http://localhost:3003
# or
npm run dev:all     # starts all apps via mprocs
```

The first run also generates the Prisma client. Make sure `apps/admin/.env`
points at the same `DATABASE_URL` as `apps/main/.env` — the two apps share
the user / session / curriculum tables.

## Granting admin access

There is no signup flow inside the admin console. Admins are minted by
flipping `isAdmin` on an existing `user` row:

```sql
UPDATE "user" SET "isAdmin" = true WHERE email = 'me@example.com';
```

After that, sign in at `http://localhost:3003/login` using the same
email/password that account uses on the main app. Non-admins that
attempt to sign in are bounced back to the login page with a helpful
error.

## Where things live

- `app/(auth)/login/` — admin sign-in
- `app/(admin)/page.tsx` — overview dashboard (KPIs, referrals)
- `app/(admin)/users/page.tsx` — per-user analytics table
- `app/(admin)/users/[id]/page.tsx` — per-user drill-down
- `lib/auth.ts` — Better Auth instance (own secret, shared DB)
- `lib/auth-utils.ts` — `requireAdmin` server guard
- `lib/queries/analytics.ts` — all dashboard queries
- `lib/range.ts` — `?range=` parsing and date math

## AI token usage telemetry

Every server-side AI call we make on behalf of a user writes an
`ai_usage` row before returning. The helper lives at
`inngest/ai-usage.ts` and is invoked from `inngest/functions.ts` and
the `summarizeNote` tRPC mutation. New AI features should call
`recordAiUsage` immediately after `generateObject` / `generateText` so
the admin dashboard picks up the spend automatically.
