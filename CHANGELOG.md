# Changelog

All notable changes to **Pulse OMS** (Abode Sourcing order-management system) are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/); this project ships continuously
to `main` (Vercel auto-deploy) rather than tagged releases, so entries are grouped by date.
Categories: **Added** (new features), **Changed**, **Fixed**, **Security**.

---

## 2026-06-23

### Added
- **BDT Cash Book** on the Finance page — Monthly BDT **Received** (date, amount, sender,
  purpose, remarks) and **Expenses** (date, amount, expense head, remarks) with a month picker
  and a **Monthly Summary** (opening balance, total received, total expenses, closing balance).
  Expense heads ship with 22 defaults but **any new head can be typed** (datalist); received
  "purpose" likewise has suggestions + free entry. Permission-gated (`finance:create`/`delete`).
- **Delete an invoice** on the Finance / All Invoices panel (`finance:delete`), blocked while
  the invoice has recorded payments. (`06e6892`)

### Fixed
- **RBAC UI gating** — the Running Orders and Shipped Goods reports no longer show inline
  edit / Close / Delete affordances to roles that lack the permission (`orders:edit`/`delete`,
  `shipment:edit`/`delete`, `finance:edit`). The server already enforced these; the UI now
  mirrors them. (`8369d67`, `c18fe8e`)
- Order pages (`/orders`, `/enquiries`) no longer 500 for tightly-scoped roles — master-data
  lookups are gated on `masterData:view`. (`d337cf2`)

### Docs
- Added `CHANGELOG.md` + `CONTRIBUTING.md` (git/commit/migration conventions). (`66efca4`)

## 2026-06-22

### Added
- **Dedicated `production` permission** — cut/sew/finish + the 4 status remarks are split from
  `productionQc` (QC inspections + materials), enabling a role that can update only production.
  Includes a migration that backfills existing roles. (`d25d108`)
- **Short-close a partly-shipped order** — closes the un-shipped balance; the Shipped register
  auto-shows the short qty (e.g. "256 pcs short"). (`6b621a3`)
- **Production panel summaries** — per-style subtotals grouping colour lines, an all-styles PO
  grand-total, and a style-wise breakdown table. (`306c2ad`, `e335fd3`)
- **Delete a user** with two-step confirm + last-admin/self-delete guards. (`feat(users)`)

### Fixed
- **Dashboard degrades gracefully** — finance & critical-path widgets fall back to zeros instead
  of 500-ing when a role lacks `finance:view`/`criticalPath:view`. (`015f216`, regression test `b62f6a2`)
- **No login redirect loop** for low-permission roles — post-login lands on the first allowed
  page (or `/account`) instead of bouncing `/dashboard ↔ /orders`. (`7b73515`)

## 2026-06-21

### Added
- **Activity Log** page (`/audit`) — view all user activity (create/edit/delete/approve),
  filter by action/type/user. (`feat(audit)`)
- **Per-line production status remarks** — Bulk fabric shade approval, Fabric wash test,
  Garments wash test, Top/shipment samples — above cut/sew/finish.

### Fixed
- User list refreshes immediately after creating a user.

## 2026-06-20
### Added
- Inline-edit factory certificate name, number & valid-until on Factory Information.

## 2026-06-19

### Added
- **Buyer Sample Tracking** + **Dhaka Office Sample In/Out** tracker modules (auto-synced
  balance, dashboard). Sample tracker auto-fill/autocomplete + aligned IN/OUT headers.
- **Brand column** + **multi-select Buyer/Factory filters** on Open & Shipped reports.
- Inline edit of order line **qty / style / colour** (not just price); ADMIN force-edit override
  on confirmed/invoiced orders.
- **Over-shipment** and **over-production** allowed (factories over-produce); excess flagged as a note.
- Dashboard **sampling summary** (buyer samples + office in/out balance).
- Document **file uploads** (Vercel Blob) for orders + shipments.

### Changed
- De-dup styles + case/space-insensitive uniqueness guard + Brand column on the Styles list.
- Report column renames (Fabric/Garments Wash Test).

### Security
- Document blobs are **private** + served via a tenant-gated download proxy; `storageKey` is
  server-only to prevent cross-tenant blob reads (IDOR). (review HIGH)

## 2026-06-18

### Added
- **Role Manager UI** — create custom per-company roles + edit granular permissions; dynamic
  role backend replacing the fixed Role enum.
- Auto-generated downloadable **PO + Invoice (Excel)**; commission invoice to buyer; company
  banking details on invoices.
- Per-style/colour production tracking; Critical Path milestone remarks; custom order channel.

### Fixed
- Open-order balance qty, invoice status/dates, auto-filled invoices/commission.
- Mobile-friendly tables; broad business-logic & editability remediation.

### Security
- Block SUPERADMIN escalation, cross-tenant FK checks, constant-time cron, reserved-role-key guard.

## 2026-06-17

### Added
- Multi-tenant **SaaS**: company/package model, tenant data isolation (`companyId` scoping),
  per-company signup + subscriptions + alert cron.
- Reports: Open Orders, Shipped Goods, Factory Information — graphified (KPI cards + charts),
  filtering, inline grid editing, CSV export.
- Buyer Commission ledger; standalone Development module; Excel order import.

### Changed
- Project-wide premium UI/UX pass; mobile-responsive layout; server-side filtering + pagination.

### Security
- Tenant isolation hardening; two-step confirm before destructive deletes; self-service password change.

## 2026-06-15 – 2026-06-16 — Foundation (Phases 0–5)

### Added
- Next.js 16 + Prisma + Postgres scaffold; **RBAC** (permission matrix, Auth.js login, audit log),
  user management, app shell.
- Master data (factory/buyer/brand/style/colour/size-scale) CRUD + Excel import.
- Orders backend + UI (PO intake, size-wise lines, confirm, order book, lots).
- **Critical Path** (T&A) engine; sampling + production + QC.
- Shipment + documents (size-wise balance, telex/BL, polymorphic docs).
- Costing-approval gate + finance (invoices, payments, AR/AP, realised margin, close).
- Dashboards + idempotent alert engine, notifications, daily cron.
- EPS subscription/licence billing (gated behind `BILLING_ENABLED`).

### Deploy
- Vercel (sin1, near Neon) — Prisma serverless, migrate-on-build, alert cron.

---

_For the authoritative per-change record, see `git log`. Each commit is a focused, conventionally
formatted change — see `CONTRIBUTING.md`._
