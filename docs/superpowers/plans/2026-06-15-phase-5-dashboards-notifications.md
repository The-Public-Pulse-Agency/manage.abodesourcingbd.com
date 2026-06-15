# Phase 5 — Dashboards + Notifications/Alert Cron — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD, checkbox steps.

**Goal:** A role-aware KPI/exception dashboard, plus an idempotent rule-based alert engine that writes in-app notifications (and pluggable email digests) on a daily cron, with an in-app notification bell + list.

**Architecture:** Two parts.
- **5a Dashboards** — pure aggregation lib `dashboardSummary(actor,{now})` that composes existing libs (financeSummary, criticalPathBoard) plus new KPI queries (open order book value, OTD%, exception widgets). One server page renders cards + exception lists.
- **5b Notifications** — `Notification` model (unique `[userId, dedupKey]` ⇒ idempotency). Pure `computeAlerts(data, businessToday)` returns `AlertDraft[]`; `generateAlerts({now})` fetches data, expands rule→roles→active userIds, persists via `createMany({skipDuplicates:true})`, and assembles per-user email digests via a pluggable `Notifier` (log channel default, Resend when `RESEND_API_KEY` set). A secret-guarded cron route `/api/cron/alerts` runs it. In-app: bell badge in nav + `/notifications` page + mark-read actions.

**Tech Stack:** Next 16 RSC + server actions, Prisma 6, Zod 4, Vitest 4 (Neon `test` schema). Asia/Dhaka = UTC+6 fixed (no DST).

---

## Review Revisions (6-lens adversarial review — APPLIED)

**Must-fix (10):**
1. **TZ consistency** — `dashboardSummary` computes `today = businessToday(now)` once and passes `today` (not raw `now`) into BOTH `financeSummary(actor,{now:today})` and `criticalPathBoard(actor,{now:today})`. `startOfUtcDay` is idempotent on a floored date, `ageBucket` works on any floored now ⇒ dashboard agrees with alert engine for evening-UTC runs.
2. **Payment-overdue threshold** — align dashboard (`ageBucket` ⇒ overdue at age≥31) with alert rule. Alert fires when `issueDate < addDaysUtc(businessToday, -30)` (age≥31). Test: invoice at exactly −30d ⇒ NOT overdue (bucket "0-30"); at −31d ⇒ overdue, and dashboard count == alert set.
3. **Middleware** — add `|| pathname.startsWith("/api/cron")` to `isPublic` in `src/middleware.ts` so the CRON_SECRET Bearer check is the sole gate (otherwise session-less cron is 302→/login).
4. **CRON_SECRET fail-closed** — add `CRON_SECRET=` to `.env.example`. Route: unset ⇒ **503** + log; set-but-wrong/missing Bearer ⇒ **401**.
5. **Digest "new rows"** — `createMany({skipDuplicates})` returns only `{count}`. Snapshot `startedAt = new Date()` before insert, then `notification.findMany({where:{createdAt:{gte:startedAt}}})` grouped by userId ⇒ digest only truly-new recipients. Test: 2nd run ⇒ 0 rows AND 0 emails.
6. **Active recipients** — fan out via `user.findMany({where:{active:true, role:{in:roles}}})`. Test: deactivated merch gets 0 rows.
7. **otdPercent NaN guard** — `if (completed===0) return {completed:0,onTime:0,pct:null}`.
8. **Per-user email isolation** — each `notifier.email` in its own try/catch; DB rows persist regardless; cron never crashes on email failure; log per-failure.
9. **Invoice index** — add `@@index([issueDate])` in the notifications migration.
10. **docsMissing** — real enum values `["BL","COMMERCIAL_INVOICE","PACKING_LIST"]`; single set-based `document.findMany({entityType:"PurchaseOrder", type:{in:...}, entityId:{in:poIds}})` + Set filter (no N+1).

**Should-fix (adopted):**
- `businessToday` lives in `src/lib/tna/schedule.ts` (with `startOfUtcDay`/`addDaysUtc`); imported by both dashboard + alerts (no dashboard←alerts dependency).
- exFty window = `[businessToday, businessToday+8d)` (today..+7 inclusive), identical in Task 2 and Task 6, matching board's DUE_SOON convention; boundary test at +0/+7/+8.
- Open Order Book value summed only over **USD** live POs (money lib forbids mixing currencies); count = all live POs; label "USD value". `paymentOverdue` documented as issue-age proxy (no terms field).
- `markRead(actor,id)` updates `where:{id, userId:actor.id}` and returns the row; test cross-user ⇒ 0 rows.
- Cron route returns `Cache-Control: no-store`; supports GET+POST.
- Tests lock in one-shot/no-re-nudge behavior (overdue→paid→overdue fires once) and idempotency.
- `samplesPending` = `status:"PENDING" AND sentDate:{not:null}` (pending approval, not unsent drafts).

**Dropped (review-confirmed non-issues):** `businessToday` formula already correct; `Invoice.issueDate` non-null (no guard needed); rate-limit/timing-safe-compare/response-leak = over-engineering for an internal once-daily secret-guarded cron; UNSCHEDULED-milestone / empty-sizes-rollup / computeAlerts-not-from-dashboard = already-correct behavior.

---

## Key design decisions (attack these in review)

1. **Timezone:** the RMG business operates Asia/Dhaka (UTC+6, no DST). Milestone `plannedDate`/`exFactoryDate` are stored at **UTC-midnight of a calendar date** (date-only semantics, via `startOfUtcDay`). The cron's `now` is a real UTC instant. To get "today" on the Dhaka calendar, compute `businessToday = startOfUtcDay(now + 6h)` — UTC-midnight tagging the Dhaka calendar day. All RAG/window/age comparisons use `businessToday`, keeping calendar-date math apples-to-apples with stored dates. (An evening-UTC run e.g. 20:00 UTC = 02:00 Dhaka next day must count as the next Dhaka day.)
2. **Idempotency / no-spam:** `dedupKey` is **create-once per (rule, entity)** — e.g. `milestone-overdue:<milestoneId>`, `ex-fty-7d:<poId>`, `payment-overdue:<invoiceId>`, `sample-pending:<sampleId>`, `doc-missing:<poId>`. `@@unique([userId, dedupKey])` + `skipDuplicates` ⇒ re-running the cron any number of times never duplicates. Trade-off: no re-nudge/escalation (acceptable v1; avoids alert spam).
3. **Recipients:** rule→roles map, fanned to **active** users of those roles. Merch-flow rules (milestone/ex-fty/doc/sample) → MERCHANDISER+ADMIN; payment → ACCOUNTS+ADMIN. Each recipient gets their own row (dedup is per-user).
4. **OTD%** is measured on the **Ex-factory milestone** (`key = "ex_factory"`): of milestones with an `actualDate`, % with `actualDate <= plannedDate`. Reuses existing actuals; no new status.
5. **Open Order Book** = POs with status in {CONFIRMED, IN_PRODUCTION, PARTLY_SHIPPED} (live, not draft/closed/cancelled/on-hold). Value = Σ line sell totals (mills lib).
6. **Cron is a system actor** — `generateAlerts` takes no `SessionUser` and bypasses RBAC; the route is guarded by `CRON_SECRET` (Bearer header). If `CRON_SECRET` unset ⇒ 503 (fail closed).
7. **dashboardSummary** calls `financeSummary` which asserts `finance:view`. All four roles have `finance:view`, so safe; dashboard asserts `dashboards:view`.

---

## Part 5a — Dashboards

### Task 1: OTD + open-book KPI helpers (pure)
**Files:** Create `src/lib/dashboard/kpi.ts`, Test `src/lib/dashboard/kpi.test.ts`

- [ ] **otdPercent(milestones)** — input `{plannedDate,actualDate}[]`; consider only rows with both dates; `onTime = actual<=planned`; return `{completed, onTime, pct}` (pct null if completed===0). Test: 3 rows (2 on-time,1 late) ⇒ pct=66.67 (round 2dp); empty ⇒ pct null.
- [ ] **businessToday(now)** — `startOfUtcDay(new Date(now.getTime()+6*3600_000))`. Test: `2026-06-15T20:00:00Z` ⇒ `2026-06-16T00:00:00Z`; `2026-06-15T03:00:00Z` ⇒ `2026-06-15T00:00:00Z`. (Export from here; reused by alerts.)

### Task 2: dashboardSummary aggregation
**Files:** Create `src/lib/dashboard/summary.ts`, Test `src/lib/dashboard/summary.test.ts`
Returns:
```ts
type DashboardSummary = {
  openOrders: { count: number; value: number };       // USD sell value (mills→number)
  otd: { completed: number; onTime: number; pct: number | null };
  finance: { receivable: number; payable: number; realisedMargin: number };
  exceptions: {
    exFtyDue7d: { poId: string; poNumber: string; buyer: string; factory: string; exFactoryDate: Date }[];
    overdueMilestones: number;     // from criticalPathBoard rag===OVERDUE
    dueSoonMilestones: number;     // rag===DUE_SOON
    telexPending: { id: string; reference: string; blNumber: string | null }[]; // BL issued, telex !== RELEASED
    paymentOverdue: number;        // outstanding invoices in 31-60/61-90/90+ buckets
  };
};
```
- [ ] assertPermission(actor,"dashboards","view"). Use `businessToday(now)`.
- [ ] openOrders: `findMany({where:{status:{in:[CONFIRMED,IN_PRODUCTION,PARTLY_SHIPPED]}}, include:{lines:{include:{sizes:true}}}})`; value via `rollup`/`lineTotals` sell mills → number (2dp). count = list length.
- [ ] otd: `taMilestone.findMany({where:{key:"ex_factory", actualDate:{not:null}}})` → otdPercent.
- [ ] finance: `financeSummary(actor,{now})` → receivable/payable/realisedMargin; paymentOverdue = aging rows with bucket !== "0-30" count.
- [ ] exceptions.exFtyDue7d: open POs with `exFactoryDate` in `[businessToday, businessToday+8d)` (exclusive), ordered asc.
- [ ] overdue/dueSoon: `criticalPathBoard(actor,{now})` split by rag.
- [ ] telexPending: `shipment.findMany({where:{blNumber:{not:null}, telexStatus:{not:"RELEASED"}}})`.
- [ ] Tests (Neon): seed buyer/factory/style; one CONFIRMED PO with sized line (value), one ex-fty in 5d (exception), one ex-factory milestone actual late (otd), one shipment BL+telex PENDING (telexPending), one overdue invoice (paymentOverdue). Assert each field.

### Task 3: Dashboard page
**Files:** Modify `src/app/(app)/dashboard/page.tsx`
- [ ] RSC: load user via `getCurrentUser`/auth, `dashboardSummary(user,{now:new Date()})`. KPI cards (Open orders count+value, OTD%, AR, AP, Realised margin). Exception section: ex-fty-due-7d list (link `/orders/{id}`), overdue/due-soon milestone counts (link `/critical-path`), telex-pending list (link `/shipments`), payment-overdue count (link `/finance`). Use design tokens, `.tnum`. Empty states.
- [ ] Verify via screenshot in E2E later.

---

## Part 5b — Notifications + Alert cron

### Task 4: Notification model
**Files:** Modify `prisma/schema.prisma`; migrate
- [ ] Add enum + model:
```prisma
enum NotificationType { MILESTONE_OVERDUE EX_FACTORY_SOON DOC_MISSING PAYMENT_OVERDUE SAMPLE_PENDING }
model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields:[userId],references:[id],onDelete:Cascade)
  type      NotificationType
  message   String
  link      String?
  dedupKey  String
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())
  @@unique([userId, dedupKey])
  @@index([userId, read])
}
```
Add `notifications Notification[]` to User.
- [ ] `npx prisma migrate dev --name notifications` (+ generate). Verify `npx tsc --noEmit`.

### Task 5: Pure alert rules
**Files:** Create `src/lib/alerts/rules.ts`, Test `src/lib/alerts/rules.test.ts`
```ts
export type AlertDraft = { type: NotificationType; message: string; link: string; dedupKey: string; roles: Role[] };
export type AlertData = {
  milestonesOverdue: {id;poNumber;name;poId}[];      // actualDate null & planned < businessToday
  exFtySoon: {poId;poNumber;exFactoryDate}[];          // open & exFty in [today, today+8d)
  paymentsOverdue: {invoiceId;number;poId|null}[];      // outstanding & issueDate <= today-30d
  samplesPending: {id;poId;poNumber;type}[];            // status PENDING (sentDate not null? -> pending approval)
  docsMissing: {poId;poNumber}[];                       // open, exFty in 7d, no BL/CI/PL doc
};
export function computeAlerts(d: AlertData): AlertDraft[]
```
- [ ] Map each item to a draft with stable dedupKey + roles (per design #3). Pure, deterministic.
- [ ] Tests: each category yields a draft with expected dedupKey/roles/link; empty data ⇒ [].

### Task 6: Alert data fetch + businessToday windowing
**Files:** Create `src/lib/alerts/data.ts`, Test `src/lib/alerts/data.test.ts`
- [ ] `fetchAlertData(now): Promise<AlertData>` using `businessToday(now)`:
  - milestonesOverdue: `taMilestone.findMany({where:{actualDate:null, plannedDate:{lt:businessToday}, po:{status:{notIn:[CLOSED,CANCELLED,ON_HOLD]}}}})`.
  - exFtySoon: open POs exFty in `[businessToday, +8d)`.
  - paymentsOverdue: invoices outstanding>0 (compute via payments) & `issueDate <= businessToday-30d`.
  - samplesPending: `sampleRequest.findMany({where:{status:"PENDING"}, include po})`.
  - docsMissing: open POs exFty in 7d with no Document where `entityType="PurchaseOrder" && type in [BL,CI,PL] && entityId=po.id`.
- [ ] Test (Neon): seed one of each ⇒ data arrays populated; closed PO milestone excluded.

### Task 7: generateAlerts (persist + idempotent + digest)
**Files:** Create `src/lib/alerts/generate.ts`, `src/lib/alerts/notifier.ts`, Test `src/lib/alerts/generate.test.ts`
- [ ] `notifier.ts`: `export interface Notifier { email(to:string,subject:string,body:string):Promise<void> }`; `logNotifier` (console) default; `getNotifier()` returns Resend-backed if `RESEND_API_KEY` else logNotifier.
- [ ] `generateAlerts({now, notifier?}): Promise<{created:number}>`:
  1. `fetchAlertData(now)` → `computeAlerts` → drafts.
  2. Load active users grouped by role.
  3. Expand drafts → rows `{userId,type,message,link,dedupKey}` for each recipient.
  4. `prisma.notification.createMany({data, skipDuplicates:true})` → created count.
  5. Per user with ≥1 **new** row, assemble digest text and `notifier.email(...)` (best-effort; swallow errors).
- [ ] Tests (Neon): seed users (merch+accounts) + alert sources; run once ⇒ rows created & counts per role correct; **run twice ⇒ second run creates 0** (idempotency). Inject a capturing notifier; assert digest sent to the right users on first run only.

### Task 8: Cron route
**Files:** Create `src/app/api/cron/alerts/route.ts`, Test `src/lib/alerts/cron-auth.test.ts` (pure auth helper)
- [ ] `src/lib/alerts/cron-auth.ts`: `isAuthorized(headerValue, secret)` — true iff secret set and header === `Bearer ${secret}`. Test: missing secret ⇒ false; wrong ⇒ false; correct ⇒ true.
- [ ] Route `GET`/`POST`: read `authorization` header + `process.env.CRON_SECRET`; if `!isAuthorized` ⇒ 401/503. Else `generateAlerts({now:new Date()})` ⇒ `Response.json({created})`. `export const dynamic = "force-dynamic"`.
- [ ] Add `CRON_SECRET=` to `.env.example`.

### Task 9: Notifications lib + UI
**Files:** Create `src/lib/notifications/notifications.ts`, `src/app/(app)/notifications/page.tsx`, `src/components/notification-actions.tsx`; Modify `src/components/app-nav.tsx` + layout for bell
- [ ] lib: `listNotifications(actor)`, `unreadCount(actor)`, `markRead(actor,id)` (scoped to actor.id), `markAllRead(actor)`. Actions wrap with `getCurrentUser`.
- [ ] `/notifications` page: list (type chip, message, link, relative time, read styling) + "Mark all read" button.
- [ ] Nav bell: layout passes `unread` to AppNav; bell link `/notifications` with badge when unread>0.
- [ ] Tests (Neon): create notifications for 2 users; `listNotifications`/`unreadCount` scoped per user; `markRead` only affects own & flips read; `markAllRead`.

### Task 10: Verify + E2E + finish
- [ ] `npx tsc --noEmit`; `npm test` (all green); update seed if needed.
- [ ] Throwaway screenshot spec: dashboard + notifications page; eyeball.
- [ ] Commit 5a, then 5b (or together), merge to main, push origin/main.
