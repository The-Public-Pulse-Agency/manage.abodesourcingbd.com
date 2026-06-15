# Deploying ABD OMS to Vercel

The repo is Vercel-ready: `vercel.json` runs DB migrations during the build and
registers the daily alert cron; `postinstall` generates the Prisma client with the
Lambda binary target.

## 1. Prepare the database (Neon)

You already have a Neon project. In the Neon console, grab **two** connection strings:

- **Pooled** — host contains `-pooler` (e.g. `ep-xxx-pooler.ap-southeast-1.aws.neon.tech`). Used by the app at runtime.
- **Direct** — same host **without** `-pooler`. Used only by `prisma migrate`.

Keep `?sslmode=require` on both. (For a clean production split, create a separate Neon
database/branch for prod instead of reusing the dev one.)

## 2. Import the repo into Vercel

1. https://vercel.com → **Add New… → Project** → import
   `The-Public-Pulse-Agency/manage.abodesourcingbd.com`.
2. Framework preset: **Next.js** (auto-detected). Leave build/output settings default —
   `vercel.json` supplies the build command.

## 3. Set Environment Variables (Project → Settings → Environment Variables)

Add these for **Production** (and Preview if you use it):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `CRON_SECRET` | `openssl rand -base64 32` (Vercel auto-sends it as `Bearer` to the cron route) |
| `RESEND_API_KEY` | your Resend key (rotate the one shared in chat) |
| `ALERT_EMAIL_FROM` | `ABD OMS Alerts <alerts@mail.abodesourcingbd.com>` (verified domain) |

> Do **not** commit any of these — `.env*` is gitignored.

## 4. Deploy

Click **Deploy**. The build runs `prisma migrate deploy` (applies all migrations via
`DIRECT_URL`) then `next build`. First build also creates every table on a fresh DB.

## 5. Seed the first admin (once)

A fresh prod DB has no users. From your machine, pointing at the **prod** DB:

```bash
DATABASE_URL="<prod-direct-url>" DIRECT_URL="<prod-direct-url>" npm run db:seed
```

This creates `admin@abode.com / ChangeMe123!` + default size scales/colours/T&A
templates. **Log in and change that password immediately.**

## 6. Verify the cron

Vercel registers the cron from `vercel.json` (daily 02:00 UTC = 08:00 Asia/Dhaka).
Check **Project → Cron Jobs**. To test on demand:

```bash
curl -X POST https://<your-app>.vercel.app/api/cron/alerts \
  -H "Authorization: Bearer <CRON_SECRET>"
# → {"ok":true,"created":N}
```

Without the bearer it returns 401; if `CRON_SECRET` is unset it returns 503.

## Notes

- **Cron frequency:** Vercel Hobby allows once/day (the configured schedule fits). Pro
  allows more frequent schedules if you want intra-day alerts.
- **Previews migrate the same DB** unless you set a separate `DIRECT_URL` for the Preview
  environment — use a Neon branch per environment to isolate.
- **Schema changes later:** committing a new Prisma migration + redeploying applies it
  automatically via the build's `prisma migrate deploy`.
