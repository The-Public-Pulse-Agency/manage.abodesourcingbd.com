# Phase 0a — Project Foundation & Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ABD OMS Next.js application with a working login, role-based access control (RBAC), an audit log, and an authenticated app shell — the foundation every later module builds on.

**Architecture:** Full-stack Next.js (App Router) monolith. Business logic runs in Server Actions / route handlers, guarded server-side by a config-driven permission matrix. PostgreSQL via Prisma. Auth.js (NextAuth v5) with a Credentials provider and JWT sessions carrying the user's role. Every write goes through an audit-log helper. Tests: Vitest (unit/integration against a test Postgres DB) and Playwright (E2E).

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, Tailwind CSS + shadcn/ui, PostgreSQL 16, Prisma, Auth.js (next-auth@5), bcryptjs, Zod, Vitest, Playwright, Docker Compose (local Postgres).

**Scope of this plan:** project scaffolding, DB + Prisma, password hashing, permission matrix, Auth.js login, server-side permission guard, audit log, user management server actions, authenticated app shell with role-based nav, and an E2E smoke test. Master data and Excel import are **Phase 0b** (separate plan). Currency/FX, orders, T&A, etc. are later phases.

**Conventions:**
- Package manager: `npm`.
- Source root: `src/`. Path alias `@/*` → `src/*` (Next.js default).
- Run unit/integration tests: `npm test`. Run a single test: `npm test -- <path>`.
- Test DB runs on port 5433; dev DB on 5432 (see `docker-compose.yml`).
- Commit after every task using the commit step shown.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `docker-compose.yml` | Local dev + test Postgres containers |
| `.env`, `.env.test`, `.env.example` | DB URL + auth secret per environment |
| `prisma/schema.prisma` | `Role` enum, `User`, `AuditLog` models |
| `prisma/seed.ts` | Seed the initial Admin user |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/auth/password.ts` | `hashPassword` / `verifyPassword` (bcryptjs) |
| `src/lib/auth/permissions.ts` | Roles, modules, actions, permission matrix, `can()` |
| `src/lib/auth/guard.ts` | `getCurrentUser`, `requirePermission` server-side guard |
| `src/auth.ts` | Auth.js config (Credentials provider, JWT callbacks) |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth.js route handler |
| `src/middleware.ts` | Redirect unauthenticated users to `/login` |
| `src/lib/audit.ts` | `recordAudit()` helper |
| `src/lib/users/actions.ts` | `createUser`, `listUsers`, `setUserActive` server actions |
| `src/lib/users/schema.ts` | Zod schemas for user input |
| `src/app/login/page.tsx` | Login form |
| `src/app/(app)/layout.tsx` | Authenticated shell (nav + sign-out) |
| `src/app/(app)/dashboard/page.tsx` | Landing page after login |
| `src/app/(app)/users/page.tsx` | User management (Admin only) |
| `src/components/app-nav.tsx` | Role-filtered navigation |
| `vitest.config.ts`, `src/test/setup.ts`, `src/test/db.ts` | Test runner config + DB reset helper |
| `playwright.config.ts`, `e2e/auth.spec.ts` | E2E config + login smoke test |

---

## Task 1: Scaffold the Next.js app and initialize git

**Files:**
- Create: project files via `create-next-app`
- Create: `.gitignore` (generated), first commit

- [ ] **Step 1: Create the Next.js app in the current directory**

Run (from the project root `ABDorderManangementSystem`):

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

When prompted that the directory is not empty (the `.xlsx`, `docs/`, `.remember/` exist), choose to continue. Expected: a Next.js app is generated with `src/app/`, `package.json`, `tsconfig.json`, `tailwind.config.ts`.

- [ ] **Step 2: Initialize git and make the first commit**

Run:

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

Expected: a commit is created on branch `main` (or `master`).

- [ ] **Step 3: Verify the dev server boots**

Run:

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with no errors. Stop it with Ctrl-C.

- [ ] **Step 4: Commit (no-op if clean)** — already committed in Step 2.

---

## Task 2: Add tooling — Postgres, Prisma, testing, validation

**Files:**
- Create: `docker-compose.yml`
- Create: `.env`, `.env.test`, `.env.example`
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install @prisma/client bcryptjs zod next-auth@beta
npm install -D prisma @types/bcryptjs vitest @vitejs/plugin-react vite-tsconfig-paths dotenv @playwright/test
```

Expected: packages install without peer-dependency errors.

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: abd
      POSTGRES_PASSWORD: abd
      POSTGRES_DB: abd_oms
    ports: ["5432:5432"]
    volumes: ["abd_pgdata:/var/lib/postgresql/data"]
  db_test:
    image: postgres:16
    environment:
      POSTGRES_USER: abd
      POSTGRES_PASSWORD: abd
      POSTGRES_DB: abd_oms_test
    ports: ["5433:5432"]
volumes:
  abd_pgdata:
```

- [ ] **Step 3: Create env files**

`.env`:

```bash
DATABASE_URL="postgresql://abd:abd@localhost:5432/abd_oms?schema=public"
AUTH_SECRET="dev-secret-change-me-32chars-minimum-0001"
AUTH_TRUST_HOST="true"
```

`.env.test`:

```bash
DATABASE_URL="postgresql://abd:abd@localhost:5433/abd_oms_test?schema=public"
AUTH_SECRET="test-secret-change-me-32chars-minimum-001"
AUTH_TRUST_HOST="true"
```

`.env.example`:

```bash
DATABASE_URL="postgresql://abd:abd@localhost:5432/abd_oms?schema=public"
AUTH_SECRET="generate-with: openssl rand -base64 32"
AUTH_TRUST_HOST="true"
```

- [ ] **Step 4: Start the databases**

Run:

```bash
docker compose up -d
```

Expected: `db` and `db_test` containers are running (`docker compose ps`).

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 6: Create `src/test/setup.ts`**

```ts
import { config } from "dotenv";
config({ path: ".env.test", override: true });
```

- [ ] **Step 7: Add scripts to `package.json`**

Add these entries to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest",
"db:migrate": "prisma migrate dev",
"db:push:test": "dotenv -e .env.test -- prisma migrate deploy",
"db:seed": "prisma db seed",
"e2e": "playwright test"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Prisma, Vitest, Playwright, Postgres compose, env"
```

---

## Task 3: Prisma schema (User, AuditLog) + client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MERCHANDISER
  ACCOUNTS
  MANAGEMENT
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  entityType String
  entityId   String
  action     String
  before     Json?
  after      Json?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
}
```

- [ ] **Step 2: Create the migration on the dev DB**

Run:

```bash
npx prisma migrate dev --name init_users_audit
```

Expected: a migration is created under `prisma/migrations/` and the dev DB has `User` and `AuditLog` tables. Prisma Client is generated.

- [ ] **Step 3: Apply the migration to the test DB**

Run:

```bash
npx dotenv -e .env.test -- prisma migrate deploy
```

Expected: "All migrations have been successfully applied" against the test DB.

- [ ] **Step 4: Create `src/lib/db.ts` (Prisma singleton)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: prisma schema for User + AuditLog, prisma client singleton"
```

---

## Task 4: Password hashing utility (TDD)

**Files:**
- Test: `src/lib/auth/password.test.ts`
- Create: `src/lib/auth/password.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/auth/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes a password to a non-plaintext string", async () => {
    const hash = await hashPassword("s3cret!");
    expect(hash).not.toBe("s3cret!");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(await verifyPassword("s3cret!", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/auth/password.test.ts`
Expected: FAIL — cannot find module `./password`.

- [ ] **Step 3: Write the minimal implementation**

`src/lib/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/auth/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: password hashing utility with bcryptjs"
```

---

## Task 5: Permission matrix + `can()` (TDD)

**Files:**
- Test: `src/lib/auth/permissions.test.ts`
- Create: `src/lib/auth/permissions.ts`

This encodes the spec §7 role/permission matrix as config.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { can } from "./permissions";

describe("permission matrix", () => {
  it("Admin can create users", () => {
    expect(can("ADMIN", "users", "create")).toBe(true);
  });

  it("Merchandiser cannot create users", () => {
    expect(can("MERCHANDISER", "users", "create")).toBe(false);
  });

  it("Merchandiser can create orders", () => {
    expect(can("MERCHANDISER", "orders", "create")).toBe(true);
  });

  it("Accounts can approve costing", () => {
    expect(can("ACCOUNTS", "costing", "approve")).toBe(true);
  });

  it("Merchandiser cannot approve costing", () => {
    expect(can("MERCHANDISER", "costing", "approve")).toBe(false);
  });

  it("Management is view-only on orders", () => {
    expect(can("MANAGEMENT", "orders", "view")).toBe(true);
    expect(can("MANAGEMENT", "orders", "edit")).toBe(false);
  });

  it("Merchandiser has no access to the audit log", () => {
    expect(can("MERCHANDISER", "auditLog", "view")).toBe(false);
  });

  it("Admin can view the audit log but not delete it", () => {
    expect(can("ADMIN", "auditLog", "view")).toBe(true);
    expect(can("ADMIN", "auditLog", "delete")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/auth/permissions.test.ts`
Expected: FAIL — cannot find module `./permissions`.

- [ ] **Step 3: Write the implementation**

`src/lib/auth/permissions.ts`:

```ts
export const ROLES = ["ADMIN", "MERCHANDISER", "ACCOUNTS", "MANAGEMENT"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = [
  "users",
  "masterData",
  "orders",
  "criticalPath",
  "sampling",
  "productionQc",
  "costing",
  "shipment",
  "documents",
  "finance",
  "dashboards",
  "auditLog",
] as const;
export type Module = (typeof MODULES)[number];

// Shorthands for common action sets.
const VIEW: Action[] = ["view"];
const CRUD: Action[] = ["view", "create", "edit", "delete"];

type Matrix = Record<Role, Partial<Record<Module, Action[]>>>;

// Mirrors spec §7. Anything absent = no access.
export const PERMISSIONS: Matrix = {
  ADMIN: {
    users: CRUD,
    masterData: CRUD,
    orders: CRUD,
    criticalPath: CRUD,
    sampling: CRUD,
    productionQc: CRUD,
    costing: ["view", "create", "edit", "delete", "approve"],
    shipment: CRUD,
    documents: CRUD,
    finance: CRUD,
    dashboards: VIEW,
    auditLog: VIEW,
  },
  MERCHANDISER: {
    masterData: ["view", "create", "edit"],
    orders: CRUD,
    criticalPath: CRUD,
    sampling: CRUD,
    productionQc: CRUD,
    costing: ["view", "create", "edit"],
    shipment: CRUD,
    documents: CRUD,
    finance: VIEW,
    dashboards: VIEW,
  },
  ACCOUNTS: {
    masterData: VIEW,
    orders: VIEW,
    criticalPath: VIEW,
    productionQc: VIEW,
    costing: ["view", "create", "edit", "delete", "approve"],
    shipment: VIEW,
    documents: ["view", "create", "edit"],
    finance: CRUD,
    dashboards: VIEW,
  },
  MANAGEMENT: {
    users: VIEW,
    masterData: VIEW,
    orders: VIEW,
    criticalPath: VIEW,
    sampling: VIEW,
    productionQc: VIEW,
    costing: VIEW,
    shipment: VIEW,
    documents: VIEW,
    finance: VIEW,
    dashboards: VIEW,
    auditLog: VIEW,
  },
};

export function can(role: Role, module: Module, action: Action): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/auth/permissions.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: config-driven RBAC permission matrix with can()"
```

---

## Task 6: Auth.js configuration (Credentials provider, JWT with role)

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Create the Auth.js config**

`src/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Create the route handler**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Extend the session type**

`types/next-auth.d.ts`:

```ts
import type { Role } from "@/lib/auth/permissions";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
```

- [ ] **Step 4: Add middleware to protect the app**

`src/middleware.ts`:

```ts
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
  if (!isLoggedIn && !isPublic) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Auth.js credentials login with role in JWT/session + route protection"
```

---

## Task 7: Server-side permission guard (TDD)

**Files:**
- Test: `src/lib/auth/guard.test.ts`
- Create: `src/lib/auth/guard.ts`

The guard is the single choke-point every server action calls. We test the pure
authorization decision by injecting a user, so the test does not need a live session.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assertPermission, ForbiddenError } from "./guard";

describe("assertPermission", () => {
  it("allows a permitted action", () => {
    expect(() =>
      assertPermission({ id: "u1", role: "ADMIN" }, "users", "create"),
    ).not.toThrow();
  });

  it("throws ForbiddenError for a denied action", () => {
    expect(() =>
      assertPermission({ id: "u2", role: "MERCHANDISER" }, "users", "create"),
    ).toThrow(ForbiddenError);
  });

  it("throws when there is no user", () => {
    expect(() => assertPermission(null, "orders", "view")).toThrow(ForbiddenError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/auth/guard.test.ts`
Expected: FAIL — cannot find module `./guard`.

- [ ] **Step 3: Write the implementation**

`src/lib/auth/guard.ts`:

```ts
import { auth } from "@/auth";
import { can, type Action, type Module, type Role } from "./permissions";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = { id: string; role: Role };

/** Pure authorization check — throws if the user may not perform the action. */
export function assertPermission(
  user: SessionUser | null | undefined,
  module: Module,
  action: Action,
): SessionUser {
  if (!user) throw new ForbiddenError("Not authenticated");
  if (!can(user.role, module, action)) {
    throw new ForbiddenError(`${user.role} cannot ${action} ${module}`);
  }
  return user;
}

/** Reads the current session user (or null). For use inside server actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return { id: session.user.id, role: session.user.role };
}

/** Session-aware guard for server actions: loads the user and asserts. */
export async function requirePermission(
  module: Module,
  action: Action,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  return assertPermission(user, module, action);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/auth/guard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: server-side permission guard (assertPermission/requirePermission)"
```

---

## Task 8: Audit-log helper (TDD)

**Files:**
- Test: `src/lib/audit.test.ts`
- Create: `src/lib/audit.ts`
- Create: `src/test/db.ts` (test DB reset helper, used here and later)

- [ ] **Step 1: Create the test DB reset helper**

`src/test/db.ts`:

```ts
import { prisma } from "@/lib/db";

/** Truncate all app tables between tests. Add new tables here as they appear. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "User" RESTART IDENTITY CASCADE',
  );
}
```

- [ ] **Step 2: Write the failing test**

`src/lib/audit.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { recordAudit } from "./audit";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordAudit", () => {
  it("writes an audit row with actor, entity, action and payloads", async () => {
    await recordAudit({
      userId: "actor-1",
      entityType: "User",
      entityId: "user-9",
      action: "create",
      after: { email: "a@b.com" },
    });

    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe("User");
    expect(rows[0].entityId).toBe("user-9");
    expect(rows[0].action).toBe("create");
    expect(rows[0].userId).toBe("actor-1");
    expect(rows[0].after).toEqual({ email: "a@b.com" });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/lib/audit.test.ts`
Expected: FAIL — cannot find module `./audit`.

- [ ] **Step 4: Write the implementation**

`src/lib/audit.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AuditInput = {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: "create" | "edit" | "delete" | "approve" | "login";
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: input.before,
      after: input.after,
    },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/audit.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: audit-log helper + test DB reset utility"
```

---

## Task 9: User management server actions (TDD)

**Files:**
- Create: `src/lib/users/schema.ts`
- Test: `src/lib/users/actions.test.ts`
- Create: `src/lib/users/actions.ts`

Actions accept the acting user as an argument so they are unit-testable without a live
session; the UI layer (Task 11) passes `await getCurrentUser()`.

- [ ] **Step 1: Create the Zod schema**

`src/lib/users/schema.ts`:

```ts
import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

- [ ] **Step 2: Write the failing test**

`src/lib/users/actions.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db";
import { ForbiddenError } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { createUser, listUsers, setUserActive } from "./actions";

const admin = { id: "admin-1", role: "ADMIN" as const };
const merch = { id: "merch-1", role: "MERCHANDISER" as const };

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createUser", () => {
  it("lets an Admin create a user with a hashed password", async () => {
    const user = await createUser(admin, {
      name: "Asha",
      email: "Asha@Abode.com",
      password: "supersecret",
      role: "MERCHANDISER",
    });
    expect(user.email).toBe("asha@abode.com"); // normalized lowercase
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toBe("supersecret");
    expect(await verifyPassword("supersecret", row.passwordHash)).toBe(true);
  });

  it("forbids a non-Admin from creating users", async () => {
    await expect(
      createUser(merch, {
        name: "X",
        email: "x@abode.com",
        password: "supersecret",
        role: "ACCOUNTS",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a duplicate email", async () => {
    const input = {
      name: "A",
      email: "dup@abode.com",
      password: "supersecret",
      role: "ACCOUNTS" as const,
    };
    await createUser(admin, input);
    await expect(createUser(admin, input)).rejects.toThrow(/already exists/i);
  });

  it("writes an audit row on creation", async () => {
    const user = await createUser(admin, {
      name: "Bina",
      email: "bina@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const audits = await prisma.auditLog.findMany({ where: { entityId: user.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("create");
    expect(audits[0].userId).toBe(admin.id);
  });
});

describe("listUsers", () => {
  it("returns users without password hashes", async () => {
    await createUser(admin, {
      name: "C",
      email: "c@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const users = await listUsers(admin);
    expect(users).toHaveLength(1);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });
});

describe("setUserActive", () => {
  it("deactivates a user", async () => {
    const u = await createUser(admin, {
      name: "D",
      email: "d@abode.com",
      password: "supersecret",
      role: "ACCOUNTS",
    });
    const updated = await setUserActive(admin, u.id, false);
    expect(updated.active).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/lib/users/actions.test.ts`
Expected: FAIL — cannot find module `./actions`.

- [ ] **Step 4: Write the implementation**

`src/lib/users/actions.ts`:

```ts
import { prisma } from "@/lib/db";
import { assertPermission, type SessionUser } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { createUserSchema, type CreateUserInput } from "./schema";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export async function createUser(
  actor: SessionUser,
  input: CreateUserInput,
): Promise<PublicUser> {
  assertPermission(actor, "users", "create");
  const data = createUserSchema.parse(input);
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      role: data.role,
      passwordHash: await hashPassword(data.password),
    },
    select: PUBLIC_SELECT,
  });

  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: user.id,
    action: "create",
    after: { name: user.name, email: user.email, role: user.role },
  });

  return user;
}

export async function listUsers(actor: SessionUser): Promise<PublicUser[]> {
  assertPermission(actor, "users", "view");
  return prisma.user.findMany({ select: PUBLIC_SELECT, orderBy: { createdAt: "asc" } });
}

export async function setUserActive(
  actor: SessionUser,
  userId: string,
  active: boolean,
): Promise<PublicUser> {
  assertPermission(actor, "users", "edit");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { active },
    select: PUBLIC_SELECT,
  });
  await recordAudit({
    userId: actor.id,
    entityType: "User",
    entityId: userId,
    action: "edit",
    after: { active },
  });
  return user;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/users/actions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Run the full unit/integration suite**

Run: `npm test`
Expected: all tests pass (password, permissions, guard, audit, users).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: user management server actions (create/list/setActive) with RBAC + audit"
```

---

## Task 10: Seed the initial Admin user

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add `prisma.seed` config)

- [ ] **Step 1: Create the seed script**

`prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@abode.com";
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, role: "ADMIN", passwordHash },
  });
  console.log(`Seeded admin: ${email} / ChangeMe123!`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Register the seed command in `package.json`**

Add this top-level key (sibling of `"scripts"`):

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Then install the runner:

```bash
npm install -D tsx
```

- [ ] **Step 3: Run the seed against the dev DB**

Run:

```bash
npm run db:seed
```

Expected: "Seeded admin: admin@abode.com / ChangeMe123!"

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed initial admin user"
```

---

## Task 11: Authenticated app shell, login page, user management UI

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/login-form.tsx`
- Create: `src/lib/auth/actions.ts` (sign-in/out server actions)
- Create: `src/components/app-nav.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/users/page.tsx`
- Create: `src/app/(app)/users/create-user-form.tsx`
- Modify: `src/app/page.tsx` (redirect `/` → `/dashboard`)

- [ ] **Step 1: Redirect the root route**

Replace `src/app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 2: Sign-in / sign-out server actions**

`src/lib/auth/actions.ts`:

```ts
"use server";

import { signIn, signOut } from "@/auth";

export async function loginAction(formData: FormData) {
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/dashboard",
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 3: Login page + form**

`src/app/login/page.tsx`:

```tsx
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">ABD OMS — Sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
```

`src/app/login/login-form.tsx`:

```tsx
"use client";

import { loginAction } from "@/lib/auth/actions";

export function LoginForm() {
  return (
    <form action={loginAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required className="rounded border px-3 py-2" />
      </label>
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
        Sign in
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Role-filtered navigation**

`src/components/app-nav.tsx`:

```tsx
import Link from "next/link";
import { can, type Role } from "@/lib/auth/permissions";
import { logoutAction } from "@/lib/auth/actions";

const ITEMS: { href: string; label: string; module: Parameters<typeof can>[1] }[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboards" },
  { href: "/users", label: "Users", module: "users" },
];

export function AppNav({ role, name }: { role: Role; name: string }) {
  const visible = ITEMS.filter((i) => can(role, i.module, "view"));
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <nav className="flex gap-4">
        {visible.map((i) => (
          <Link key={i.href} href={i.href} className="text-sm font-medium hover:underline">
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">{name} · {role}</span>
        <form action={logoutAction}>
          <button type="submit" className="rounded border px-2 py-1">Sign out</button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Authenticated layout**

`src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={session.user.role} name={session.user.name ?? session.user.email ?? ""} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Dashboard page**

`src/app/(app)/dashboard/page.tsx`:

```tsx
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome, {session?.user?.name}. Role: {session?.user?.role}.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: User management page (Admin only)**

`src/app/(app)/users/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/users/actions";
import { CreateUserForm } from "./create-user-form";

export default async function UsersPage() {
  const actor = await getCurrentUser();
  if (!actor || !can(actor.role, "users", "view")) redirect("/dashboard");

  const users = await listUsers(actor);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>
      {can(actor.role, "users", "create") && <CreateUserForm />}
      <table className="w-full border bg-white text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.email}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 8: Create-user form with a server action wrapper**

`src/app/(app)/users/create-user-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ROLES } from "@/lib/auth/permissions";
import { createUserFromForm } from "@/lib/users/form-actions";

export function CreateUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        const res = await createUserFromForm(fd);
        setMessage(res.ok ? "User created" : res.error);
      }}
      className="flex flex-wrap items-end gap-3 rounded border bg-white p-4"
    >
      <input name="name" placeholder="Name" required className="rounded border px-3 py-2" />
      <input name="email" type="email" placeholder="Email" required className="rounded border px-3 py-2" />
      <input name="password" type="password" placeholder="Password" required className="rounded border px-3 py-2" />
      <select name="role" required className="rounded border px-3 py-2">
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">Add user</button>
      {message && <span className="text-sm text-slate-600">{message}</span>}
    </form>
  );
}
```

- [ ] **Step 9: Form-action wrapper that injects the current user**

`src/lib/users/form-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guard";
import { createUser } from "./actions";
import { createUserSchema } from "./schema";

export async function createUserFromForm(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Not authenticated" };
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await createUser(actor, parsed.data);
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
```

- [ ] **Step 10: Type-check and run the app manually**

Run: `npx tsc --noEmit`
Expected: no type errors.

Run: `npm run dev`, open http://localhost:3000, confirm redirect to `/login`, sign in as `admin@abode.com` / `ChangeMe123!`, land on `/dashboard`, see **Users** in the nav, open it, add a user, sign out. Stop the server.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: app shell, login, dashboard, role-based nav, user management UI"
```

---

## Task 12: End-to-end smoke test (Playwright)

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json` (ensure `e2e` script exists — added in Task 2)

This runs against the **dev** DB (seeded admin). Ensure `docker compose up -d` and
`npm run db:seed` have been run.

- [ ] **Step 1: Install Playwright browsers**

Run:

```bash
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the E2E test**

`e2e/auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("admin can log in, see Users nav, and log out", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@abode.com");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

  await page.click('button:has-text("Sign out")');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 4: Run the E2E suite**

Run: `npm run e2e`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: Playwright E2E smoke test for auth flow"
```

---

## Task 13: Finalize — README and full verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# ABD OMS — RMG Order & Merchandising Management System

Next.js full-stack OMS for a Bangladesh RMG buying house. See the design spec in
`docs/superpowers/specs/` and plans in `docs/superpowers/plans/`.

## Prerequisites
- Node 20+, Docker.

## Setup
```bash
cp .env.example .env          # set AUTH_SECRET (openssl rand -base64 32)
docker compose up -d          # start Postgres (dev:5432, test:5433)
npm install
npx prisma migrate dev        # apply migrations to dev DB
npx dotenv -e .env.test -- prisma migrate deploy   # apply to test DB
npm run db:seed               # seed admin@abode.com / ChangeMe123!
npm run dev
```

## Testing
```bash
npm test        # unit + integration (Vitest, test DB on 5433)
npm run e2e      # Playwright E2E (needs dev server + seeded dev DB)
```

## Default login
admin@abode.com / ChangeMe123!  — change this immediately.
````

- [ ] **Step 2: Run the full verification sequence**

Run each and confirm:

```bash
npx tsc --noEmit     # no type errors
npm test             # all unit/integration tests pass
npm run e2e          # E2E passes
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: project README and setup instructions"
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase 0a scope):**
- Auth & login → Tasks 6, 11 ✔
- Roles + permission matrix (spec §7) → Task 5 ✔
- Server-side enforcement → Tasks 7, 9 ✔
- Audit log (spec §12) → Task 8, wired into Task 9 ✔
- User management → Tasks 9, 11 ✔
- Cloud-ready Postgres + Prisma (spec §5) → Tasks 2, 3 ✔
- Testing posture: unit + integration + E2E (spec §12) → Tasks 4–9, 12 ✔
- Master data, Excel import → **deferred to Phase 0b** (out of scope here, by design) ✔

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `Role`/`Module`/`Action`/`can` (Task 5) are reused unchanged in
guard (7), nav (11), schema (9). `SessionUser` defined in guard (7) and consumed in
actions (9). `recordAudit` signature (8) matches all call sites (9).

**Out of scope (later phases):** master data CRUD + Excel import (0b); orders, T&A,
sampling, production/QC, costing, shipment, documents, finance, dashboards, notifications.
