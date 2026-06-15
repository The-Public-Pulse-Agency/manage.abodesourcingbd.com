# RMG Order & Merchandising Management System — Design Spec

- **Date:** 2026-06-15
- **Owner:** moshiur@publicpulse.com.bd
- **Status:** Approved design (pre-implementation-plan)
- **Working name:** ABD OMS (Abode Order Management System)

---

## 1. Overview & Purpose

A web-based, role-based **Order & Merchandising Management System** for a Bangladesh
RMG **buying / merchandising house** ("Abode" / ABD). It replaces the current
spreadsheet workflow (`BD open order's 11June2026.xlsx`) and adds the parts the
spreadsheet cannot do: a structured order book, a Critical Path (Time & Action)
engine, back-to-back costing/margin, finance (invoices & payments), document &
compliance tracking, and management dashboards.

The system digitizes the full order lifecycle that a buying house owns:

```
Buyer/Brand PO  →  Abode (buying house)  →  BD Factory (CMT)  →  Production
   →  Ex-factory / Shipment  →  Documents (BL/Telex/TC)  →  Invoice & Payment
```

## 2. Domain Context (why this exists)

The buying house is the **single point of accountability** between UK/US brands and
Bangladeshi factories. It wins orders, allocates them to factories, drives the
critical path, controls export documents, and earns a **back-to-back margin**
(buys at factory NET FOB, sells to the buyer at a higher FOB).

Observed failures in the current spreadsheet that this system fixes:

| Spreadsheet failure | System fix |
| --- | --- |
| 99% of open order book un-costed (qty/price blank) | Structured PO intake; order can't leave Draft without qty + price per line |
| Factory/brand/style names free-typed & inconsistent | Master data — selected from lists, never typed |
| Ex-factory mixes real dates with free text ("Approx 15/Nov") | Typed date fields + status enums |
| Stale totals (footer 307,388 vs real 614,776) | Computed, always-correct rollups |
| Status as free text ("Send 30/6", "NO TC") | Controlled status workflow + alerts |
| No change history | Full audit log |
| Middle of critical path (sampling, fabric, inspection) invisible | T&A milestone engine with overdue alerts |
| One spreadsheet = one person's silo | Role-based multi-user with live shared state |

## 3. Goals & Non-Goals

**Goals (v1 = full platform, full financials, internal-only, cloud):**
- Replace the spreadsheet with a structured, multi-user system.
- Track the full Critical Path (T&A) from pre-production to payment.
- Manage back-to-back costing and margin.
- Manage finance: factory invoices (payable), buyer invoices (receivable), payments, AR/AP.
- Document & compliance storage and tracking.
- Role-based access for a lean internal team.
- Management dashboards and exception reports.

**Non-Goals (explicitly out of v1; future phases):**
- External portals for factories or buyers (internal-only for now).
- WhatsApp / SMS notifications (engine is pluggable; v1 = in-app + email).
- Two-way accounting-software sync (Tally/QuickBooks/Xero) — finance is self-contained in v1.
- Mobile native apps (responsive web only).

## 4. Finalized Requirements (decision log)

| Decision | Choice |
| --- | --- |
| System boundary | **Internal staff only**, role-based |
| v1 scope | **Full platform** (all modules) |
| Financial scope | **Full financials from start** (costing, margin, invoices, payments, AR/AP) |
| Hosting | **Cloud (managed)** |
| Roles | **Lean:** Admin, Merchandiser, Accounts, Management |
| Critical Path stages | **All:** pre-production, sampling & approvals, production & QC, shipping & documentation |
| Notifications | **In-app + email** (pluggable for WhatsApp/SMS later) |
| Integrations | **Excel/CSV import & export + document file storage** (no accounting sync in v1) |
| Architecture | **Full-stack Next.js monolith** (App Router + Server Actions, PostgreSQL + Prisma, Auth.js, S3-compatible storage) |
| Costing granularity | **Per order-line/style** |
| Size breakdown | **Full size-wise quantity** (qty per individual size; optional per-size pricing) |
| T&A template | Sensible default (editable in-app) |

## 5. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js (App Router)                   │
│   UI: React + Tailwind + shadcn/ui                        │
│   Server Actions / Route Handlers  ── business logic      │
│   Auth.js (session + role-guard middleware)               │
│   Zod validation (shared client + server)                 │
└───────────────┬───────────────────────┬──────────────────┘
                │ Prisma ORM             │ S3 SDK
        ┌───────▼────────┐       ┌───────▼─────────┐
        │  PostgreSQL    │       │  Object storage  │
        │  (managed)     │       │  (R2 / S3)       │
        │  + audit log   │       │  BL/CI/PL/TC/img │
        └────────────────┘       └─────────────────┘
                │
        ┌───────▼────────┐   ┌──────────────────────────┐
        │ Email (Resend/ │   │ Scheduled job (cron):     │
        │ SES) alerts    │   │ T&A RAG recompute + alerts │
        └────────────────┘   └──────────────────────────┘
```

- **Single codebase**, TypeScript end-to-end (Next.js + Prisma + Zod).
- **Auth.js** with a role claim; permission layer enforced **server-side** on every action.
- **Scheduled job** recomputes T&A RAG status daily and generates alerts/digests.
- **Excel import** seeds master data + current open orders/shipments at onboarding.
- **Stack:** Next.js (App Router), React, TypeScript, Tailwind + shadcn/ui, PostgreSQL,
  Prisma, Auth.js, Zod, S3-compatible storage, Resend/SES, Playwright + Vitest for tests.

## 6. Module Map

| # | Module | Responsibility |
| --- | --- | --- |
| 1 | Auth & Users | Login, roles, permission matrix, audit log |
| 2 | Master Data | Buyers/Brands, Factories, Styles/SKUs (size scale + colours), ports, forwarders, currencies/FX |
| 3 | Order Management | PO intake, order lines (style × colour × size × qty), multi-PO lots, order status |
| 4 | Critical Path (T&A) | Milestone templates → per-order milestones, RAG status, dependencies, overdue engine |
| 5 | Sampling & Approvals | Lab dip / fit / PP / size-set requests + approval status |
| 6 | Production & QC | Cutting/sewing progress, inline + final AQL inspection pass/fail |
| 7 | Costing & Margin | Per-line cost sheet: factory NET FOB vs sell FOB, CM breakdown, margin |
| 8 | Shipment & Logistics | Lots, cartons, container, ex-factory, BL/Telex, forwarder |
| 9 | Documents & Compliance | Upload/track BL, commercial invoice, packing list, TC/test cert; per-shipment checklist |
| 10 | Finance / Commercial | Abode invoice (to buyer) vs factory invoice, payments in/out, AR/AP, margin realised |
| 11 | Dashboards & Reports | Open order book, ex-fty due, docs/payment pending, OTD%, margin summary; Excel export |
| 12 | Notifications | In-app + email alert rules (pluggable for WhatsApp/SMS) |

## 7. Role & Permission Matrix (Lean — 4 roles)

Legend: **F** = full (create/edit/delete) · **E** = create/edit · **A** = approve · **V** = view · **–** = none

| Module | Admin | Merchandiser | Accounts | Management |
| --- | --- | --- | --- | --- |
| User management | F | – | – | V |
| Master data | F | E (styles/POs) | V | V |
| Orders | F | F | V | V |
| Critical Path (T&A) | F | F | V | V |
| Sampling | F | F | – | V |
| Production & QC | F | F | V | V |
| Costing & Margin | F | E (draft) | A + F | V |
| Shipment & Logistics | F | F | V | V |
| Documents | F | F | E (finance docs) | V |
| Finance (invoices/payments) | F | V | F | V |
| Dashboards | All | Ops | Ops + Finance | All (read) |
| Audit log | V | – | – | V |

Permissions are stored as a **config-driven matrix** so they can be tuned without code
changes. Default posture: Accounts owns money; Merchandiser owns the order journey;
Management is read-only; Admin configures + manages users.

## 8. Data Model

**Master data**
- `Buyer` (name, code) `1—* Brand` (name, code)
- `Factory` (name, code, type knit/woven, address, contacts)
- `Style` (styleCode, name, description, composition, category, brandId, defaultSizeScaleId)
- `SizeScale` (name + ordered list of `Size` values, e.g. XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL)
- `Colour`, `Port`, `Forwarder`, `Currency`, `FxRate`

**Order core**
```
Buyer ─< Brand ─< Style ─< StyleVariant(SKU)
Factory
PurchaseOrder (poNumber, buyerId, brandId, channel[Ralawise|RalaTeam],
               factoryId, orderDate, crd/exFactoryDate, currency, status)
   └─< OrderLine (styleId, colourId, sizeScaleId)        // one line per style × colour
        └─< OrderLineSize (size, qty, netFob, sellFob)   // size-wise qty + optional per-size price
Lot ─< PurchaseOrder            // groups multi-PO buys into one production/ship lot
```

`OrderLine.totalQty` and `OrderLine.value` are computed sums over its `OrderLineSize`
rows. Per-size `netFob`/`sellFob` default to the line price but can be overridden for
larger sizes (e.g. 3XL–6XL), preserving size-band price differentials without splitting
lines.

**Process records (hang off PurchaseOrder / OrderLine / Lot)**
- `TAMilestoneTemplate` → `TAMilestone` (plannedDate, actualDate, ragStatus, ownerId, dependsOnId)
- `SampleRequest` (type lab-dip/fit/PP/size-set, sentDate, approvedDate, status, remarks)
- `ProductionRecord` (cutQty, sewQty, finishQty, percent)
- `Inspection` (type inline/final, date, aql, result pass/fail, remarks)
- `CostSheet` (orderLineId, costItems[], factoryNetFob, sellFob, cm, margin, approvedBy)
- `Shipment` (lotId, exFactoryDate, mode sea/air, containerNo, cartons, blNumber, blDate, telexStatus, forwarderId, portId) → `ShipmentLine` (orderLineId) → `ShipmentLineSize` (size, shippedQty) — size-wise shipped qty drives size-wise balance
- `Document` (polymorphic: entityType, entityId, type BL/CI/PL/TC/photo, fileUrl, uploadedBy, uploadedAt)
- `Invoice` (type buyer/factory, number, poId/shipmentId, amount, currency, date, status) `1—* Payment` (direction in/out, amount, date, method LC/TT, status)
- `Notification` (userId, type, message, link, read)
- `AuditLog` (polymorphic: userId, entityType, entityId, action, before, after, timestamp)

**Integrity rules:** unique constraints (PO#, styleCode), enum statuses, foreign keys,
soft-delete on master data, Zod validation shared client+server.

## 9. Key Workflows

**① Order lifecycle (state machine)**
```
Draft → Confirmed → In Production → (Partly) Shipped → Closed
                          └────────── Cancelled / On-hold
```
An order cannot leave **Draft** without qty + price on every line.

**② Critical Path (T&A) engine**
On PO confirm, milestones are instantiated from a template, **back-scheduled from the
ex-factory date** (e.g. PP sample = ex-fty − 45d, fabric in-house = ex-fty − 30d). A
daily job paints each milestone 🟢 on-track / 🟡 due-soon / 🔴 overdue and raises alerts.
Completing a milestone stamps an actual date; the order's headline status reflects the
furthest gate reached.

**③ Back-to-back costing & margin**
CostSheet (per order-line) holds factory NET FOB (cost) and sell FOB (price), at the
size level where prices differ. `margin = Σ_size (sellFob − netFob) × qty`, rolled up
per line → PO → buyer → period. Accounts approves the sheet before the order is Confirmed.

**④ Finance flow**
At shipment, the system raises a **factory invoice (payable)** and an **Abode invoice
to buyer (receivable)**. Payments recorded against each; AR/AP aging; margin realised
when both settle. Telex-release + payment status feed the "cash stuck" dashboard.

**⑤ Shipment consolidation & short-qty**
Many order lines → one Shipment/container. A line can ship across multiple shipments;
the **balance qty auto-tracks per size** (handles "Short Qty, ship by Aug" cases and
size-wise short-ships).

**⑥ Excel onboarding**
Guided import maps the current 3 tabs → Buyers/Factories/Styles/POs/Shipments, with a
validation/dedup step (catches "LIZ/TEI TAK" vs "Liz" duplicates). The current sheet is
band-level (XS–2XL); import preserves the band as a quantity that can later be expanded
into size-wise quantities.

**⑦ Notifications**
Rule-based: milestone overdue, ex-fty in 7d, missing doc before shipment, payment
overdue, sample approval pending → in-app + email digest.

## 10. Default Critical Path (T&A) Template (editable in-app)

Back-scheduled from ex-factory date (offsets are defaults, editable):

| Stage | Milestone | Default offset |
| --- | --- | --- |
| Pre-production | Costing / PI approved | ex-fty − 75d |
| Pre-production | Yarn / fabric booked | ex-fty − 60d |
| Pre-production | Trims & accessories booked | ex-fty − 55d |
| Sampling | Lab dip approved | ex-fty − 55d |
| Sampling | Fit sample approved | ex-fty − 50d |
| Sampling | PP sample approved | ex-fty − 45d |
| Production & QC | Bulk fabric in-house | ex-fty − 30d |
| Production & QC | Cutting started | ex-fty − 25d |
| Production & QC | Sewing in progress | ex-fty − 20d |
| Production & QC | Inline inspection | ex-fty − 12d |
| Production & QC | Final AQL inspection | ex-fty − 5d |
| Shipping & docs | Ex-factory | ex-fty |
| Shipping & docs | BL / Telex released | ex-fty + 7d |
| Shipping & docs | TC / test cert sent | ex-fty + 10d |
| Shipping & docs | Payment realised | per terms |

## 11. Dashboards & Reports (role-aware, all exportable to Excel)

- **Open Order Book** — replaces *Open PO's* tab; filter by factory/buyer/ex-fty window.
- **Critical Path board** — T&A milestones with RAG; overdue / due-this-week.
- **Shipment Tracker** — replaces *Shipped* tab; container/BL/telex/cartons.
- **Exception widgets** — ex-fty due in 7d, docs pending before shipment, telex not released, payment overdue.
- **Finance** — AR/AP aging, margin by buyer/factory/period, realised vs pending margin.
- **Management KPIs** — On-Time-Delivery %, order-value pipeline, factory load, margin trend.

## 12. Non-Functional Requirements

- **Security:** Auth.js, hashed passwords, role-guarded server actions (checked server-side), private document storage via signed URLs, least-privilege.
- **Audit log:** every create/update/delete records who/when/before→after.
- **Data integrity:** unique constraints, enum statuses, FKs, soft-delete on master data, Zod validation.
- **Error handling:** typed results, friendly messages, server-action error boundaries.
- **Testing (TDD):** unit (margin math, T&A back-scheduling, balance-qty), integration (server actions vs test DB), Playwright E2E (create order → ship → invoice).
- **Ops:** managed Postgres auto-backups, object-storage versioning, paginated/indexed queries, env-based config, CI on push.
- **Currency:** dual USD/BDT with FX-rate table; USD is the trade currency.

## 13. Phased Delivery Roadmap (spec = full platform; build = safe order)

| Phase | Delivers | Independently usable |
| --- | --- | --- |
| 0 — Foundation | Auth, users, roles, master data, Excel import, audit log | Yes |
| 1 — Order core | PO intake, order lines, Open Order Book, lots | Yes (replaces Open PO sheet) |
| 2 — Critical Path | T&A engine, sampling, production & QC | Yes (differentiator) |
| 3 — Shipment & docs | Shipment/logistics, documents & compliance | Yes (replaces Shipped sheet) |
| 4 — Money | Costing & margin, finance (invoices, payments, AR/AP) | Yes (full financials) |
| 5 — Insight | Dashboards, exceptions, KPIs, notifications, reports | Yes (management layer) |

## 14. Assumptions

1. USD is the trade currency (buyer/factory FOB & margin); BDT for local expenses; dual-currency display.
2. v1 is seeded by importing the current Excel workbook.
3. Light approvals fit a lean team: Accounts approves costing/PI; Admin can lock/close orders. No heavy multi-step sign-off chains.
4. Merchandiser can view/draft costing & margins (not hidden) — tunable via permission config.
5. Management is strictly read-only.

## 15. Glossary

- **RMG** — Ready-Made Garments.
- **Buying / merchandising house** — sourcing intermediary between brand and factory.
- **CMT** — Cut-Make-Trim factory.
- **FOB** — Free On Board price. **NET FOB** = factory's price net of buying-house commission.
- **Back-to-back** — buy from factory / sell to buyer on linked invoices; the gap is the margin.
- **T&A / Critical Path** — Time & Action calendar of order milestones.
- **PP sample** — Pre-Production sample (buyer sign-off gate before bulk).
- **AQL** — Acceptable Quality Limit (inspection standard).
- **CRD** — Customer Requested Date (required delivery date).
- **Ex-factory** — date goods leave the factory for shipment.
- **BL** — Bill of Lading. **Telex release** — surrendered BL so consignee collects without originals.
- **TC** — tracked transfer/compliance document (e.g. test certificate) — exact definition to confirm with business.
- **LC / TT** — Letter of Credit / Telegraphic Transfer (payment methods).
- **AR/AP** — Accounts Receivable / Accounts Payable.

## 16. Open Questions (confirm during implementation)

1. Exact meaning of the **"TC"** column (test certificate vs telex copy vs transfer doc) — affects the document checklist labels.
2. Default **payment terms** per buyer (drives "payment realised" milestone offset).

**Resolved:** Size breakdown = **full size-wise quantity** (qty per individual size, with optional per-size pricing for larger sizes). See §4 and §8.
