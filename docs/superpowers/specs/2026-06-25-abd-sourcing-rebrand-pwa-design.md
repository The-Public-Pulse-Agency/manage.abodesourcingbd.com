# ABD Sourcing rebrand + PWA + glassy auth redesign

Date: 2026-06-25
Status: Approved (design) — pending spec review

## Goal

Rebrand the app from "Pulse OMS" to **ABD Sourcing** (company behind abodesourcingbd.com),
make it an installable PWA with a branded favicon/icons, and restyle the auth pages
(sign-in / sign-up) to be more gradient, glassy, and 3D.

## Decisions (confirmed with user)

- **Wordmark:** `ABD` in the red→orange brand gradient + `Sourcing` in ink. Tagline: "Order & Merchandising".
- **Logo:** code-generated monogram (no image asset). Monogram: **ABD** (the brand acronym; bold mono with tight letter-spacing so it stays legible down to favicon size).
- **Scope:** app-wide wordmark rebrand + auth-page redesign + favicon/PWA + metadata.
- **PWA:** installable only — manifest + branded icons + theme color. **No service worker.**
- **Auth visual direction:** frosted-glass card floating on an animated red→orange→ink gradient mesh, with a 3D monogram badge and a gradient "Sign in" button.
- **Sign-in footer:** remove "New here? Create a company"; add "Visit abodesourcingbd.com →"
  (`https://www.abodesourcingbd.com/`, opens in a new tab, `rel="noopener noreferrer"`).
  The `/signup` route stays but is no longer linked from `/login`.

## Brand colors (unchanged tokens)

- Accent / brand red: `#d32f2f` (`--accent`)
- Brand gradient: `linear-gradient(120deg, #d32f2f, #f0663f)` (`.brand-gradient`)
- Paper bg: `#f4f6f9`; surface: `#ffffff`; ink: `#1e293b`.

## Components

### `src/components/brand-mark.tsx`

Two small presentational components (DRY — replaces ~6 inline wordmarks):

- `BrandMark` — the wordmark.
  - Props: `size?: "sm" | "base" | "lg"` (default `"base"`), `tagline?: string`, `className?: string`.
  - Renders: `<span class="brand-gradient font-mono font-bold tracking-tight">ABD</span>` + `<span class="font-semibold tracking-tight"> Sourcing</span>`; size maps to text size (sm→`text-sm`, base→`text-base`, lg→`text-2xl`). Optional tagline rendered below in `text-xs text-ink-soft`.
- `BrandBadge` — the 3D monogram square.
  - Props: `className?: string` (controls size; default `h-11 w-11`).
  - Gradient background (`.brand-badge` class), white mono bold "ABD" (tight tracking), inset top highlight + drop shadow for 3D.

### Wordmark replacement sites

Replace inline "Pulse OMS" with `<BrandMark>` in:
`src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/components/app-sidebar.tsx` (desktop + mobile), `src/app/admin/page.tsx`, `src/components/billing/subscription-paywall.tsx`.

## Auth redesign (login + signup)

CSS additions in `src/app/globals.css`:

- `.auth-mesh` — enriched background: layered radial gradients (brand red top-left, orange mid, ink bottom-right) over `--paper`, with a slow `@keyframes mesh-drift` animation wrapped in `@media (prefers-reduced-motion: no-preference)`.
- `.glass-card` — frosted card: `backdrop-filter: blur(18px) saturate(150%)`, semi-opaque surface, **gradient hairline border** via the padding-box/border-box double-background technique, plus a deep layered shadow (extends `.elevate-lg`).
- `.btn-brand` — gradient submit button: brand gradient bg, white text, rounded, shadow; `:active` presses down (`translateY(1px)` + reduced shadow) for 3D feedback. Respects `:disabled`.
- `.brand-badge` — monogram square styles (gradient bg, inset highlight, drop shadow).

Page structure (both pages): `main.auth-mesh` → centered `div.glass-card` → header (`BrandBadge` + `BrandMark size="lg"` + tagline) → form → footer link(s).

The submit buttons in `src/app/login/login-form.tsx` and `src/app/signup/signup-form.tsx` adopt `.btn-brand`.

## Favicon + PWA

- `src/app/icon.tsx` — `ImageResponse`, 32×32, white "ABD" (bold, tight tracking) on brand-gradient rounded square → favicon.
- `src/app/apple-icon.tsx` — `ImageResponse`, 180×180, same monogram → iOS home-screen icon.
- `src/app/icon-192.png/route.ts` and `src/app/icon-512.png/route.ts` — Route Handlers returning `ImageResponse` PNGs at 192 and 512 (stable URLs for the manifest; 512 used as `purpose: "any maskable"` with padded safe area).
- Remove the stale `src/app/favicon.ico` (old branding) so the generated `icon.tsx` is the favicon.
- `src/app/manifest.ts` — `MetadataRoute.Manifest`: `name: "ABD Sourcing"`, `short_name: "ABD"`, `description`, `start_url: "/"`, `display: "standalone"`, `background_color: "#f4f6f9"`, `theme_color: "#d32f2f"`, icons referencing `/icon-192.png` and `/icon-512.png`.

## Metadata

`src/app/layout.tsx`:
- `metadata.title`: `"ABD Sourcing — Order & Merchandising"`; `metadata.description`: updated to ABD Sourcing.
- `metadata.appleWebApp`: `{ capable: true, title: "ABD Sourcing", statusBarStyle: "default" }`.
- Add `export const viewport: Viewport = { themeColor: "#d32f2f" }` (Next 16 moved `themeColor` to the `viewport` export). The manifest is auto-linked from `app/manifest.ts`.

## Remaining blast radius

- Excel `wb.creator = "Pulse OMS"` → `"ABD Sourcing"` in `src/lib/documents/{po-excel,invoice-excel,commission-excel}.ts`.
- Alert email label "Pulse OMS" → "ABD Sourcing" in `src/lib/alerts/generate.ts`.
- Code comments mentioning Pulse/OMS: left as-is (cosmetic, non-user-facing).

## Verification

- TDD the one pure unit: `manifest.ts` returns the expected name/short_name/theme_color/icons (vitest, node env).
- `tsc --noEmit` clean; `npm run lint` clean on changed files; `next build` succeeds (validates `icon.tsx`/`manifest.ts`/route handlers).
- Full test suite stays green (currently 226/226).
- Visual check: load `/login` in a real browser at mobile + desktop widths and screenshot; confirm wordmark, badge, gradient mesh, glass card, gradient button, removed signup link, and working website link.

## Out of scope

- No service worker / offline support (installable PWA only).
- Split-panel auth layout (not chosen).
- Removing the `/signup` route (kept; just unlinked from login).
- Dark mode.
