# Contributing & Git Workflow

Conventions for working on **Pulse OMS**. Keep the history clean and every change documented.

> Project guides live in `AGENTS.md` / `CLAUDE.md` (read the Next.js notes in
> `node_modules/next/dist/docs/` before writing framework code) and `docs/superpowers/`.

## Branching & deploy

- `main` is the production branch — pushing to it triggers a **Vercel auto-deploy** (sin1).
- Commit/push only when a change is verified (see Verification). If asked to start fresh work
  off `main`, branch first; otherwise small, verified fixes go straight to `main`.
- Check a deploy with: `gh api repos/<owner>/<repo>/commits/<sha>/status --jq '.state'`.

## Commit messages (Conventional Commits)

```
<type>(<scope>): <imperative summary>

<optional body — what & why, not how>

Co-Authored-By: <author>
```

- **type**: `feat` · `fix` · `chore` · `test` · `docs` · `style` · `perf` · `refactor`
- **scope**: the area, e.g. `orders`, `reports`, `rbac`, `production`, `auth`, `shipment`,
  `master-data`, `dashboard`, `security`.
- One logical change per commit. Examples from history:
  - `feat(rbac): dedicated "production" permission for cut/sew/finish + status updates`
  - `fix(dashboard): degrade gracefully when a role lacks finance/criticalPath view`
  - `test(shipment): align balance test with over-shipment allowance`
- Keep `CHANGELOG.md` updated for user-facing changes (group by date).

## Verification (run before every commit)

```bash
npx tsc --noEmit          # types
npm run build             # production build (all routes compile)
npx vitest run            # tests — run ALONE; concurrent runs corrupt the shared Neon test DB
```

Run vitest single-file or with `--no-file-parallelism` if the shared test DB contends.

## Database migrations

Migrations are **hand-authored** (the schema may diverge from defaults — see `AGENTS.md`):

1. Edit `prisma/schema.prisma`.
2. Create `prisma/migrations/<timestamp>_<name>/migration.sql` with the SQL.
3. Apply + sync:
   ```bash
   npx prisma generate
   npx prisma migrate deploy            # dev/prod DB (DATABASE_URL)
   npm run db:push:test                 # test DB (.env.test)
   ```
4. **Commit the migration folder** alongside the feature that needs it.

Migrations must be additive/backward-compatible where possible (old running code ignores new
columns). For data backfills (e.g. permission changes), guard with `NOT (...)` so they're idempotent.

## Secrets & one-off scripts

- **Never commit secrets.** `.env*` is gitignored (only `.env.example` is tracked). Verify with
  `git ls-files | grep .env`.
- One-off operational scripts (creating users, restoring roles) are written, run once via
  `npx dotenv -e .env -- tsx script.ts`, and **deleted** — never committed.
- Production DB writes (users/roles) must be explicitly requested by the maintainer.

## RBAC changes

- Permissions are enforced **server-side** (`assertPermission`) — that is the source of truth.
- The **UI must mirror** the permissions (hide edit/delete affordances the role lacks) so screens
  aren't misleading.
- Pages should **degrade gracefully** when a role lacks an enrichment permission (gate the data
  load + fall back to empty/zero) rather than throwing — a missing permission must never 500 a page.

## Repo hygiene checklist

- [ ] `git status` clean before finishing
- [ ] `origin/main` in sync (`git rev-list --left-right --count origin/main...HEAD`)
- [ ] No stray temp scripts at the repo root
- [ ] No `.env*` (besides `.env.example`) tracked
- [ ] Migrations committed; deploy status `success`
- [ ] `CHANGELOG.md` updated for user-facing changes
