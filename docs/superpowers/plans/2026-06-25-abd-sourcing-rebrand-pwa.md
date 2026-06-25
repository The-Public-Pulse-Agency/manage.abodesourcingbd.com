# ABD Sourcing Rebrand + PWA + Glassy Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand "Pulse OMS" → "ABD Sourcing", make the app an installable PWA with a branded "ABD" monogram favicon/icons, and restyle the auth pages (gradient mesh + frosted glass + 3D).

**Architecture:** One shared `BrandMark`/`BrandBadge` component replaces all inline wordmarks. New CSS utility classes (`.auth-mesh`, `.glass-card`, `.btn-brand`, `.brand-badge`) drive the auth redesign. Code-generated `ImageResponse` icons (`app/icon.tsx`, `app/apple-icon.tsx`, `/icon-192`, `/icon-512`) + `app/manifest.ts` provide the PWA. Metadata/viewport in the root layout.

**Tech Stack:** Next 16 (App Router), React 19, Tailwind v4 (zero-config, `@theme inline` tokens), `next/og` `ImageResponse`, vitest.

## Global Constraints

- Brand name (wordmark): `ABD` (brand gradient) + ` Sourcing` (ink). Tagline: `Order & Merchandising`.
- Monogram (icons + badge): `ABD`, bold mono, tight tracking.
- Brand red `--accent` = `#d32f2f`; brand gradient = `linear-gradient(135deg, #d32f2f, #f0663f)`; paper bg `#f4f6f9`.
- PWA: installable only — manifest + icons + `theme_color`. NO service worker.
- Website link target: `https://www.abodesourcingbd.com/` (new tab, `rel="noopener noreferrer"`).
- Tailwind v4: no config file; new shared styles go in `src/app/globals.css`.
- Next 16: `themeColor` belongs in the `viewport` export, not `metadata`.
- Do NOT push to `main`; commit locally only (user authorizes pushes per-commit).

---

### Task 1: Brand components + auth CSS utilities

**Files:**
- Create: `src/components/brand-mark.tsx`
- Modify: `src/app/globals.css` (append new classes after `.glass`, before scrollbars block is fine; append at end is acceptable)

**Interfaces:**
- Produces: `BrandMark({ size?: "sm"|"base"|"lg", tagline?: string, className?: string })`, `BrandBadge({ className?: string })` — both default exports-free named exports from `@/components/brand-mark`.
- Produces CSS classes: `.brand-badge`, `.auth-mesh`, `.glass-card`, `.btn-brand`.

- [ ] **Step 1: Create the brand component**

```tsx
// src/components/brand-mark.tsx
const SIZE: Record<"sm" | "base" | "lg", string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-2xl",
};

export function BrandMark({
  size = "base",
  tagline,
  className = "",
}: {
  size?: "sm" | "base" | "lg";
  tagline?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className={`${SIZE[size]} tracking-tight`}>
        <span className="brand-gradient font-mono font-bold">ABD</span>
        <span className="font-semibold"> Sourcing</span>
      </span>
      {tagline && <span className="mt-0.5 text-xs font-normal text-ink-soft">{tagline}</span>}
    </span>
  );
}

export function BrandBadge({ className = "h-11 w-11 text-xs" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-badge inline-flex items-center justify-center rounded-xl font-mono font-bold text-white ${className}`}
    >
      ABD
    </span>
  );
}
```

- [ ] **Step 2: Append the CSS utilities to `src/app/globals.css`** (add before the final `@media (prefers-reduced-motion: reduce)` block)

```css
/* ── ABD brand surfaces ─────────────────────────────────────────────── */

/* 3D monogram badge — gradient square, inner highlight + drop shadow. */
.brand-badge {
  background: linear-gradient(135deg, var(--accent), #f0663f);
  letter-spacing: 0.02em;
  box-shadow:
    0 6px 16px -6px rgba(211, 47, 47, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -2px 6px rgba(0, 0, 0, 0.18);
}

/* Auth backdrop — layered gradient mesh with a slow drift. */
.auth-mesh {
  background:
    radial-gradient(800px 500px at 10% -10%, rgba(211, 47, 47, 0.18), transparent 55%),
    radial-gradient(700px 480px at 95% 0%, rgba(240, 102, 63, 0.16), transparent 55%),
    radial-gradient(900px 600px at 85% 110%, rgba(30, 41, 59, 0.16), transparent 55%),
    var(--paper);
}
@media (prefers-reduced-motion: no-preference) {
  .auth-mesh {
    background-size: 200% 200%, 200% 200%, 200% 200%, 100% 100%;
    animation: mesh-drift 18s ease-in-out infinite alternate;
  }
}
@keyframes mesh-drift {
  from { background-position: 0% 0%, 100% 0%, 100% 100%, 0 0; }
  to   { background-position: 30% 20%, 70% 25%, 55% 80%, 0 0; }
}

/* Frosted glass card — blur, gradient hairline border, deep 3D shadow. */
.glass-card {
  border: 1px solid transparent;
  background:
    linear-gradient(color-mix(in srgb, var(--surface) 82%, transparent), color-mix(in srgb, var(--surface) 82%, transparent)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 55%, transparent), color-mix(in srgb, var(--ink) 22%, transparent)) border-box;
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow:
    0 30px 60px -22px rgba(15, 23, 42, 0.32),
    0 12px 24px -12px rgba(211, 47, 47, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Brand-gradient 3D button. */
.btn-brand {
  background: linear-gradient(135deg, var(--accent), #f0663f);
  color: #fff;
  border-radius: 8px;
  font-weight: 600;
  box-shadow:
    0 10px 22px -10px rgba(211, 47, 47, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.btn-brand:hover:not(:disabled) { filter: brightness(1.05); }
.btn-brand:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 4px 12px -8px rgba(211, 47, 47, 0.6); }
.btn-brand:disabled { opacity: 0.6; cursor: not-allowed; }
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/brand-mark.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/brand-mark.tsx src/app/globals.css
git commit -m "feat(brand): BrandMark/BrandBadge components + auth glass CSS"
```

---

### Task 2: PWA manifest (TDD)

**Files:**
- Create: `src/app/manifest.ts`
- Test: `src/app/manifest.test.ts`

**Interfaces:**
- Produces: default `manifest(): MetadataRoute.Manifest` referencing `/icon-192` and `/icon-512` (created in Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/manifest.test.ts
import { describe, it, expect } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("describes an installable ABD Sourcing PWA", () => {
    const m = manifest();
    expect(m.name).toBe("ABD Sourcing");
    expect(m.short_name).toBe("ABD");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.theme_color).toBe("#d32f2f");
    expect(m.background_color).toBe("#f4f6f9");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it; expect FAIL** — `npx vitest run src/app/manifest.test.ts` → cannot find `./manifest`.

- [ ] **Step 3: Implement**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABD Sourcing",
    short_name: "ABD",
    description: "Order & merchandising management — ABD Sourcing",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#d32f2f",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 4: Run it; expect PASS** — `npx vitest run src/app/manifest.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/manifest.ts src/app/manifest.test.ts
git commit -m "feat(pwa): web app manifest (installable, ABD branding)"
```

---

### Task 3: Branded monogram icons (favicon, apple, 192, 512)

**Files:**
- Create: `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/icon-192/route.tsx`, `src/app/icon-512/route.tsx`
- Delete: `src/app/favicon.ico`

**Interfaces:**
- Produces stable URLs `/icon-192` and `/icon-512` (PNG) consumed by `manifest.ts`; `/icon` (favicon) and `/apple-icon` via Next conventions.

- [ ] **Step 1: favicon icon** — `src/app/icon.tsx`

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#d32f2f,#f0663f)", color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: -1, borderRadius: 7, fontFamily: "monospace" }}>
        ABD
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: apple icon** — `src/app/apple-icon.tsx`

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#d32f2f,#f0663f)", color: "#fff", fontSize: 62, fontWeight: 700, letterSpacing: -3, fontFamily: "monospace" }}>
        ABD
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 3: 192 route** — `src/app/icon-192/route.tsx`

```tsx
import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#d32f2f,#f0663f)", color: "#fff", fontSize: 66, fontWeight: 700, letterSpacing: -3, fontFamily: "monospace" }}>
        ABD
      </div>
    ),
    { width: 192, height: 192 },
  );
}
```

- [ ] **Step 4: 512 route** — `src/app/icon-512/route.tsx`

```tsx
import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#d32f2f,#f0663f)", color: "#fff", fontSize: 180, fontWeight: 700, letterSpacing: -8, fontFamily: "monospace" }}>
        ABD
      </div>
    ),
    { width: 512, height: 512 },
  );
}
```

- [ ] **Step 5: Remove stale favicon** — `git rm src/app/favicon.ico`

- [ ] **Step 6: Commit**

```bash
git add src/app/icon.tsx src/app/apple-icon.tsx src/app/icon-192/route.tsx src/app/icon-512/route.tsx
git commit -m "feat(pwa): code-generated ABD monogram icons; drop stale favicon"
```

---

### Task 4: Metadata + theme color

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update metadata + add viewport.** Replace the `import type { Metadata }` line with `import type { Metadata, Viewport } from "next";` and replace the `metadata` export with:

```tsx
export const metadata: Metadata = {
  title: "ABD Sourcing — Order & Merchandising",
  description: "Order & merchandising management for ABD Sourcing",
  appleWebApp: { capable: true, title: "ABD Sourcing", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#d32f2f" };
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(pwa): ABD metadata + theme color (viewport)"
```

---

### Task 5: Auth pages redesign (login + signup + forms)

**Files:**
- Modify: `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/login/login-form.tsx`, `src/app/signup/signup-form.tsx`

- [ ] **Step 1: Rewrite `src/app/login/page.tsx`**

```tsx
import { BrandMark, BrandBadge } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  return (
    <main className="auth-mesh flex min-h-screen items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm rounded-2xl p-7">
        <div className="flex flex-col items-center text-center">
          <BrandBadge className="h-12 w-12 text-sm" />
          <div className="mt-3"><BrandMark size="lg" tagline="Order & Merchandising" /></div>
        </div>
        {welcome && (
          <p className="mt-5 rounded-sm bg-ok-soft px-3 py-2 text-sm text-ok">
            Company created — sign in with your new admin account.
          </p>
        )}
        <h1 className="mt-6 mb-4 text-lg font-semibold tracking-tight">Sign in</h1>
        <LoginForm />
        <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-soft">
          <a href="https://www.abodesourcingbd.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
            Visit abodesourcingbd.com →
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/login/login-form.tsx`**

```tsx
"use client";

import { loginAction } from "@/lib/auth/actions";

export function LoginForm() {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input name="email" type="email" required className="input w-full" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Password
        <input name="password" type="password" required className="input w-full" />
      </label>
      <button type="submit" className="btn-brand mt-1 w-full px-3 py-2.5 text-sm">Sign in</button>
    </form>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/signup/page.tsx`**

```tsx
import Link from "next/link";
import { BrandMark, BrandBadge } from "@/components/brand-mark";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  return (
    <main className="auth-mesh flex min-h-screen items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm rounded-2xl p-7">
        <div className="flex flex-col items-center text-center">
          <BrandBadge className="h-12 w-12 text-sm" />
          <div className="mt-3"><BrandMark size="lg" tagline="Order & Merchandising" /></div>
        </div>
        <h1 className="mt-6 mb-4 text-lg font-semibold tracking-tight">Create your company</h1>
        <SignUpForm />
        <p className="mt-6 border-t border-line pt-4 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Update the submit button in `src/app/signup/signup-form.tsx`.** Replace the button at line 28 (`className="w-full rounded-sm bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"`) with:

```tsx
      <button type="submit" disabled={pending} className="btn-brand w-full px-3 py-2.5 text-sm">
        {pending ? "Creating…" : "Create company & start free trial"}
      </button>
```

- [ ] **Step 5: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/app/login src/app/signup` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/signup
git commit -m "feat(auth): glassy gradient redesign; remove signup link, add website link"
```

---

### Task 6: Wordmark blast radius (sidebar, admin, paywall)

**Files:**
- Modify: `src/components/app-sidebar.tsx` (2 spots), `src/app/admin/page.tsx`, `src/components/billing/subscription-paywall.tsx`

- [ ] **Step 1: app-sidebar desktop brand.** Replace the two `<span>` wordmark lines inside the desktop `brand` Link (currently `<span className="brand-gradient font-mono text-base font-bold tracking-tight">Pulse</span><span className="text-sm font-semibold tracking-tight">OMS</span>`) with `<BrandMark size="base" />`. Add `import { BrandMark } from "@/components/brand-mark";` at the top.

- [ ] **Step 2: app-sidebar mobile brand.** Replace the mobile two-span wordmark (`...text-sm font-bold...Pulse</span><span...>OMS</span>`) with `<BrandMark size="sm" />`.

- [ ] **Step 3: admin brand.** In `src/app/admin/page.tsx`, replace `<span className="font-mono text-base font-bold tracking-tight text-accent">Pulse</span><span className="text-sm font-semibold">OMS</span>` with `<BrandMark size="base" />` (keep the adjacent "Platform" badge span). Add the import. Also update the description text on line ~51 if it says "Pulse OMS" → "ABD Sourcing".

- [ ] **Step 4: paywall brand.** In `src/components/billing/subscription-paywall.tsx`, replace `<span className="font-mono text-sm font-bold tracking-tight text-accent">Pulse</span><span className="ml-2 text-sm font-semibold tracking-tight">OMS</span>` with `<BrandMark size="sm" />`. Add the import.

- [ ] **Step 5: Typecheck + lint** — `npx tsc --noEmit && npx eslint src/components/app-sidebar.tsx src/app/admin/page.tsx src/components/billing/subscription-paywall.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-sidebar.tsx src/app/admin/page.tsx src/components/billing/subscription-paywall.tsx
git commit -m "feat(brand): use BrandMark in sidebar, admin, paywall"
```

---

### Task 7: Non-UI blast radius (Excel creators + alert email)

**Files:**
- Modify: `src/lib/documents/po-excel.ts`, `src/lib/documents/invoice-excel.ts`, `src/lib/documents/commission-excel.ts`, `src/lib/alerts/generate.ts`

- [ ] **Step 1:** In each of the three `*-excel.ts` files, change `wb.creator = "Pulse OMS"` → `wb.creator = "ABD Sourcing"`.

- [ ] **Step 2:** In `src/lib/alerts/generate.ts` (~line 80), change the `"Pulse OMS — ${messages.length} new alert(s)"` label to `"ABD Sourcing — ${messages.length} new alert(s)"`.

- [ ] **Step 3: Run the docs/alerts tests if any** — `npx vitest run src/lib/documents src/lib/alerts` → PASS (or no tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/documents src/lib/alerts/generate.ts
git commit -m "chore(brand): ABD Sourcing in Excel creator + alert email"
```

---

### Task 8: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm test` → all green (was 226; +1 manifest test = 227).
- [ ] **Step 3:** `npm run build` → `✓ Compiled successfully`; routes include `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/icon-192`, `/icon-512`.
- [ ] **Step 4:** Visual check — run the app and screenshot `/login` at mobile (390px) + desktop widths. Confirm: ABD Sourcing wordmark, ABD monogram badge, gradient mesh, frosted glass card, gradient "Sign in" button, NO "Create a company" link, working "Visit abodesourcingbd.com" link. Verify the browser tab shows the ABD favicon.
- [ ] **Step 5:** (Optional) final summary commit if any tweaks were needed.

## Self-Review

- **Spec coverage:** wordmark (T1, T5, T6), monogram icons/favicon (T3), manifest/PWA (T2), theme color/metadata (T4), auth redesign + remove signup link + website link (T5), non-UI blast radius (T7), verification (T8). All spec sections mapped. ✓
- **Placeholder scan:** all steps carry real code/commands. ✓
- **Type consistency:** `BrandMark`/`BrandBadge` signatures defined in T1 and used identically in T5/T6; manifest icon URLs `/icon-192` `/icon-512` match the route folders in T3. ✓
