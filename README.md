# ABD OMS — RMG Order & Merchandising Management System

Next.js full-stack OMS for a Bangladesh RMG buying house. See the design spec in
`docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

## Prerequisites
- Node 20+, and either a Neon Postgres URL or Docker (for local Postgres).

## Setup
```bash
cp .env.example .env          # set DATABASE_URL + AUTH_SECRET (openssl rand -base64 32)

# Option A — Neon (managed): put your Neon URL in .env as DATABASE_URL
# Option B — Docker (local):
docker compose up -d          # Postgres dev:5432, test:5433

npm install
npx prisma migrate dev        # apply migrations to the dev DB
npx dotenv -e .env.test -- prisma migrate deploy   # apply to the test DB (Docker option)
npm run db:seed               # seed admin@abode.com / ChangeMe123!
npm run dev
```

## Testing
```bash
npm test        # unit + integration (Vitest); needs a reachable test DB
npm run e2e      # Playwright E2E; needs dev server + seeded dev DB
```

Unit-only tests (no DB) currently: password hashing, permission matrix, permission guard.

## Default login
admin@abode.com / ChangeMe123!  — change this immediately.

## Stack
Next.js 16 (App Router), React 19, Tailwind v4, PostgreSQL + Prisma 6, Auth.js v5,
Zod, Vitest, Playwright.
