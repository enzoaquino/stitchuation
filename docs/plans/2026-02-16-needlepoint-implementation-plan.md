# Needlepoint MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a thread inventory MVP with offline-first iOS/iPad app and TypeScript REST API with multi-user auth and sync.

**Architecture:** SwiftUI + SwiftData local-first iOS app, Hono TypeScript API with PostgreSQL via Drizzle ORM, JWT auth, timestamp-based last-write-wins sync.

**Tech Stack:** Swift/SwiftUI/SwiftData (iOS), TypeScript/Hono/Drizzle/PostgreSQL (API), Vitest (testing), Zod (validation)

**Design doc:** `docs/plans/2026-02-16-needlepoint-app-design.md`

**Design system:** `docs/plans/2026-02-16-design-system.md`

---

## Milestone 0: iOS Design System Foundation

### Task 0: Implement design system tokens

**Files:**
- Create: `apps/ios/Needlepoint/DesignSystem/Colors.swift`
- Create: `apps/ios/Needlepoint/DesignSystem/Typography.swift`
- Create: `apps/ios/Needlepoint/DesignSystem/Spacing.swift`
- Create: `apps/ios/Needlepoint/DesignSystem/Components/ThreadSwatch.swift`

Refer to `docs/plans/2026-02-16-design-system.md` for all values.

**Step 1: Add font files**

Download and add to the Xcode project:
- PlayfairDisplay-Regular.ttf, PlayfairDisplay-SemiBold.ttf, PlayfairDisplay-Bold.ttf
- SourceSerif4-Regular.ttf, SourceSerif4-Medium.ttf, SourceSerif4-SemiBold.ttf

Register in Info.plist under `UIAppFonts`.

**Step 2: Create `Colors.swift`**

```swift
import SwiftUI

extension Color {
    // Backgrounds
    static let linen = Color(hex: "#F5F0E8")
    static let parchment = Color(hex: "#EDE6D8")
    static let cream = Color(hex: "#FAF7F2")

    // Text
    static let espresso = Color(hex: "#3B2F2F")
    static let walnut = Color(hex: "#5C4A3D")
    static let clay = Color(hex: "#8B7355")

    // Accents
    static let terracotta = Color(hex: "#C4704B")
    static let terracottaLight = Color(hex: "#D4896A")
    static let terracottaMuted = Color(hex: "#E8C4B0")
    static let sage = Color(hex: "#7A8B6F")
    static let dustyRose = Color(hex: "#C4919B")
    static let slate = Color(hex: "#8B8589")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        self.init(
            red: Double((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: Double((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: Double(rgbValue & 0x0000FF) / 255.0
        )
    }
}
```

**Step 3: Create `Typography.swift`**

```swift
import SwiftUI

extension Font {
    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold: return .custom("PlayfairDisplay-Bold", size: size)
        case .semibold: return .custom("PlayfairDisplay-SemiBold", size: size)
        default: return .custom("PlayfairDisplay-Regular", size: size)
        }
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .semibold: return .custom("SourceSerif4-SemiBold", size: size)
        case .medium: return .custom("SourceSerif4-Medium", size: size)
        default: return .custom("SourceSerif4-Regular", size: size)
        }
    }
}
```

**Step 4: Create `Spacing.swift`**

```swift
import Foundation

enum Spacing {
    static let xxs: CGFloat = 2
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let xxxl: CGFloat = 48
}

enum CornerRadius {
    static let subtle: CGFloat = 6
    static let card: CGFloat = 12
    static let modal: CGFloat = 16
}
```

**Step 5: Create `ThreadSwatch.swift`**

```swift
import SwiftUI

struct ThreadSwatch: View {
    let colorHex: String?
    var size: CGFloat = 24

    var body: some View {
        if let hex = colorHex {
            Circle()
                .fill(Color(hex: hex))
                .overlay(Circle().stroke(Color.slate, lineWidth: 0.5))
                .frame(width: size, height: size)
        } else {
            Circle()
                .fill(Color.parchment)
                .overlay {
                    Image(systemName: "questionmark")
                        .font(.system(size: size * 0.4))
                        .foregroundStyle(Color.clay)
                }
                .overlay(Circle().stroke(Color.slate, lineWidth: 0.5))
                .frame(width: size, height: size)
        }
    }
}
```

**Step 6: Build and verify**

Cmd+B in Xcode.

**Step 7: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add design system — colors, typography, spacing, thread swatch"
```

---

## Milestone 1: API Project Setup & Database

### Task 1: Initialize API project

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/.env.example`
- Create: `apps/api/.gitignore`

**Step 1: Initialize Node.js project**

```bash
cd apps/api
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install hono @hono/node-server drizzle-orm postgres zod jsonwebtoken bcryptjs uuid
npm install -D typescript @types/node @types/jsonwebtoken @types/bcryptjs @types/uuid vitest drizzle-kit tsx dotenv
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create minimal Hono server in `apps/api/src/index.ts`**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`Server running on port ${port}`);

export default app;
```

**Step 5: Add scripts to package.json**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "type": "module"
}
```

**Step 6: Create .env.example**

```
DATABASE_URL=postgres://localhost:5432/needlepoint
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production-too
PORT=3000
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
.env
```

**Step 8: Verify server starts**

```bash
cp .env.example .env
npx tsx src/index.ts &
curl http://localhost:3000/health
# Expected: {"status":"ok"}
kill %1
```

**Step 9: Commit**

```bash
git add apps/api/
git commit -m "feat(api): initialize Hono TypeScript project"
```

---

### Task 2: Database schema and migrations

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/connection.ts`
- Create: `apps/api/drizzle.config.ts`

**Step 1: Create database connection in `apps/api/src/db/connection.ts`**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

**Step 2: Create schema in `apps/api/src/db/schema.ts`**

```typescript
import { pgTable, uuid, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

export const fiberTypeEnum = pgEnum("fiber_type", [
  "wool", "cotton", "silk", "synthetic", "blend", "other"
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  providerUserId: text("provider_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  brand: text("brand").notNull(),
  number: text("number").notNull(),
  colorName: text("color_name"),
  colorHex: text("color_hex"),
  fiberType: fiberTypeEnum("fiber_type").notNull().default("wool"),
  quantity: integer("quantity").notNull().default(0),
  barcode: text("barcode"),
  weightOrLength: text("weight_or_length"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

**Step 3: Create `apps/api/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Create the local database**

```bash
createdb needlepoint
```

**Step 5: Generate and run migrations**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

**Step 6: Verify tables exist**

```bash
psql needlepoint -c "\dt"
# Expected: users and threads tables listed
```

**Step 7: Commit**

```bash
git add apps/api/src/db/ apps/api/drizzle.config.ts apps/api/drizzle/
git commit -m "feat(api): add database schema for users and threads"
```

---

## Milestone 2: Authentication

### Task 3: Auth service — email/password registration

**Files:**
- Create: `apps/api/src/auth/auth-service.ts`
- Create: `apps/api/src/auth/jwt.ts`
- Create: `apps/api/src/auth/schemas.ts`
- Create: `apps/api/tests/auth/auth-service.test.ts`

**Step 1: Create Zod schemas in `apps/api/src/auth/schemas.ts`**

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

**Step 2: Create JWT helpers in `apps/api/src/auth/jwt.ts`**

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}
```

**Step 3: Write failing test in `apps/api/tests/auth/auth-service.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../../src/auth/auth-service.js";

// Use a test database — set DATABASE_URL in .env.test or vitest config
describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("register", () => {
    it("creates a user and returns tokens", async () => {
      const result = await authService.register({
        email: `test-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Test User",
      });

      expect(result.user.email).toContain("@example.com");
      expect(result.user.displayName).toBe("Test User");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBeDefined();
    });

    it("rejects duplicate emails", async () => {
      const email = `dup-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "First User",
      });

      await expect(
        authService.register({
          email,
          password: "otherpassword123",
          displayName: "Second User",
        })
      ).rejects.toThrow();
    });
  });
});
```

**Step 4: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/auth-service.test.ts
# Expected: FAIL — AuthService not found
```

**Step 5: Implement AuthService in `apps/api/src/auth/auth-service.ts`**

```typescript
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { signAccessToken, signRefreshToken } from "./jwt.js";
import type { RegisterInput, LoginInput } from "./schemas.js";

export class AuthService {
  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        provider: "email",
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return { user, accessToken, refreshToken };
  }

  async login(input: LoginInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const tokenPayload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    };
  }
}
```

**Step 6: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/auth/auth-service.test.ts
# Expected: PASS
```

**Step 7: Commit**

```bash
git add apps/api/src/auth/ apps/api/tests/auth/
git commit -m "feat(api): add auth service with email/password registration and login"
```

---

### Task 4: Auth service — login tests

**Files:**
- Modify: `apps/api/tests/auth/auth-service.test.ts`

**Step 1: Add login tests**

```typescript
  describe("login", () => {
    it("returns tokens for valid credentials", async () => {
      const email = `login-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "Login User",
      });

      const result = await authService.login({
        email,
        password: "securepassword123",
      });

      expect(result.user.email).toBe(email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("rejects invalid password", async () => {
      const email = `bad-pw-${Date.now()}@example.com`;
      await authService.register({
        email,
        password: "securepassword123",
        displayName: "Bad PW User",
      });

      await expect(
        authService.login({ email, password: "wrongpassword" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects unknown email", async () => {
      await expect(
        authService.login({
          email: "nobody@example.com",
          password: "whatever",
        })
      ).rejects.toThrow("Invalid email or password");
    });
  });
```

**Step 2: Run tests**

```bash
cd apps/api && npx vitest run tests/auth/auth-service.test.ts
# Expected: PASS
```

**Step 3: Commit**

```bash
git add apps/api/tests/auth/
git commit -m "test(api): add login tests for auth service"
```

---

### Task 5: Auth routes

**Files:**
- Create: `apps/api/src/auth/auth-routes.ts`
- Create: `apps/api/tests/auth/auth-routes.test.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Write failing route test in `apps/api/tests/auth/auth-routes.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import app from "../../src/index.js";

describe("POST /auth/register", () => {
  it("returns 201 with tokens for valid input", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `route-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Route User",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toContain("@example.com");
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it("returns 400 for invalid input", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("returns 200 with tokens for valid credentials", async () => {
    const email = `login-route-${Date.now()}@example.com`;

    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "securepassword123",
        displayName: "Login Route User",
      }),
    });

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "securepassword123" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeDefined();
  });

  it("returns 401 for bad credentials", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "wrong",
      }),
    });

    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/auth-routes.test.ts
# Expected: FAIL — routes not registered
```

**Step 3: Implement auth routes in `apps/api/src/auth/auth-routes.ts`**

```typescript
import { Hono } from "hono";
import { AuthService } from "./auth-service.js";
import { registerSchema, loginSchema } from "./schemas.js";

const authRoutes = new Hono();
const authService = new AuthService();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.register(parsed.data);
    return c.json(result, 201);
  } catch (error: any) {
    if (error.message?.includes("duplicate") || error.code === "23505") {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw error;
  }
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.login(parsed.data);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
});

export { authRoutes };
```

**Step 4: Mount routes in `apps/api/src/index.ts`**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { authRoutes } from "./auth/auth-routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port });
console.log(`Server running on port ${port}`);

export default app;
```

**Step 5: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/auth/auth-routes.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add apps/api/src/auth/auth-routes.ts apps/api/src/index.ts apps/api/tests/auth/auth-routes.test.ts
git commit -m "feat(api): add auth register and login routes"
```

---

### Task 6: Auth middleware

**Files:**
- Create: `apps/api/src/auth/middleware.ts`
- Create: `apps/api/tests/auth/middleware.test.ts`

**Step 1: Write failing test in `apps/api/tests/auth/middleware.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/auth/middleware.js";
import { signAccessToken } from "../../src/auth/jwt.js";

describe("authMiddleware", () => {
  const app = new Hono();
  app.use("/protected/*", authMiddleware);
  app.get("/protected/test", (c) => {
    const userId = c.get("userId");
    return c.json({ userId });
  });

  it("allows requests with valid token", async () => {
    const token = signAccessToken({ userId: "test-id", email: "test@test.com" });
    const res = await app.request("/protected/test", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("test-id");
  });

  it("rejects requests without token", async () => {
    const res = await app.request("/protected/test");
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid token", async () => {
    const res = await app.request("/protected/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/auth/middleware.test.ts
# Expected: FAIL — middleware not found
```

**Step 3: Implement middleware in `apps/api/src/auth/middleware.ts`**

```typescript
import type { Context, Next } from "hono";
import { verifyAccessToken } from "./jwt.js";

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/auth/middleware.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add apps/api/src/auth/middleware.ts apps/api/tests/auth/middleware.test.ts
git commit -m "feat(api): add JWT auth middleware"
```

---

## Milestone 3: Thread CRUD

### Task 7: Thread service

**Files:**
- Create: `apps/api/src/threads/thread-service.ts`
- Create: `apps/api/src/threads/schemas.ts`
- Create: `apps/api/tests/threads/thread-service.test.ts`

**Step 1: Create Zod schemas in `apps/api/src/threads/schemas.ts`**

```typescript
import { z } from "zod";

const fiberTypes = ["wool", "cotton", "silk", "synthetic", "blend", "other"] as const;

export const createThreadSchema = z.object({
  id: z.string().uuid().optional(),
  brand: z.string().min(1).max(100),
  number: z.string().min(1).max(50),
  colorName: z.string().max(100).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fiberType: z.enum(fiberTypes).default("wool"),
  quantity: z.number().int().min(0).default(0),
  barcode: z.string().max(50).optional(),
  weightOrLength: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateThreadSchema = createThreadSchema.partial();

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
```

**Step 2: Write failing test in `apps/api/tests/threads/thread-service.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { ThreadService } from "../../src/threads/thread-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

describe("ThreadService", () => {
  let threadService: ThreadService;
  let userId: string;

  beforeAll(async () => {
    threadService = new ThreadService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `thread-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Thread Tester",
    });
    userId = user.id;
  });

  it("creates and retrieves a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "310",
      colorName: "Black",
      colorHex: "#000000",
      fiberType: "cotton",
      quantity: 3,
    });

    expect(thread.id).toBeDefined();
    expect(thread.brand).toBe("DMC");
    expect(thread.number).toBe("310");
    expect(thread.quantity).toBe(3);

    const fetched = await threadService.getById(userId, thread.id);
    expect(fetched?.brand).toBe("DMC");
  });

  it("lists threads for a user", async () => {
    const threads = await threadService.listByUser(userId);
    expect(threads.length).toBeGreaterThan(0);
  });

  it("updates a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "Appleton",
      number: "992",
      quantity: 1,
    });

    const updated = await threadService.update(userId, thread.id, {
      quantity: 5,
      colorName: "Sea Green",
    });

    expect(updated.quantity).toBe(5);
    expect(updated.colorName).toBe("Sea Green");
  });

  it("soft deletes a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "Paternayan",
      number: "220",
      quantity: 2,
    });

    await threadService.softDelete(userId, thread.id);

    const fetched = await threadService.getById(userId, thread.id);
    expect(fetched).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/threads/thread-service.test.ts
# Expected: FAIL — ThreadService not found
```

**Step 4: Implement ThreadService in `apps/api/src/threads/thread-service.ts`**

```typescript
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/connection.js";
import { threads } from "../db/schema.js";
import type { CreateThreadInput, UpdateThreadInput } from "./schemas.js";

export class ThreadService {
  async create(userId: string, input: CreateThreadInput) {
    const [thread] = await db
      .insert(threads)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        brand: input.brand,
        number: input.number,
        colorName: input.colorName,
        colorHex: input.colorHex,
        fiberType: input.fiberType,
        quantity: input.quantity ?? 0,
        barcode: input.barcode,
        weightOrLength: input.weightOrLength,
        notes: input.notes,
      })
      .returning();

    return thread;
  }

  async getById(userId: string, id: string) {
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId), isNull(threads.deletedAt)))
      .limit(1);

    return thread ?? null;
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(threads)
      .where(and(eq(threads.userId, userId), isNull(threads.deletedAt)));
  }

  async update(userId: string, id: string, input: UpdateThreadInput) {
    const [updated] = await db
      .update(threads)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(threads.id, id), eq(threads.userId, userId), isNull(threads.deletedAt)))
      .returning();

    if (!updated) throw new Error("Thread not found");
    return updated;
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(threads)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(threads.id, id), eq(threads.userId, userId), isNull(threads.deletedAt)))
      .returning();

    if (!deleted) throw new Error("Thread not found");
    return deleted;
  }
}
```

**Step 5: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/threads/thread-service.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add apps/api/src/threads/ apps/api/tests/threads/
git commit -m "feat(api): add thread service with CRUD and soft delete"
```

---

### Task 8: Thread routes

**Files:**
- Create: `apps/api/src/threads/thread-routes.ts`
- Create: `apps/api/tests/threads/thread-routes.test.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Write failing route tests in `apps/api/tests/threads/thread-routes.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/index.js";

describe("Thread Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `thread-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Thread Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /threads creates a thread", async () => {
    const res = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        brand: "DMC",
        number: "310",
        colorName: "Black",
        quantity: 3,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.brand).toBe("DMC");
  });

  it("GET /threads lists user threads", async () => {
    const res = await app.request("/threads", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("PUT /threads/:id updates a thread", async () => {
    // Create a thread first
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Appleton", number: "100", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ quantity: 10 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(10);
  });

  it("DELETE /threads/:id soft deletes a thread", async () => {
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Silk", number: "999", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/threads");
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/threads/thread-routes.test.ts
# Expected: FAIL — routes not registered
```

**Step 3: Implement thread routes in `apps/api/src/threads/thread-routes.ts`**

```typescript
import { Hono } from "hono";
import { ThreadService } from "./thread-service.js";
import { createThreadSchema, updateThreadSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";

const threadRoutes = new Hono();
const threadService = new ThreadService();

threadRoutes.use("/*", authMiddleware);

threadRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const threads = await threadService.listByUser(userId);
  return c.json(threads);
});

threadRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createThreadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const thread = await threadService.create(userId, parsed.data);
  return c.json(thread, 201);
});

threadRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateThreadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const thread = await threadService.update(userId, id, parsed.data);
    return c.json(thread);
  } catch {
    return c.json({ error: "Thread not found" }, 404);
  }
});

threadRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  try {
    await threadService.softDelete(userId, id);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Thread not found" }, 404);
  }
});

export { threadRoutes };
```

**Step 4: Mount routes in `apps/api/src/index.ts`**

Add to existing imports and routes:

```typescript
import { threadRoutes } from "./threads/thread-routes.js";
// ...
app.route("/threads", threadRoutes);
```

**Step 5: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/threads/thread-routes.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add apps/api/src/threads/thread-routes.ts apps/api/src/index.ts apps/api/tests/threads/thread-routes.test.ts
git commit -m "feat(api): add thread CRUD routes with auth"
```

---

## Milestone 4: Sync Endpoint

### Task 9: Sync service

**Files:**
- Create: `apps/api/src/sync/sync-service.ts`
- Create: `apps/api/src/sync/schemas.ts`
- Create: `apps/api/tests/sync/sync-service.test.ts`

**Step 1: Create sync schemas in `apps/api/src/sync/schemas.ts`**

```typescript
import { z } from "zod";

const syncChangeSchema = z.object({
  type: z.enum(["thread"]),
  action: z.enum(["upsert", "delete"]),
  id: z.string().uuid(),
  data: z.record(z.unknown()).optional(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(),
});

export const syncRequestSchema = z.object({
  lastSync: z.string().datetime().nullable(),
  changes: z.array(syncChangeSchema),
});

export type SyncChange = z.infer<typeof syncChangeSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
```

**Step 2: Write failing test in `apps/api/tests/sync/sync-service.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";

describe("SyncService", () => {
  let syncService: SyncService;
  let userId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `sync-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Sync Tester",
    });
    userId = user.id;
  });

  it("pushes new threads from client", async () => {
    const threadId = crypto.randomUUID();
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: threadId,
          data: {
            brand: "DMC",
            number: "310",
            colorName: "Black",
            fiberType: "cotton",
            quantity: 3,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.serverTimestamp).toBeDefined();
    // The thread should now exist on the server
    const threadService = new ThreadService();
    const thread = await threadService.getById(userId, threadId);
    expect(thread?.brand).toBe("DMC");
  });

  it("pulls server changes since lastSync", async () => {
    const threadService = new ThreadService();
    const before = new Date(Date.now() - 1000).toISOString();

    await threadService.create(userId, {
      brand: "Appleton",
      number: "500",
      quantity: 2,
    });

    const result = await syncService.sync(userId, {
      lastSync: before,
      changes: [],
    });

    expect(result.changes.length).toBeGreaterThan(0);
    const appleton = result.changes.find(
      (c: any) => c.data?.brand === "Appleton" && c.data?.number === "500"
    );
    expect(appleton).toBeDefined();
  });

  it("resolves conflicts with last-write-wins", async () => {
    const threadService = new ThreadService();
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "666",
      quantity: 1,
    });

    // Server updates the thread to quantity 10
    await threadService.update(userId, thread.id, { quantity: 10 });

    // Client sends an OLDER update (quantity 5)
    const olderTimestamp = new Date(Date.now() - 60000).toISOString();
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: thread.id,
          data: { quantity: 5 },
          updatedAt: olderTimestamp,
        },
      ],
    });

    // Server version (quantity 10) should win and be returned
    const serverThread = await threadService.getById(userId, thread.id);
    expect(serverThread?.quantity).toBe(10);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/sync/sync-service.test.ts
# Expected: FAIL — SyncService not found
```

**Step 4: Implement SyncService in `apps/api/src/sync/sync-service.ts`**

```typescript
import { and, eq, gt, isNotNull, or } from "drizzle-orm";
import { db } from "../db/connection.js";
import { threads } from "../db/schema.js";
import type { SyncRequest } from "./schemas.js";

export class SyncService {
  async sync(userId: string, request: SyncRequest) {
    const serverTimestamp = new Date();

    // Process incoming changes
    for (const change of request.changes) {
      if (change.type === "thread") {
        await this.processThreadChange(userId, change);
      }
    }

    // Gather server changes since lastSync
    const changes = await this.getChangesSince(userId, request.lastSync);

    return {
      serverTimestamp: serverTimestamp.toISOString(),
      changes,
    };
  }

  private async processThreadChange(userId: string, change: any) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();
      // Only apply if client timestamp is newer
      const [existing] = await db
        .select()
        .from(threads)
        .where(and(eq(threads.id, change.id), eq(threads.userId, userId)))
        .limit(1);

      if (existing && existing.updatedAt <= clientUpdatedAt) {
        await db
          .update(threads)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(eq(threads.id, change.id));
      }
      return;
    }

    // Upsert
    const [existing] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, change.id), eq(threads.userId, userId)))
      .limit(1);

    if (!existing) {
      // New thread from client
      await db.insert(threads).values({
        id: change.id,
        userId,
        brand: change.data.brand ?? "",
        number: change.data.number ?? "",
        colorName: change.data.colorName,
        colorHex: change.data.colorHex,
        fiberType: change.data.fiberType ?? "wool",
        quantity: change.data.quantity ?? 0,
        barcode: change.data.barcode,
        weightOrLength: change.data.weightOrLength,
        notes: change.data.notes,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      });
    } else if (existing.updatedAt <= clientUpdatedAt) {
      // Client is newer — apply update
      await db
        .update(threads)
        .set({
          ...change.data,
          updatedAt: clientUpdatedAt,
        })
        .where(eq(threads.id, change.id));
    }
    // else: server is newer, ignore client change
  }

  private async getChangesSince(userId: string, lastSync: string | null) {
    const since = lastSync ? new Date(lastSync) : new Date(0);

    const changed = await db
      .select()
      .from(threads)
      .where(
        and(
          eq(threads.userId, userId),
          gt(threads.updatedAt, since)
        )
      );

    return changed.map((t) => ({
      type: "thread" as const,
      action: t.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: t.id,
      data: t.deletedAt ? undefined : t,
      updatedAt: t.updatedAt.toISOString(),
      deletedAt: t.deletedAt?.toISOString(),
    }));
  }
}
```

**Step 5: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/sync/sync-service.test.ts
# Expected: PASS
```

**Step 6: Commit**

```bash
git add apps/api/src/sync/ apps/api/tests/sync/
git commit -m "feat(api): add sync service with last-write-wins conflict resolution"
```

---

### Task 10: Sync route

**Files:**
- Create: `apps/api/src/sync/sync-routes.ts`
- Create: `apps/api/tests/sync/sync-routes.test.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Write failing route test in `apps/api/tests/sync/sync-routes.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/index.js";

describe("POST /sync", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `sync-route-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Sync Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("accepts sync request and returns server changes", async () => {
    const threadId = crypto.randomUUID();

    const res = await app.request("/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lastSync: null,
        changes: [
          {
            type: "thread",
            action: "upsert",
            id: threadId,
            data: { brand: "DMC", number: "310", quantity: 2 },
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serverTimestamp).toBeDefined();
    expect(Array.isArray(body.changes)).toBe(true);
  });

  it("rejects unauthenticated sync requests", async () => {
    const res = await app.request("/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastSync: null, changes: [] }),
    });

    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run tests/sync/sync-routes.test.ts
# Expected: FAIL
```

**Step 3: Implement sync route in `apps/api/src/sync/sync-routes.ts`**

```typescript
import { Hono } from "hono";
import { SyncService } from "./sync-service.js";
import { syncRequestSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";

const syncRoutes = new Hono();
const syncService = new SyncService();

syncRoutes.use("/*", authMiddleware);

syncRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = syncRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const result = await syncService.sync(userId, parsed.data);
  return c.json(result);
});

export { syncRoutes };
```

**Step 4: Mount route in `apps/api/src/index.ts`**

Add to existing imports and routes:

```typescript
import { syncRoutes } from "./sync/sync-routes.js";
// ...
app.route("/sync", syncRoutes);
```

**Step 5: Run test to verify it passes**

```bash
cd apps/api && npx vitest run tests/sync/sync-routes.test.ts
# Expected: PASS
```

**Step 6: Run all API tests**

```bash
cd apps/api && npx vitest run
# Expected: ALL PASS
```

**Step 7: Commit**

```bash
git add apps/api/src/sync/sync-routes.ts apps/api/src/index.ts apps/api/tests/sync/sync-routes.test.ts
git commit -m "feat(api): add sync endpoint"
```

---

## Milestone 5: iOS App — SwiftData Models & Local Persistence

### Task 11: Create Xcode project

**Step 1: Create Xcode project**

Open Xcode → File → New → Project → App
- Product Name: Needlepoint
- Team: Your Apple Developer account
- Organization Identifier: com.yourname
- Interface: SwiftUI
- Storage: SwiftData
- Save to: `apps/ios/`

**Step 2: Verify it builds and runs**

Run in Xcode simulator — should show default SwiftUI app.

**Step 3: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): initialize Xcode project with SwiftUI and SwiftData"
```

---

### Task 12: SwiftData models

**Files:**
- Create: `apps/ios/Needlepoint/Models/NeedleThread.swift`
- Create: `apps/ios/Needlepoint/Models/FiberType.swift`

**Step 1: Create FiberType enum in `FiberType.swift`**

```swift
import Foundation

enum FiberType: String, Codable, CaseIterable {
    case wool, cotton, silk, synthetic, blend, other
}
```

**Step 2: Create NeedleThread model in `NeedleThread.swift`**

```swift
import Foundation
import SwiftData

@Model
final class NeedleThread {
    @Attribute(.unique) var id: UUID
    var brand: String
    var number: String
    var colorName: String?
    var colorHex: String?
    var fiberType: FiberType
    var quantity: Int
    var barcode: String?
    var weightOrLength: String?
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        brand: String,
        number: String,
        colorName: String? = nil,
        colorHex: String? = nil,
        fiberType: FiberType = .wool,
        quantity: Int = 0,
        barcode: String? = nil,
        weightOrLength: String? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.brand = brand
        self.number = number
        self.colorName = colorName
        self.colorHex = colorHex
        self.fiberType = fiberType
        self.quantity = quantity
        self.barcode = barcode
        self.weightOrLength = weightOrLength
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 3: Register model in app entry point**

Update the `@main` App struct to include the model container:

```swift
@main
struct NeedlepointApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [NeedleThread.self])
    }
}
```

**Step 4: Build and verify no errors**

Cmd+B in Xcode.

**Step 5: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add NeedleThread SwiftData model"
```

---

### Task 13: Thread list view

**Files:**
- Create: `apps/ios/Needlepoint/Views/ThreadListView.swift`
- Create: `apps/ios/Needlepoint/ViewModels/ThreadListViewModel.swift`

**Step 1: Create ThreadListViewModel**

```swift
import Foundation
import SwiftData
import Observation

@Observable
final class ThreadListViewModel {
    var searchText = ""
    var selectedBrandFilter: String?
    var selectedFiberFilter: FiberType?
}
```

**Step 2: Create ThreadListView**

```swift
import SwiftUI
import SwiftData

struct ThreadListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil },
           sort: [SortDescriptor(\NeedleThread.brand), SortDescriptor(\NeedleThread.number)])
    private var threads: [NeedleThread]

    @State private var viewModel = ThreadListViewModel()
    @State private var showAddThread = false

    var filteredThreads: [NeedleThread] {
        threads.filter { thread in
            if !viewModel.searchText.isEmpty {
                let search = viewModel.searchText.lowercased()
                let matches = thread.brand.lowercased().contains(search)
                    || thread.number.lowercased().contains(search)
                    || (thread.colorName?.lowercased().contains(search) ?? false)
                if !matches { return false }
            }
            if let brand = viewModel.selectedBrandFilter, thread.brand != brand {
                return false
            }
            if let fiber = viewModel.selectedFiberFilter, thread.fiberType != fiber {
                return false
            }
            return true
        }
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredThreads.isEmpty && viewModel.searchText.isEmpty {
                // Empty state — design system pattern
                VStack(spacing: Spacing.lg) {
                    Image(systemName: "tray")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.clay)
                    Text("No threads yet")
                        .font(.playfair(22, weight: .semibold))
                        .foregroundStyle(Color.espresso)
                    Text("Tap + to add your first thread")
                        .font(.sourceSerif(17))
                        .foregroundStyle(Color.walnut)
                }
                .padding(Spacing.xxxl)
            } else {
                List(filteredThreads) { thread in
                    ThreadRowView(thread: thread)
                        .listRowBackground(Color.cream)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search threads")
        .navigationTitle("Inventory")
        .toolbar {
            Button("Add", systemImage: "plus") {
                showAddThread = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showAddThread) {
            AddThreadView()
        }
    }
}
```

**Step 3: Create ThreadRowView inline**

```swift
// Uses design system from docs/plans/2026-02-16-design-system.md
struct ThreadRowView: View {
    let thread: NeedleThread

    var body: some View {
        HStack(spacing: Spacing.md) {
            ThreadSwatch(colorHex: thread.colorHex)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("\(thread.brand) \(thread.number)")
                    .font(.sourceSerif(17, weight: .semibold))
                    .foregroundStyle(Color.espresso)
                if let name = thread.colorName {
                    Text("\(name) · \(thread.fiberType.rawValue.capitalized)")
                        .font(.sourceSerif(15))
                        .foregroundStyle(Color.walnut)
                }
            }
            Spacer()
            HStack(spacing: Spacing.sm) {
                Button { updateQuantity(-1) } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.terracotta)
                        .frame(width: 28, height: 28)
                        .background(Color.terracottaMuted.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(thread.quantity <= 0)

                Text("\(thread.quantity)")
                    .font(.system(.body, design: .monospaced).weight(.medium))
                    .foregroundStyle(Color.espresso)
                    .frame(minWidth: 24)

                Button { updateQuantity(1) } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.terracotta)
                        .frame(width: 28, height: 28)
                        .background(Color.terracottaMuted.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    private func updateQuantity(_ delta: Int) {
        withAnimation(.spring(duration: 0.2)) {
            thread.quantity = max(0, thread.quantity + delta)
            thread.updatedAt = Date()
        }
    }
}
```

**Step 4: Build and run**

Verify the thread list renders (empty state). Navigate to add.

**Step 5: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add thread list view with search, filter, and inline quantity stepper"
```

---

### Task 14: Add thread view

**Files:**
- Create: `apps/ios/Needlepoint/Views/AddThreadView.swift`

**Step 1: Create AddThreadView**

```swift
import SwiftUI
import SwiftData

struct AddThreadView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var brand = ""
    @State private var number = ""
    @State private var colorName = ""
    @State private var colorHex = ""
    @State private var fiberType: FiberType = .wool
    @State private var quantity = 1
    @State private var barcode = ""
    @State private var weightOrLength = ""
    @State private var notes = ""
    @State private var addAnother = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Thread Info") {
                    TextField("Brand (e.g. DMC)", text: $brand)
                    TextField("Number (e.g. 310)", text: $number)
                    TextField("Color Name", text: $colorName)
                    TextField("Color Hex (#000000)", text: $colorHex)
                    Picker("Fiber Type", selection: $fiberType) {
                        ForEach(FiberType.allCases, id: \.self) { type in
                            Text(type.rawValue.capitalized).tag(type)
                        }
                    }
                }

                Section("Quantity") {
                    Stepper("\(quantity)", value: $quantity, in: 0...999)
                }

                Section("Optional") {
                    TextField("Barcode / UPC", text: $barcode)
                    TextField("Weight or Length", text: $weightOrLength)
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                Toggle("Add Another", isOn: $addAnother)
            }
            .navigationTitle("Add Thread")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveThread() }
                        .disabled(brand.isEmpty || number.isEmpty)
                }
            }
        }
    }

    private func saveThread() {
        let thread = NeedleThread(
            brand: brand,
            number: number,
            colorName: colorName.isEmpty ? nil : colorName,
            colorHex: colorHex.isEmpty ? nil : colorHex,
            fiberType: fiberType,
            quantity: quantity,
            barcode: barcode.isEmpty ? nil : barcode,
            weightOrLength: weightOrLength.isEmpty ? nil : weightOrLength,
            notes: notes.isEmpty ? nil : notes
        )
        modelContext.insert(thread)

        if addAnother {
            // Reset fields but keep brand for batch entry
            number = ""
            colorName = ""
            colorHex = ""
            quantity = 1
            barcode = ""
            weightOrLength = ""
            notes = ""
        } else {
            dismiss()
        }
    }
}
```

**Step 2: Build and run**

Test adding a thread. Verify it appears in the list. Test "Add Another" flow.

**Step 3: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add thread form with batch entry support"
```

---

### Task 15: Tab bar and iPad sidebar navigation

**Files:**
- Modify: `apps/ios/Needlepoint/ContentView.swift`

**Step 1: Update ContentView with adaptive navigation**

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            NavigationStack {
                ThreadListView()
            }
            .tabItem {
                Label("Inventory", systemImage: "tray.full")
            }

            NavigationStack {
                Text("Projects coming soon")
                    .navigationTitle("Projects")
            }
            .tabItem {
                Label("Projects", systemImage: "folder")
            }

            NavigationStack {
                Text("Settings coming soon")
                    .navigationTitle("Settings")
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
    }
}
```

Note: On iPad, SwiftUI automatically adapts TabView to a sidebar with `tabViewStyle(.sidebarAdaptable)` on iOS 18+. If targeting iOS 17, use:

```swift
#if os(iOS)
.tabViewStyle(.sidebarAdaptable)
#endif
```

**Step 2: Build and run on both iPhone and iPad simulators**

Verify tab bar on iPhone and sidebar on iPad.

**Step 3: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add tab bar with adaptive iPad sidebar"
```

---

## Milestone 6: iOS App — Networking & Sync

### Task 16: Network client

**Files:**
- Create: `apps/ios/Needlepoint/Sync/NetworkClient.swift`
- Create: `apps/ios/Needlepoint/Sync/APIError.swift`

**Step 1: Create APIError**

```swift
import Foundation

enum APIError: Error {
    case unauthorized
    case badRequest(String)
    case serverError(Int)
    case network(Error)
    case decoding(Error)
}
```

**Step 2: Create NetworkClient**

```swift
import Foundation

actor NetworkClient {
    private let baseURL: URL
    private var accessToken: String?
    private var refreshToken: String?

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func setTokens(access: String, refresh: String) {
        self.accessToken = access
        self.refreshToken = refresh
    }

    func request<T: Decodable>(
        method: String,
        path: String,
        body: (any Encodable)? = nil
    ) async throws -> T {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            urlRequest.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError(0)
        }

        switch httpResponse.statusCode {
        case 200...299:
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }
}
```

**Step 3: Build and verify**

Cmd+B in Xcode.

**Step 4: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add network client with JWT auth"
```

---

### Task 17: Sync engine

**Files:**
- Create: `apps/ios/Needlepoint/Sync/SyncEngine.swift`

**Step 1: Create SyncEngine**

```swift
import Foundation
import SwiftData

@Observable
final class SyncEngine {
    private let networkClient: NetworkClient
    private let modelContainer: ModelContainer
    private var lastSyncTimestamp: Date?
    private(set) var isSyncing = false

    init(networkClient: NetworkClient, modelContainer: ModelContainer) {
        self.networkClient = networkClient
        self.modelContainer = modelContainer
    }

    @MainActor
    func sync() async throws {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        let context = modelContainer.mainContext

        // Gather local changes (unsynced threads)
        let unsyncedPredicate = #Predicate<NeedleThread> { thread in
            thread.syncedAt == nil || thread.updatedAt > (thread.syncedAt ?? Date.distantPast)
        }
        let descriptor = FetchDescriptor<NeedleThread>(predicate: unsyncedPredicate)
        let unsynced = try context.fetch(descriptor)

        let changes: [[String: Any]] = unsynced.map { thread in
            var change: [String: Any] = [
                "type": "thread",
                "action": thread.deletedAt != nil ? "delete" : "upsert",
                "id": thread.id.uuidString,
                "updatedAt": ISO8601DateFormatter().string(from: thread.updatedAt),
            ]
            if thread.deletedAt == nil {
                change["data"] = [
                    "brand": thread.brand,
                    "number": thread.number,
                    "colorName": thread.colorName as Any,
                    "colorHex": thread.colorHex as Any,
                    "fiberType": thread.fiberType.rawValue,
                    "quantity": thread.quantity,
                    "barcode": thread.barcode as Any,
                    "weightOrLength": thread.weightOrLength as Any,
                    "notes": thread.notes as Any,
                ]
            }
            return change
        }

        // Send to server and apply response
        // (Full Codable request/response structs would replace this in implementation)

        // Mark synced
        for thread in unsynced {
            thread.syncedAt = Date()
        }

        try context.save()
    }
}
```

**Step 2: Build and verify**

Cmd+B in Xcode.

**Step 3: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add sync engine with change tracking"
```

---

## Milestone 7: iOS App — Authentication UI

### Task 18: Auth views

**Files:**
- Create: `apps/ios/Needlepoint/Auth/AuthViewModel.swift`
- Create: `apps/ios/Needlepoint/Views/LoginView.swift`

**Step 1: Create AuthViewModel**

```swift
import Foundation
import Observation
import AuthenticationServices

@Observable
final class AuthViewModel {
    var email = ""
    var password = ""
    var displayName = ""
    var isRegistering = false
    var isLoading = false
    var isAuthenticated = false
    var errorMessage: String?

    private let networkClient: NetworkClient

    init(networkClient: NetworkClient) {
        self.networkClient = networkClient
    }

    func login() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // Call API /auth/login, store tokens in Keychain
        // On success: isAuthenticated = true
    }

    func register() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // Call API /auth/register, store tokens in Keychain
        // On success: isAuthenticated = true
    }
}
```

**Step 2: Create LoginView**

```swift
import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @State private var viewModel: AuthViewModel

    init(networkClient: NetworkClient) {
        _viewModel = State(initialValue: AuthViewModel(networkClient: networkClient))
    }

    // Uses design system from docs/plans/2026-02-16-design-system.md
    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                Text("Needlepoint")
                    .font(.playfair(34, weight: .bold))
                    .foregroundStyle(Color.espresso)

                Text("Your craft companion")
                    .font(.sourceSerif(17))
                    .foregroundStyle(Color.walnut)

                Spacer().frame(height: Spacing.lg)

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.email, .fullName]
                } onCompletion: { result in
                    // Handle Apple sign-in
                }
                .frame(height: 50)
                .cornerRadius(CornerRadius.subtle)
                .padding(.horizontal, Spacing.xl)

                HStack {
                    Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                    Text("or")
                        .font(.sourceSerif(13))
                        .foregroundStyle(Color.clay)
                    Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                }
                .padding(.horizontal, Spacing.xl)

                VStack(spacing: Spacing.md) {
                    if viewModel.isRegistering {
                        TextField("Display Name", text: $viewModel.displayName)
                    }
                    TextField("Email", text: $viewModel.email)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField("Password", text: $viewModel.password)
                        .textContentType(viewModel.isRegistering ? .newPassword : .password)
                }
                .textFieldStyle(.roundedBorder)
                .font(.sourceSerif(17))
                .padding(.horizontal, Spacing.xl)

                if let error = viewModel.errorMessage {
                    Text(error)
                        .foregroundStyle(Color.terracotta)
                        .font(.sourceSerif(13))
                }

                Button {
                    Task {
                        if viewModel.isRegistering {
                            await viewModel.register()
                        } else {
                            await viewModel.login()
                        }
                    }
                } label: {
                    Text(viewModel.isRegistering ? "Create Account" : "Log In")
                        .font(.sourceSerif(17, weight: .semibold))
                        .foregroundStyle(Color.cream)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .cornerRadius(CornerRadius.subtle)
                }
                .disabled(viewModel.isLoading)
                .padding(.horizontal, Spacing.xl)

                Button(viewModel.isRegistering ? "Already have an account? Log in" : "Create an account") {
                    viewModel.isRegistering.toggle()
                }
                .font(.sourceSerif(13))
                .foregroundStyle(Color.terracotta)

                Spacer()
            }
        }
    }
}
```

**Step 3: Build and verify**

Cmd+B in Xcode. Run on simulator to verify layout.

**Step 4: Commit**

```bash
git add apps/ios/
git commit -m "feat(ios): add login and registration views with Sign in with Apple"
```

---

## Summary

| Milestone | Tasks | Description |
|-----------|-------|-------------|
| 0 | 0 | iOS design system foundation (colors, typography, spacing, components) |
| 1 | 1-2 | API project setup, database schema |
| 2 | 3-6 | Auth service, routes, middleware |
| 3 | 7-8 | Thread CRUD service and routes |
| 4 | 9-10 | Sync endpoint |
| 5 | 11-15 | iOS project, SwiftData models, thread views, navigation |
| 6 | 16-17 | iOS networking and sync engine |
| 7 | 18 | iOS auth views |

**Total: 19 tasks across 8 milestones.**

Milestone 0 (design system) and Milestones 5-7 (iOS) require Xcode. Milestones 1-4 (API) can be built and tested entirely from the command line.

The API is designed to be fully functional and tested before the iOS app connects to it.

All iOS views use the design system tokens from Milestone 0 — see `docs/plans/2026-02-16-design-system.md` for the full specification.
