# Stitch Stash Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "Stitch Stash" feature — a personalized canvas collection where users catalog needlepoint canvases they own, with image upload support.

**Architecture:** New `canvases` entity following the existing thread pattern (Drizzle schema → service → routes → tests). New `storage` module with a `StorageProvider` interface for image handling, starting with local filesystem for dev. Sync extended to support `"canvas"` entity type. Canvas records store an `imageKey` (not a URL) resolved at runtime by the API.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL, Zod, Vitest, Node.js `fs/promises` (local storage)

**Design doc:** `docs/plans/2026-02-18-stitch-stash-design.md`

---

### Task 1: Canvas Database Schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add the canvases table to the Drizzle schema**

Add this after the `threads` table in `apps/api/src/db/schema.ts`:

```typescript
export const canvases = pgTable("canvases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  designer: text("designer").notNull(),
  designName: text("design_name").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  imageKey: text("image_key"),
  size: text("size"),
  meshCount: integer("mesh_count"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

**Step 2: Generate and run the Drizzle migration**

Run:
```bash
cd apps/api && npx drizzle-kit generate
cd apps/api && npx drizzle-kit migrate
```

Expected: Migration file created in `apps/api/drizzle/` and applied successfully.

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add canvases table to database schema"
```

---

### Task 2: Canvas Zod Schemas

**Files:**
- Create: `apps/api/src/canvases/schemas.ts`

**Step 1: Create the validation schemas**

Create `apps/api/src/canvases/schemas.ts`:

```typescript
import { z } from "zod";

export const createCanvasSchema = z.object({
  id: z.string().uuid().optional(),
  designer: z.string().min(1).max(200),
  designName: z.string().min(1).max(200),
  acquiredAt: z.string().datetime().optional(),
  size: z.string().max(100).optional(),
  meshCount: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCanvasSchema = createCanvasSchema.omit({ id: true }).partial();

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
```

**Step 2: Commit**

```bash
git add apps/api/src/canvases/schemas.ts
git commit -m "feat(api): add canvas Zod validation schemas"
```

---

### Task 3: Canvas Service — Tests First

**Files:**
- Create: `apps/api/tests/canvases/canvas-service.test.ts`

**Step 1: Write the failing tests**

Create `apps/api/tests/canvases/canvas-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("CanvasService", () => {
  let canvasService: CanvasService;
  let userId: string;

  beforeAll(async () => {
    canvasService = new CanvasService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `canvas-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Canvas Tester",
    });
    userId = user.id;
  });

  it("creates and retrieves a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Melissa Shirley",
      designName: "Christmas Nutcracker",
    });

    expect(canvas.id).toBeDefined();
    expect(canvas.designer).toBe("Melissa Shirley");
    expect(canvas.designName).toBe("Christmas Nutcracker");
    expect(canvas.imageKey).toBeNull();

    const fetched = await canvasService.getById(userId, canvas.id);
    expect(fetched?.designer).toBe("Melissa Shirley");
  });

  it("creates a canvas with all optional fields", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Kirk & Bradley",
      designName: "Gingerbread House",
      acquiredAt: "2025-12-25T00:00:00.000Z",
      size: "14x18",
      meshCount: 18,
      notes: "Gift from Mom",
    });

    expect(canvas.size).toBe("14x18");
    expect(canvas.meshCount).toBe(18);
    expect(canvas.notes).toBe("Gift from Mom");
    expect(canvas.acquiredAt).toBeDefined();
  });

  it("creates a canvas with a client-provided UUID", async () => {
    const clientId = crypto.randomUUID();
    const canvas = await canvasService.create(userId, {
      id: clientId,
      designer: "Lee",
      designName: "Dragonfly",
    });

    expect(canvas.id).toBe(clientId);
  });

  it("lists canvases for a user ordered by createdAt desc", async () => {
    const canvases = await canvasService.listByUser(userId);
    expect(canvases.length).toBeGreaterThan(0);

    // Verify descending order
    for (let i = 1; i < canvases.length; i++) {
      expect(canvases[i - 1].createdAt >= canvases[i].createdAt).toBe(true);
    }
  });

  it("updates a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Zecca",
      designName: "Pumpkin",
    });

    const updated = await canvasService.update(userId, canvas.id, {
      meshCount: 13,
      notes: "Started stitching",
    });

    expect(updated.meshCount).toBe(13);
    expect(updated.notes).toBe("Started stitching");
    expect(updated.designer).toBe("Zecca");
  });

  it("soft deletes a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Labors of Love",
      designName: "Snowflake",
    });

    await canvasService.softDelete(userId, canvas.id);

    const fetched = await canvasService.getById(userId, canvas.id);
    expect(fetched).toBeNull();
  });

  it("does not return soft-deleted canvases in list", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DeleteListTest",
      designName: "Test Canvas",
    });

    await canvasService.softDelete(userId, canvas.id);

    const canvases = await canvasService.listByUser(userId);
    const found = canvases.find((c) => c.id === canvas.id);
    expect(found).toBeUndefined();
  });

  it("rejects updating a soft-deleted canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "SoftDelUpdate",
      designName: "Test",
    });

    await canvasService.softDelete(userId, canvas.id);

    try {
      await canvasService.update(userId, canvas.id, { notes: "nope" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("prevents accessing another user's canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DMC",
      designName: "Cross Stitch Kit",
    });

    const fetched = await canvasService.getById("00000000-0000-0000-0000-000000000000", canvas.id);
    expect(fetched).toBeNull();
  });

  it("prevents updating another user's canvas with NotFoundError", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Another User Test",
      designName: "Forbidden Canvas",
    });

    try {
      await canvasService.update("00000000-0000-0000-0000-000000000000", canvas.id, { notes: "hacked" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).message).toBe("Canvas not found");
    }
  });

  it("updates imageKey on a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "ImageTest",
      designName: "Test Image",
    });

    const updated = await canvasService.update(userId, canvas.id, {});
    // Use the service's dedicated method for image key updates
    const withImage = await canvasService.setImageKey(userId, canvas.id, "canvases/test/image.jpg");
    expect(withImage.imageKey).toBe("canvases/test/image.jpg");

    const cleared = await canvasService.setImageKey(userId, canvas.id, null);
    expect(cleared.imageKey).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/canvases/canvas-service.test.ts`

Expected: FAIL — `CanvasService` module not found.

**Step 3: Commit failing tests**

```bash
git add apps/api/tests/canvases/canvas-service.test.ts
git commit -m "test(api): add failing canvas service tests"
```

---

### Task 4: Canvas Service — Implementation

**Files:**
- Create: `apps/api/src/canvases/canvas-service.ts`

**Step 1: Implement the CanvasService**

Create `apps/api/src/canvases/canvas-service.ts`:

```typescript
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { canvases } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateCanvasInput, UpdateCanvasInput } from "./schemas.js";

export class CanvasService {
  async create(userId: string, input: CreateCanvasInput) {
    const [canvas] = await db
      .insert(canvases)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        designer: input.designer,
        designName: input.designName,
        acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : undefined,
        size: input.size,
        meshCount: input.meshCount,
        notes: input.notes,
      })
      .returning();

    return canvas;
  }

  async getById(userId: string, id: string) {
    const [canvas] = await db
      .select()
      .from(canvases)
      .where(and(eq(canvases.id, id), eq(canvases.userId, userId), isNull(canvases.deletedAt)))
      .limit(1);

    return canvas ?? null;
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(canvases)
      .where(and(eq(canvases.userId, userId), isNull(canvases.deletedAt)))
      .orderBy(desc(canvases.createdAt));
  }

  async update(userId: string, id: string, input: UpdateCanvasInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.designer !== undefined) updateData.designer = input.designer;
    if (input.designName !== undefined) updateData.designName = input.designName;
    if (input.acquiredAt !== undefined) updateData.acquiredAt = new Date(input.acquiredAt);
    if (input.size !== undefined) updateData.size = input.size;
    if (input.meshCount !== undefined) updateData.meshCount = input.meshCount;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const [updated] = await db
      .update(canvases)
      .set(updateData)
      .where(and(eq(canvases.id, id), eq(canvases.userId, userId), isNull(canvases.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Canvas");
    return updated;
  }

  async setImageKey(userId: string, id: string, imageKey: string | null) {
    const [updated] = await db
      .update(canvases)
      .set({ imageKey, updatedAt: new Date() })
      .where(and(eq(canvases.id, id), eq(canvases.userId, userId), isNull(canvases.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Canvas");
    return updated;
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(canvases)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(canvases.id, id), eq(canvases.userId, userId), isNull(canvases.deletedAt)))
      .returning();

    if (!deleted) throw new NotFoundError("Canvas");
    return deleted;
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/canvases/canvas-service.test.ts`

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add apps/api/src/canvases/canvas-service.ts
git commit -m "feat(api): implement canvas service with CRUD and image key"
```

---

### Task 5: Canvas Routes — Tests First

**Files:**
- Create: `apps/api/tests/canvases/canvas-routes.test.ts`

**Step 1: Write the failing route tests**

Create `apps/api/tests/canvases/canvas-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Canvas Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `canvas-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Canvas Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = body.accessToken;
  });

  it("POST /canvases creates a canvas", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Melissa Shirley",
        designName: "Christmas Nutcracker",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.designer).toBe("Melissa Shirley");
    expect(body.designName).toBe("Christmas Nutcracker");
  });

  it("POST /canvases creates a canvas with all optional fields", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Kirk & Bradley",
        designName: "Gingerbread House",
        acquiredAt: "2025-12-25T00:00:00.000Z",
        size: "14x18",
        meshCount: 18,
        notes: "Gift from Mom",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.size).toBe("14x18");
    expect(body.meshCount).toBe(18);
  });

  it("GET /canvases lists user canvases", async () => {
    const res = await app.request("/canvases", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /canvases/:id returns a single canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "GetById", designName: "Test" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.designer).toBe("GetById");
    expect(body.id).toBe(created.id);
  });

  it("GET /canvases/:id returns 404 for non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /canvases/:id returns 400 for invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });

  it("PUT /canvases/:id updates a canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Update Test", designName: "Original" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ meshCount: 13, notes: "Updated" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meshCount).toBe(13);
    expect(body.notes).toBe("Updated");
  });

  it("DELETE /canvases/:id soft deletes a canvas", async () => {
    const createRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "Delete Test", designName: "Bye" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/canvases/${created.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const getRes = await app.request(`/canvases/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.status).toBe(404);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/canvases");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid canvas input", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ designer: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for updating non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 for updating with invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notes: "nope" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });

  it("returns 404 for deleting non-existent canvas", async () => {
    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 for deleting with invalid UUID", async () => {
    const res = await app.request("/canvases/not-a-uuid", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid canvas ID");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/canvases/canvas-routes.test.ts`

Expected: FAIL — `/canvases` route not found (404s).

**Step 3: Commit failing tests**

```bash
git add apps/api/tests/canvases/canvas-routes.test.ts
git commit -m "test(api): add failing canvas route tests"
```

---

### Task 6: Canvas Routes — Implementation

**Files:**
- Create: `apps/api/src/canvases/canvas-routes.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Implement the canvas routes**

Create `apps/api/src/canvases/canvas-routes.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { CanvasService } from "./canvas-service.js";
import { createCanvasSchema, updateCanvasSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const canvasRoutes = new Hono<AuthEnv>();
const canvasService = new CanvasService();
const uuidSchema = z.string().uuid();

canvasRoutes.use("/*", authMiddleware);

canvasRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const canvases = await canvasService.listByUser(userId);
  return c.json(canvases);
});

canvasRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }
  return c.json(canvas);
});

canvasRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const canvas = await canvasService.create(userId, parsed.data);
  return c.json(canvas, 201);
});

canvasRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const canvas = await canvasService.update(userId, idResult.data, parsed.data);
    return c.json(canvas);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

canvasRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  try {
    await canvasService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { canvasRoutes };
```

**Step 2: Mount the canvas routes in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { canvasRoutes } from "./canvases/canvas-routes.js";
```

And add this line after the existing route mounts:

```typescript
app.route("/canvases", canvasRoutes);
```

**Step 3: Run all canvas tests**

Run: `cd apps/api && npx vitest run tests/canvases/`

Expected: All tests PASS.

**Step 4: Run all tests to verify nothing is broken**

Run: `cd apps/api && npx vitest run`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/api/src/canvases/canvas-routes.ts apps/api/src/app.ts
git commit -m "feat(api): add canvas CRUD routes"
```

---

### Task 7: StorageProvider Interface and LocalStorageProvider — Tests First

**Files:**
- Create: `apps/api/tests/storage/storage-provider.test.ts`

**Step 1: Write the failing tests**

Create `apps/api/tests/storage/storage-provider.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LocalStorageProvider } from "../../src/storage/local-storage-provider.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const TEST_UPLOAD_DIR = join(process.cwd(), "test-uploads");

describe("LocalStorageProvider", () => {
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    await mkdir(TEST_UPLOAD_DIR, { recursive: true });
    provider = new LocalStorageProvider(TEST_UPLOAD_DIR);
  });

  afterAll(async () => {
    await rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  });

  it("uploads a file and returns the key", async () => {
    const content = Buffer.from("fake image data");
    const key = "canvases/user1/canvas1.jpg";

    const resultKey = await provider.upload(content, key);
    expect(resultKey).toBe(key);
  });

  it("retrieves the file path for a stored key", async () => {
    const content = Buffer.from("another image");
    const key = "canvases/user1/canvas2.jpg";

    await provider.upload(content, key);
    const filePath = await provider.getFilePath(key);
    expect(filePath).toContain("canvas2.jpg");
  });

  it("deletes a stored file", async () => {
    const content = Buffer.from("to be deleted");
    const key = "canvases/user1/canvas3.jpg";

    await provider.upload(content, key);
    await provider.delete(key);

    const filePath = await provider.getFilePath(key);
    expect(filePath).toBeNull();
  });

  it("returns null for a non-existent key", async () => {
    const filePath = await provider.getFilePath("nonexistent/key.jpg");
    expect(filePath).toBeNull();
  });

  it("creates nested directories as needed", async () => {
    const content = Buffer.from("nested content");
    const key = "canvases/deep/nested/path/image.jpg";

    const resultKey = await provider.upload(content, key);
    expect(resultKey).toBe(key);

    const filePath = await provider.getFilePath(key);
    expect(filePath).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/storage/storage-provider.test.ts`

Expected: FAIL — `LocalStorageProvider` module not found.

**Step 3: Commit failing tests**

```bash
git add apps/api/tests/storage/storage-provider.test.ts
git commit -m "test(api): add failing storage provider tests"
```

---

### Task 8: StorageProvider Interface and LocalStorageProvider — Implementation

**Files:**
- Create: `apps/api/src/storage/storage-provider.ts`
- Create: `apps/api/src/storage/local-storage-provider.ts`

**Step 1: Create the StorageProvider interface**

Create `apps/api/src/storage/storage-provider.ts`:

```typescript
export interface StorageProvider {
  upload(content: Buffer, key: string): Promise<string>;
  getFilePath(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}
```

**Step 2: Implement LocalStorageProvider**

Create `apps/api/src/storage/local-storage-provider.ts`:

```typescript
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { StorageProvider } from "./storage-provider.js";

export class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string) {}

  async upload(content: Buffer, key: string): Promise<string> {
    const filePath = join(this.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    return key;
  }

  async getFilePath(key: string): Promise<string | null> {
    const filePath = join(this.baseDir, key);
    try {
      await access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.baseDir, key);
    try {
      await unlink(filePath);
    } catch {
      // File doesn't exist, nothing to delete
    }
  }
}
```

**Step 3: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/storage/storage-provider.test.ts`

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add apps/api/src/storage/storage-provider.ts apps/api/src/storage/local-storage-provider.ts
git commit -m "feat(api): add StorageProvider interface and local filesystem implementation"
```

---

### Task 9: Storage Instance Factory

**Files:**
- Create: `apps/api/src/storage/index.ts`

**Step 1: Create the storage factory**

Create `apps/api/src/storage/index.ts`:

```typescript
import { join } from "node:path";
import { LocalStorageProvider } from "./local-storage-provider.js";
import type { StorageProvider } from "./storage-provider.js";

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    const provider = process.env.STORAGE_PROVIDER ?? "local";

    if (provider === "local") {
      const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
      storageInstance = new LocalStorageProvider(uploadDir);
    } else {
      throw new Error(`Unknown storage provider: ${provider}`);
    }
  }

  return storageInstance;
}

export type { StorageProvider } from "./storage-provider.js";
```

**Step 2: Commit**

```bash
git add apps/api/src/storage/index.ts
git commit -m "feat(api): add storage provider factory with env-based selection"
```

---

### Task 10: Image Upload and Serve Routes — Tests First

**Files:**
- Create: `apps/api/tests/storage/image-routes.test.ts`

**Step 1: Write the failing tests**

Create `apps/api/tests/storage/image-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Image Routes", () => {
  let accessToken: string;
  let canvasId: string;

  beforeAll(async () => {
    // Register user
    const authRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `image-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Image Route Tester",
      }),
    });
    const authBody = await authRes.json();
    accessToken = authBody.accessToken;

    // Create a canvas to attach images to
    const canvasRes = await app.request("/canvases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Image Test Designer",
        designName: "Image Test Canvas",
      }),
    });
    const canvasBody = await canvasRes.json();
    canvasId = canvasBody.id;
  });

  it("POST /canvases/:id/image uploads an image", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageKey).toBeDefined();
    expect(body.imageKey).toContain(canvasId);
  });

  it("GET /images/* serves an uploaded image", async () => {
    // First upload an image
    const formData = new FormData();
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const blob = new Blob([imageData], { type: "image/jpeg" });
    formData.append("image", blob, "serve-test.jpg");

    const uploadRes = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploadBody = await uploadRes.json();

    // Then retrieve it
    const res = await app.request(`/images/${uploadBody.imageKey}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
  });

  it("GET /images/* returns 404 for non-existent key", async () => {
    const res = await app.request("/images/nonexistent/key.jpg", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
  });

  it("GET /images/* rejects unauthenticated requests", async () => {
    const res = await app.request("/images/some/key.jpg");
    expect(res.status).toBe(401);
  });

  it("POST /canvases/:id/image rejects unauthenticated requests", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(401);
  });

  it("POST /canvases/:id/image returns 404 for non-existent canvas", async () => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
    formData.append("image", blob, "test.jpg");

    const res = await app.request("/canvases/00000000-0000-0000-0000-000000000000/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /canvases/:id/image removes the image", async () => {
    // Upload first
    const formData = new FormData();
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    formData.append("image", blob, "delete-test.jpg");

    await app.request(`/canvases/${canvasId}/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    // Delete the image
    const res = await app.request(`/canvases/${canvasId}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);

    // Verify canvas imageKey is cleared
    const canvasRes = await app.request(`/canvases/${canvasId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const canvas = await canvasRes.json();
    expect(canvas.imageKey).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/storage/image-routes.test.ts`

Expected: FAIL — routes not found.

**Step 3: Commit failing tests**

```bash
git add apps/api/tests/storage/image-routes.test.ts
git commit -m "test(api): add failing image upload and serve route tests"
```

---

### Task 11: Image Upload and Serve Routes — Implementation

**Files:**
- Create: `apps/api/src/storage/image-routes.ts`
- Modify: `apps/api/src/canvases/canvas-routes.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create the image serving route**

Create `apps/api/src/storage/image-routes.ts`:

```typescript
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { getStorage } from "./index.js";

const imageRoutes = new Hono<AuthEnv>();

imageRoutes.use("/*", authMiddleware);

imageRoutes.get("/*", async (c) => {
  const key = c.req.path.replace("/images/", "");
  if (!key) {
    return c.json({ error: "Missing image key" }, 400);
  }

  const storage = getStorage();
  const filePath = await storage.getFilePath(key);

  if (!filePath) {
    return c.json({ error: "Image not found" }, 404);
  }

  // For local storage, serve the file directly
  const content = await readFile(filePath);
  const ext = key.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" :
    ext === "heic" ? "image/heic" :
    "image/jpeg";

  return new Response(content, {
    headers: { "Content-Type": contentType },
  });
});

export { imageRoutes };
```

**Step 2: Add image upload/delete to canvas routes**

Add these routes to the end of `apps/api/src/canvases/canvas-routes.ts` (before the `export`):

```typescript
import { getStorage } from "../storage/index.js";

canvasRoutes.post("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("image");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No image file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `canvases/${userId}/${idResult.data}.${ext}`;

  const storage = getStorage();

  // Delete old image if exists
  if (canvas.imageKey) {
    await storage.delete(canvas.imageKey);
  }

  await storage.upload(buffer, key);
  const updated = await canvasService.setImageKey(userId, idResult.data, key);

  return c.json(updated);
});

canvasRoutes.delete("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }

  if (canvas.imageKey) {
    const storage = getStorage();
    await storage.delete(canvas.imageKey);
  }

  const updated = await canvasService.setImageKey(userId, idResult.data, null);
  return c.json(updated);
});
```

**Step 3: Mount image routes in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { imageRoutes } from "./storage/image-routes.js";
```

And:

```typescript
app.route("/images", imageRoutes);
```

**Step 4: Run all image and canvas tests**

Run: `cd apps/api && npx vitest run tests/storage/ tests/canvases/`

Expected: All tests PASS.

**Step 5: Run all tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/api/src/storage/image-routes.ts apps/api/src/canvases/canvas-routes.ts apps/api/src/app.ts
git commit -m "feat(api): add image upload, delete, and serving routes"
```

---

### Task 12: Sync Integration — Tests First

**Files:**
- Modify: `apps/api/tests/sync/sync-service.test.ts`

**Step 1: Read existing sync tests**

Read `apps/api/tests/sync/sync-service.test.ts` to understand the current test structure.

**Step 2: Add canvas sync tests**

Add a new `describe("canvas sync", ...)` block to the existing sync test file with these tests:

- Syncs a new canvas from client to server (upsert)
- Syncs canvas changes (client newer wins)
- Server wins on ties for canvas changes
- Syncs canvas soft-delete from client
- Returns canvas changes since lastSync
- Rejects unknown fields on canvas sync (only allowlisted fields)

Pattern: Follow the exact same structure as the existing thread sync tests.

**Step 3: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/sync/`

Expected: FAIL — `"canvas"` not recognized as sync entity type.

**Step 4: Commit failing tests**

```bash
git add apps/api/tests/sync/sync-service.test.ts
git commit -m "test(api): add failing canvas sync tests"
```

---

### Task 13: Sync Integration — Implementation

**Files:**
- Modify: `apps/api/src/sync/schemas.ts`
- Modify: `apps/api/src/sync/sync-service.ts`
- Modify: `apps/api/src/sync/sync-routes.ts`

**Step 1: Update sync schema to accept canvas type**

In `apps/api/src/sync/schemas.ts`, change:

```typescript
type: z.enum(["thread"]),
```

to:

```typescript
type: z.enum(["thread", "canvas"]),
```

**Step 2: Add canvas processing to SyncService**

In `apps/api/src/sync/sync-service.ts`:

1. Import `canvases` from schema
2. Add `ALLOWED_CANVAS_FIELDS` set: `designer`, `designName`, `acquiredAt`, `imageKey`, `size`, `meshCount`, `notes`
3. Add `pickAllowedCanvasFields` function (or make `pickAllowedFields` generic by accepting the field set as a parameter)
4. Add `processCanvasChange` method mirroring `processThreadChange` but using `canvases` table and canvas-specific required fields (`designer`, `designName`)
5. Update `sync()` method to dispatch `"canvas"` changes to `processCanvasChange`
6. Update `getChangesSince` to also query `canvases` table and merge results

**Step 3: Update sync route error handling**

In `apps/api/src/sync/sync-routes.ts`, update the error message from `"Invalid thread data"` to `"Invalid sync data"` since it now handles both threads and canvases.

**Step 4: Run sync tests**

Run: `cd apps/api && npx vitest run tests/sync/`

Expected: All tests PASS.

**Step 5: Run all tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/api/src/sync/schemas.ts apps/api/src/sync/sync-service.ts apps/api/src/sync/sync-routes.ts
git commit -m "feat(api): add canvas entity to sync service"
```

---

### Task 14: Add uploads directory to .gitignore

**Files:**
- Modify: `apps/api/.gitignore` (create if it doesn't exist)

**Step 1: Ensure uploads and test-uploads are ignored**

Add to the API .gitignore:

```
uploads/
test-uploads/
```

**Step 2: Commit**

```bash
git add apps/api/.gitignore
git commit -m "chore(api): ignore upload directories"
```

---

### Task 15: Final verification — run all API tests

**Step 1: Run the full test suite**

Run: `cd apps/api && npx vitest run`

Expected: All tests PASS. No regressions.

**Step 2: Verify test count has increased**

The test suite should now include:
- `tests/canvases/canvas-service.test.ts` (~10 tests)
- `tests/canvases/canvas-routes.test.ts` (~14 tests)
- `tests/storage/storage-provider.test.ts` (~5 tests)
- `tests/storage/image-routes.test.ts` (~7 tests)
- Updated sync tests (~6 new canvas tests)
- All existing auth, thread, and sync tests still passing

---

## Summary of Files

**New files:**
- `apps/api/src/canvases/schemas.ts` — Zod validation schemas
- `apps/api/src/canvases/canvas-service.ts` — CRUD + image key service
- `apps/api/src/canvases/canvas-routes.ts` — REST routes + image upload/delete
- `apps/api/src/storage/storage-provider.ts` — StorageProvider interface
- `apps/api/src/storage/local-storage-provider.ts` — Local filesystem implementation
- `apps/api/src/storage/index.ts` — Factory/singleton
- `apps/api/src/storage/image-routes.ts` — Image serving route
- `apps/api/tests/canvases/canvas-service.test.ts`
- `apps/api/tests/canvases/canvas-routes.test.ts`
- `apps/api/tests/storage/storage-provider.test.ts`
- `apps/api/tests/storage/image-routes.test.ts`

**Modified files:**
- `apps/api/src/db/schema.ts` — Add canvases table
- `apps/api/src/app.ts` — Mount canvas and image routes
- `apps/api/src/sync/schemas.ts` — Add "canvas" to entity type enum
- `apps/api/src/sync/sync-service.ts` — Add canvas sync processing
- `apps/api/src/sync/sync-routes.ts` — Update error message
- `apps/api/tests/sync/sync-service.test.ts` — Add canvas sync tests
- `apps/api/.gitignore` — Ignore upload dirs
