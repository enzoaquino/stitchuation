# Kitting Materials List — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to manage a materials checklist for pieces in kitting+ status, with manual entry and OCR import from stitch guide photos.

**Architecture:** New `PieceMaterial` entity (child of `StitchPiece`) with `materialType` discriminator. API CRUD endpoints nested under `/pieces/:id/materials`. Sync via existing `POST /sync` with new `pieceMaterial` change type. iOS OCR uses Apple Vision `VNRecognizeTextRequest` with brand-aware heuristic parsing. Materials are standalone checklists — no inventory linking yet.

**Tech Stack:** API: Hono + Drizzle + Zod + PostgreSQL. iOS: SwiftUI + SwiftData + Vision framework.

**Design doc:** `docs/plans/2026-02-24-kitting-materials-design.md`

---

## Task 1: API — Database Schema & Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Generated: `apps/api/drizzle/XXXX_*.sql` (auto-generated migration)

**Step 1: Add `materialTypeEnum` and `pieceMaterials` table to schema**

Add to `apps/api/src/db/schema.ts` after the `journalImages` table:

```typescript
export const materialTypeEnum = pgEnum("material_type", [
  "thread", "bead", "accessory", "other"
]);

export const pieceMaterials = pgTable("piece_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  pieceId: uuid("piece_id").notNull().references(() => stitchPieces.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  materialType: materialTypeEnum("material_type").notNull().default("other"),
  brand: text("brand"),
  name: text("name").notNull(),
  code: text("code"),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit"),
  notes: text("notes"),
  acquired: integer("acquired").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("piece_materials_piece_id_idx").on(table.pieceId),
  index("piece_materials_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);
```

Notes:
- `acquired` is integer (0/1) not boolean — matches the pattern where Drizzle booleans can be tricky across sync. The API/iOS will treat it as a boolean.
- `userId` is included directly (same pattern as `journalEntries`) for sync queries and ownership checks.

**Step 2: Generate the migration**

Run: `cd apps/api && npx drizzle-kit generate`
Expected: New SQL migration file created in `apps/api/drizzle/`.

**Step 3: Run the migration**

Run: `cd apps/api && npx drizzle-kit migrate`
Expected: Migration applied, `piece_materials` table and `material_type` enum created.

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add piece_materials table and material_type enum"
```

---

## Task 2: API — Material Validation Schemas

**Files:**
- Modify: `apps/api/src/pieces/schemas.ts`

**Step 1: Write failing test for schema validation**

Create `apps/api/tests/pieces/material-schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createMaterialSchema,
  updateMaterialSchema,
  batchCreateMaterialsSchema,
  materialTypes,
} from "../../src/pieces/schemas.js";

describe("Material Schemas", () => {
  describe("createMaterialSchema", () => {
    it("accepts minimal valid input", () => {
      const result = createMaterialSchema.safeParse({ name: "Dark Green" });
      expect(result.success).toBe(true);
    });

    it("accepts full valid input", () => {
      const result = createMaterialSchema.safeParse({
        id: crypto.randomUUID(),
        materialType: "thread",
        brand: "Splendor",
        name: "Dark Green",
        code: "S832",
        quantity: 2,
        unit: "Card",
        notes: "for 18 ct",
        acquired: true,
        sortOrder: 3,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createMaterialSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid materialType", () => {
      const result = createMaterialSchema.safeParse({
        name: "Test",
        materialType: "fabric",
      });
      expect(result.success).toBe(false);
    });

    it("rejects quantity of 0", () => {
      const result = createMaterialSchema.safeParse({
        name: "Test",
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("defaults materialType to other", () => {
      const result = createMaterialSchema.safeParse({ name: "Needle" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.materialType).toBeUndefined();
      }
    });
  });

  describe("updateMaterialSchema", () => {
    it("accepts partial update", () => {
      const result = updateMaterialSchema.safeParse({ acquired: true });
      expect(result.success).toBe(true);
    });

    it("rejects empty update", () => {
      const result = updateMaterialSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("batchCreateMaterialsSchema", () => {
    it("accepts array of materials", () => {
      const result = batchCreateMaterialsSchema.safeParse([
        { name: "Dark Green", brand: "Splendor", code: "S832" },
        { name: "Antique Mauve", brand: "Flair", code: "F511" },
      ]);
      expect(result.success).toBe(true);
    });

    it("rejects more than 50 items", () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ name: `Item ${i}` }));
      const result = batchCreateMaterialsSchema.safeParse(items);
      expect(result.success).toBe(false);
    });

    it("rejects empty array", () => {
      const result = batchCreateMaterialsSchema.safeParse([]);
      expect(result.success).toBe(false);
    });
  });

  it("materialTypes has correct values", () => {
    expect(materialTypes).toEqual(["thread", "bead", "accessory", "other"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/pieces/material-schemas.test.ts`
Expected: FAIL — imports don't exist yet.

**Step 3: Add schemas to `apps/api/src/pieces/schemas.ts`**

Add after the existing exports:

```typescript
export const materialTypes = ["thread", "bead", "accessory", "other"] as const;
export type MaterialType = typeof materialTypes[number];

export const createMaterialSchema = z.object({
  id: z.string().uuid().optional(),
  materialType: z.enum(materialTypes).optional(),
  brand: z.string().max(200).optional(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  acquired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateMaterialSchema = z.object({
  materialType: z.enum(materialTypes).optional(),
  brand: z.string().max(200).nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).nullable().optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  acquired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine((obj) => Object.keys(obj).length > 0, {
  message: "At least one field is required",
});

export const batchCreateMaterialsSchema = z.array(createMaterialSchema).min(1).max(50);

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/pieces/material-schemas.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/pieces/schemas.ts apps/api/tests/pieces/material-schemas.test.ts
git commit -m "feat(api): add material validation schemas with tests"
```

---

## Task 3: API — Material Service

**Files:**
- Create: `apps/api/src/pieces/material-service.ts`
- Create: `apps/api/tests/pieces/material-service.test.ts`

**Step 1: Write failing tests**

Create `apps/api/tests/pieces/material-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { MaterialService } from "../../src/pieces/material-service.js";
import { PieceService } from "../../src/pieces/piece-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

describe("MaterialService", () => {
  let materialService: MaterialService;
  let pieceService: PieceService;
  let userId: string;
  let pieceId: string;

  beforeAll(async () => {
    materialService = new MaterialService();
    pieceService = new PieceService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `material-svc-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Material Tester",
    });
    userId = user.id;

    const piece = await pieceService.create(userId, {
      designer: "Test Designer",
      designName: "Test Canvas",
    });
    pieceId = piece.id;
  });

  it("creates a material with minimal fields", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Dark Green",
    });
    expect(material.name).toBe("Dark Green");
    expect(material.materialType).toBe("other");
    expect(material.quantity).toBe(1);
    expect(material.acquired).toBe(0);
    expect(material.pieceId).toBe(pieceId);
    expect(material.userId).toBe(userId);
  });

  it("creates a material with all fields", async () => {
    const material = await materialService.create(userId, pieceId, {
      materialType: "thread",
      brand: "Splendor",
      name: "Dark Green",
      code: "S832",
      quantity: 2,
      unit: "Card",
      notes: "for 18 ct",
      acquired: true,
      sortOrder: 5,
    });
    expect(material.brand).toBe("Splendor");
    expect(material.code).toBe("S832");
    expect(material.materialType).toBe("thread");
    expect(material.acquired).toBe(1);
    expect(material.sortOrder).toBe(5);
  });

  it("creates a material with client-provided ID", async () => {
    const id = crypto.randomUUID();
    const material = await materialService.create(userId, pieceId, {
      id,
      name: "Client ID Test",
    });
    expect(material.id).toBe(id);
  });

  it("lists materials for a piece excluding soft-deleted", async () => {
    const m1 = await materialService.create(userId, pieceId, { name: "List Test 1", sortOrder: 0 });
    const m2 = await materialService.create(userId, pieceId, { name: "List Test 2", sortOrder: 1 });
    await materialService.softDelete(userId, m2.id);

    const list = await materialService.list(userId, pieceId);
    const names = list.map((m) => m.name);
    expect(names).toContain("List Test 1");
    expect(names).not.toContain("List Test 2");
  });

  it("lists materials ordered by sortOrder", async () => {
    // Create a fresh piece to isolate ordering test
    const piece = await pieceService.create(userId, {
      designer: "Order Test",
      designName: "Order Canvas",
    });
    await materialService.create(userId, piece.id, { name: "Second", sortOrder: 1 });
    await materialService.create(userId, piece.id, { name: "First", sortOrder: 0 });

    const list = await materialService.list(userId, piece.id);
    expect(list[0].name).toBe("First");
    expect(list[1].name).toBe("Second");
  });

  it("gets a material by ID", async () => {
    const created = await materialService.create(userId, pieceId, { name: "Get Test" });
    const fetched = await materialService.getById(userId, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Get Test");
  });

  it("returns null for non-existent material", async () => {
    const fetched = await materialService.getById(userId, crypto.randomUUID());
    expect(fetched).toBeNull();
  });

  it("updates a material", async () => {
    const created = await materialService.create(userId, pieceId, { name: "Update Test" });
    const updated = await materialService.update(userId, created.id, {
      name: "Updated Name",
      acquired: true,
    });
    expect(updated.name).toBe("Updated Name");
    expect(updated.acquired).toBe(1);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  it("soft deletes a material", async () => {
    const created = await materialService.create(userId, pieceId, { name: "Delete Test" });
    const deleted = await materialService.softDelete(userId, created.id);
    expect(deleted.deletedAt).not.toBeNull();

    const fetched = await materialService.getById(userId, created.id);
    expect(fetched).toBeNull();
  });

  it("throws NotFoundError when updating non-existent material", async () => {
    await expect(
      materialService.update(userId, crypto.randomUUID(), { name: "Nope" })
    ).rejects.toThrow("Material not found");
  });

  it("throws NotFoundError when deleting non-existent material", async () => {
    await expect(
      materialService.softDelete(userId, crypto.randomUUID())
    ).rejects.toThrow("Material not found");
  });

  it("batch creates materials", async () => {
    const piece = await pieceService.create(userId, {
      designer: "Batch Test",
      designName: "Batch Canvas",
    });
    const materials = await materialService.batchCreate(userId, piece.id, [
      { name: "Thread 1", materialType: "thread", sortOrder: 0 },
      { name: "Bead 1", materialType: "bead", sortOrder: 1 },
      { name: "Needle", materialType: "accessory", sortOrder: 2 },
    ]);
    expect(materials).toHaveLength(3);
    expect(materials[0].name).toBe("Thread 1");
    expect(materials[2].materialType).toBe("accessory");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/pieces/material-service.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Implement the service**

Create `apps/api/src/pieces/material-service.ts`:

```typescript
import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { pieceMaterials } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateMaterialInput, UpdateMaterialInput } from "./schemas.js";

export class MaterialService {
  async create(userId: string, pieceId: string, input: CreateMaterialInput) {
    const [material] = await db
      .insert(pieceMaterials)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        pieceId,
        materialType: input.materialType ?? "other",
        brand: input.brand ?? null,
        name: input.name,
        code: input.code ?? null,
        quantity: input.quantity ?? 1,
        unit: input.unit ?? null,
        notes: input.notes ?? null,
        acquired: input.acquired ? 1 : 0,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    return material;
  }

  async batchCreate(userId: string, pieceId: string, items: CreateMaterialInput[]) {
    const values = items.map((input, index) => ({
      ...(input.id ? { id: input.id } : {}),
      userId,
      pieceId,
      materialType: input.materialType ?? ("other" as const),
      brand: input.brand ?? null,
      name: input.name,
      code: input.code ?? null,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? null,
      notes: input.notes ?? null,
      acquired: input.acquired ? 1 : 0,
      sortOrder: input.sortOrder ?? index,
    }));

    return db.insert(pieceMaterials).values(values).returning();
  }

  async list(userId: string, pieceId: string) {
    return db
      .select()
      .from(pieceMaterials)
      .where(
        and(
          eq(pieceMaterials.pieceId, pieceId),
          eq(pieceMaterials.userId, userId),
          isNull(pieceMaterials.deletedAt),
        ),
      )
      .orderBy(asc(pieceMaterials.sortOrder));
  }

  async getById(userId: string, id: string) {
    const [material] = await db
      .select()
      .from(pieceMaterials)
      .where(
        and(
          eq(pieceMaterials.id, id),
          eq(pieceMaterials.userId, userId),
          isNull(pieceMaterials.deletedAt),
        ),
      )
      .limit(1);

    return material ?? null;
  }

  async update(userId: string, id: string, input: UpdateMaterialInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.materialType !== undefined) updateData.materialType = input.materialType;
    if (input.brand !== undefined) updateData.brand = input.brand;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.code !== undefined) updateData.code = input.code;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.acquired !== undefined) updateData.acquired = input.acquired ? 1 : 0;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    const [updated] = await db
      .update(pieceMaterials)
      .set(updateData)
      .where(
        and(
          eq(pieceMaterials.id, id),
          eq(pieceMaterials.userId, userId),
          isNull(pieceMaterials.deletedAt),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundError("Material");
    return updated;
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(pieceMaterials)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(pieceMaterials.id, id),
          eq(pieceMaterials.userId, userId),
          isNull(pieceMaterials.deletedAt),
        ),
      )
      .returning();

    if (!deleted) throw new NotFoundError("Material");
    return deleted;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/pieces/material-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/pieces/material-service.ts apps/api/tests/pieces/material-service.test.ts
git commit -m "feat(api): add MaterialService with CRUD and batch create"
```

---

## Task 4: API — Material Routes

**Files:**
- Modify: `apps/api/src/pieces/piece-routes.ts`
- Create: `apps/api/tests/pieces/material-routes.test.ts`

**Step 1: Write failing route tests**

Create `apps/api/tests/pieces/material-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("Material Routes", () => {
  let accessToken: string;
  let pieceId: string;

  beforeAll(async () => {
    // Register user
    const authRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `material-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Material Route Tester",
      }),
    });
    const authBody = await authRes.json();
    accessToken = authBody.accessToken;

    // Create a piece
    const pieceRes = await app.request("/pieces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        designer: "Test Designer",
        designName: "Test Canvas",
      }),
    });
    const pieceBody = await pieceRes.json();
    pieceId = pieceBody.id;
  });

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  });

  describe("POST /pieces/:id/materials", () => {
    it("creates a material with minimal fields", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Dark Green" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Dark Green");
      expect(body.pieceId).toBe(pieceId);
    });

    it("creates a material with all fields", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          materialType: "thread",
          brand: "Splendor",
          name: "Dark Green",
          code: "S832",
          quantity: 2,
          unit: "Card",
          notes: "for 18 ct",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.materialType).toBe("thread");
      expect(body.brand).toBe("Splendor");
    });

    it("returns 404 for non-existent piece", async () => {
      const res = await app.request(`/pieces/${crypto.randomUUID()}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Test" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /pieces/:id/materials/batch", () => {
    it("creates multiple materials", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials/batch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify([
          { name: "Batch 1", materialType: "thread" },
          { name: "Batch 2", materialType: "bead" },
        ]),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });

    it("returns 400 for empty array", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials/batch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /pieces/:id/materials", () => {
    it("lists materials for a piece", async () => {
      const res = await app.request(`/pieces/${pieceId}/materials`, {
        method: "GET",
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /pieces/:id/materials/:materialId", () => {
    it("updates a material", async () => {
      // Create one first
      const createRes = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Update Target" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/pieces/${pieceId}/materials/${created.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ acquired: true, name: "Updated" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated");
    });

    it("returns 404 for material belonging to different piece", async () => {
      // Create material on original piece
      const createRes = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Ownership Test" }),
      });
      const created = await createRes.json();

      // Create another piece
      const piece2Res = await app.request("/pieces", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ designer: "Other", designName: "Other Piece" }),
      });
      const piece2 = await piece2Res.json();

      // Try to update via wrong piece
      const res = await app.request(`/pieces/${piece2.id}/materials/${created.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Hijack" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /pieces/:id/materials/:materialId", () => {
    it("soft deletes a material", async () => {
      const createRes = await app.request(`/pieces/${pieceId}/materials`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: "Delete Target" }),
      });
      const created = await createRes.json();

      const res = await app.request(`/pieces/${pieceId}/materials/${created.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      expect(res.status).toBe(200);

      // Verify it's gone from listing
      const listRes = await app.request(`/pieces/${pieceId}/materials`, {
        method: "GET",
        headers: authHeaders(),
      });
      const list = await listRes.json();
      expect(list.find((m: any) => m.id === created.id)).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/pieces/material-routes.test.ts`
Expected: FAIL — routes don't exist.

**Step 3: Add routes to `piece-routes.ts`**

Add to `apps/api/src/pieces/piece-routes.ts`:

1. Import `MaterialService` and schemas at the top:
```typescript
import { MaterialService } from "./material-service.js";
import {
  createMaterialSchema,
  updateMaterialSchema,
  batchCreateMaterialsSchema,
} from "./schemas.js";
```

2. Instantiate service:
```typescript
const materialService = new MaterialService();
```

3. Add routes (after journal entry routes):

```typescript
// --- Material Routes ---

// GET /pieces/:id/materials
pieceRoutes.get("/:id/materials", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid piece ID" }, 400);

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) return c.json({ error: "Piece not found" }, 404);

  const materials = await materialService.list(userId, idResult.data);
  return c.json(materials);
});

// POST /pieces/:id/materials
pieceRoutes.post("/:id/materials", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid piece ID" }, 400);

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) return c.json({ error: "Piece not found" }, 404);

  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const material = await materialService.create(userId, idResult.data, parsed.data);
  return c.json(material, 201);
});

// POST /pieces/:id/materials/batch
pieceRoutes.post("/:id/materials/batch", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid piece ID" }, 400);

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) return c.json({ error: "Piece not found" }, 404);

  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = batchCreateMaterialsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const materials = await materialService.batchCreate(userId, idResult.data, parsed.data);
  return c.json(materials, 201);
});

// PUT /pieces/:id/materials/:materialId
pieceRoutes.put("/:id/materials/:materialId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid piece ID" }, 400);

  const materialIdResult = uuidSchema.safeParse(c.req.param("materialId"));
  if (!materialIdResult.success) return c.json({ error: "Invalid material ID" }, 400);

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) return c.json({ error: "Piece not found" }, 404);

  const existing = await materialService.getById(userId, materialIdResult.data);
  if (!existing || existing.pieceId !== idResult.data) {
    return c.json({ error: "Material not found" }, 404);
  }

  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateMaterialSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    const material = await materialService.update(userId, materialIdResult.data, parsed.data);
    return c.json(material);
  } catch (error) {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    throw error;
  }
});

// DELETE /pieces/:id/materials/:materialId
pieceRoutes.delete("/:id/materials/:materialId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid piece ID" }, 400);

  const materialIdResult = uuidSchema.safeParse(c.req.param("materialId"));
  if (!materialIdResult.success) return c.json({ error: "Invalid material ID" }, 400);

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) return c.json({ error: "Piece not found" }, 404);

  const existing = await materialService.getById(userId, materialIdResult.data);
  if (!existing || existing.pieceId !== idResult.data) {
    return c.json({ error: "Material not found" }, 404);
  }

  try {
    await materialService.softDelete(userId, materialIdResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    throw error;
  }
});
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/pieces/material-routes.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add apps/api/src/pieces/piece-routes.ts apps/api/tests/pieces/material-routes.test.ts
git commit -m "feat(api): add material CRUD routes under /pieces/:id/materials"
```

---

## Task 5: API — Sync Support for PieceMaterial

**Files:**
- Modify: `apps/api/src/sync/schemas.ts`
- Modify: `apps/api/src/sync/sync-service.ts`
- Create: `apps/api/tests/sync/sync-material.test.ts`

**Step 1: Write failing sync tests**

Create `apps/api/tests/sync/sync-material.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { PieceService } from "../../src/pieces/piece-service.js";
import { MaterialService } from "../../src/pieces/material-service.js";

describe("SyncService — PieceMaterial", () => {
  let syncService: SyncService;
  let pieceService: PieceService;
  let materialService: MaterialService;
  let userId: string;
  let pieceId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    pieceService = new PieceService();
    materialService = new MaterialService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `sync-material-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Sync Material Tester",
    });
    userId = user.id;

    const piece = await pieceService.create(userId, {
      designer: "Sync Test",
      designName: "Sync Canvas",
    });
    pieceId = piece.id;
  });

  it("pushes new material from client", async () => {
    const materialId = crypto.randomUUID();
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: {
          pieceId,
          materialType: "thread",
          brand: "DMC",
          name: "Black",
          code: "310",
          quantity: 1,
          unit: "Skein",
          acquired: false,
          sortOrder: 0,
        },
        updatedAt: new Date().toISOString(),
      }],
    });

    expect(result.serverTimestamp).toBeDefined();
    const material = await materialService.getById(userId, materialId);
    expect(material).not.toBeNull();
    expect(material!.brand).toBe("DMC");
    expect(material!.name).toBe("Black");
  });

  it("pulls material changes from server", async () => {
    const before = new Date(Date.now() - 1000).toISOString();

    await materialService.create(userId, pieceId, {
      name: "Server Material",
      materialType: "bead",
      brand: "Sundance",
    });

    const result = await syncService.sync(userId, {
      lastSync: before,
      changes: [],
    });

    const materialChange = result.changes.find(
      (c) => c.type === "pieceMaterial" && c.data?.name === "Server Material"
    );
    expect(materialChange).toBeDefined();
    expect(materialChange!.data!.materialType).toBe("bead");
  });

  it("updates existing material via sync", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Sync Update Test",
      acquired: false,
    });

    const futureTime = new Date(Date.now() + 10000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "pieceMaterial",
        action: "upsert",
        id: material.id,
        data: {
          acquired: true,
          name: "Sync Updated",
        },
        updatedAt: futureTime,
      }],
    });

    const updated = await materialService.getById(userId, material.id);
    expect(updated!.name).toBe("Sync Updated");
    expect(updated!.acquired).toBe(1);
  });

  it("soft deletes material via sync", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Sync Delete Test",
    });

    const futureTime = new Date(Date.now() + 10000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "pieceMaterial",
        action: "delete",
        id: material.id,
        updatedAt: futureTime,
        deletedAt: futureTime,
      }],
    });

    const deleted = await materialService.getById(userId, material.id);
    expect(deleted).toBeNull();
  });

  it("prevents re-parenting material via sync update", async () => {
    const piece2 = await pieceService.create(userId, {
      designer: "Other",
      designName: "Other Piece",
    });
    const material = await materialService.create(userId, pieceId, {
      name: "No Reparent",
    });

    const futureTime = new Date(Date.now() + 10000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "pieceMaterial",
        action: "upsert",
        id: material.id,
        data: {
          pieceId: piece2.id,
          name: "Attempted Reparent",
        },
        updatedAt: futureTime,
      }],
    });

    const updated = await materialService.getById(userId, material.id);
    expect(updated!.pieceId).toBe(pieceId); // Should NOT have changed
    expect(updated!.name).toBe("Attempted Reparent"); // Name should update
  });

  it("requires valid pieceId for new material insert", async () => {
    const materialId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: {
          pieceId: "not-a-uuid",
          name: "Bad PieceId",
        },
        updatedAt: new Date().toISOString(),
      }],
    });

    const material = await materialService.getById(userId, materialId);
    expect(material).toBeNull(); // Should have been silently skipped
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/sync/sync-material.test.ts`
Expected: FAIL — "pieceMaterial" not in sync schema enum.

**Step 3: Add "pieceMaterial" to sync schema**

In `apps/api/src/sync/schemas.ts`, update the type enum:

```typescript
type: z.enum(["thread", "piece", "journalEntry", "journalImage", "pieceMaterial"]),
```

**Step 4: Add pieceMaterial processing to sync service**

In `apps/api/src/sync/sync-service.ts`:

1. Add import for `pieceMaterials` in the schema import:
```typescript
import { threads, stitchPieces, journalEntries, journalImages, pieceMaterials } from "../db/schema.js";
```

2. Add `materialTypes` import:
```typescript
import { pieceStatuses, materialTypes } from "../pieces/schemas.js";
```

3. Add allowlisted fields constant:
```typescript
const ALLOWED_PIECE_MATERIAL_FIELDS = new Set([
  "pieceId",
  "materialType",
  "brand",
  "name",
  "code",
  "quantity",
  "unit",
  "notes",
  "acquired",
  "sortOrder",
]);
```

4. Add dispatch in `sync()` method's transaction loop:
```typescript
} else if (change.type === "pieceMaterial") {
  await this.processPieceMaterialChange(tx, userId, change);
}
```

5. Add the processing method (follows the `journalEntry` pattern since `pieceMaterials` has `userId`):

```typescript
private async processPieceMaterialChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
  const clientUpdatedAt = new Date(change.updatedAt);

  if (change.action === "delete") {
    const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

    const [existing] = await tx
      .select()
      .from(pieceMaterials)
      .where(and(eq(pieceMaterials.id, change.id), eq(pieceMaterials.userId, userId)))
      .limit(1);

    if (existing && existing.updatedAt < clientUpdatedAt) {
      await tx
        .update(pieceMaterials)
        .set({ deletedAt, updatedAt: clientUpdatedAt })
        .where(and(eq(pieceMaterials.id, change.id), eq(pieceMaterials.userId, userId)));
    }
    return;
  }

  const [existing] = await tx
    .select()
    .from(pieceMaterials)
    .where(and(eq(pieceMaterials.id, change.id), eq(pieceMaterials.userId, userId)))
    .limit(1);

  if (!existing) {
    const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_PIECE_MATERIAL_FIELDS) : {};
    const targetPieceId = allowed.pieceId as string | undefined;
    if (!targetPieceId || !UUID_REGEX.test(targetPieceId)) return;
    const materialType = materialTypes.includes(allowed.materialType as any) ? (allowed.materialType as any) : "other";
    await tx.insert(pieceMaterials).values({
      id: change.id,
      userId,
      pieceId: targetPieceId,
      materialType,
      brand: (allowed.brand as string) ?? null,
      name: (allowed.name as string) ?? "",
      code: (allowed.code as string) ?? null,
      quantity: (allowed.quantity as number) ?? 1,
      unit: (allowed.unit as string) ?? null,
      notes: (allowed.notes as string) ?? null,
      acquired: allowed.acquired ? 1 : 0,
      sortOrder: (allowed.sortOrder as number) ?? 0,
      createdAt: clientUpdatedAt,
      updatedAt: clientUpdatedAt,
    }).onConflictDoNothing();
  } else if (existing.updatedAt < clientUpdatedAt) {
    const updateData: Record<string, unknown> = {
      updatedAt: clientUpdatedAt,
    };
    if (change.data) {
      const allowed = pickAllowedFields(change.data, ALLOWED_PIECE_MATERIAL_FIELDS);
      delete allowed.pieceId; // Prevent re-parenting
      if (allowed.materialType !== undefined && !materialTypes.includes(allowed.materialType as any)) {
        delete allowed.materialType;
      }
      if (allowed.acquired !== undefined) {
        allowed.acquired = allowed.acquired ? 1 : 0;
      }
      Object.assign(updateData, allowed);
    }
    await tx
      .update(pieceMaterials)
      .set(updateData)
      .where(and(eq(pieceMaterials.id, change.id), eq(pieceMaterials.userId, userId)));
  }
}
```

6. Add to `getChangesSince()` — query changed materials and map them:

```typescript
const changedMaterials = await db
  .select()
  .from(pieceMaterials)
  .where(and(eq(pieceMaterials.userId, userId), gt(pieceMaterials.updatedAt, since)));

const materialChanges = changedMaterials.map((m) => ({
  type: "pieceMaterial" as const,
  action: m.deletedAt ? ("delete" as const) : ("upsert" as const),
  id: m.id,
  data: m.deletedAt
    ? undefined
    : {
        pieceId: m.pieceId,
        materialType: m.materialType,
        brand: m.brand,
        name: m.name,
        code: m.code,
        quantity: m.quantity,
        unit: m.unit,
        notes: m.notes,
        acquired: m.acquired === 1,
        sortOrder: m.sortOrder,
      },
  updatedAt: m.updatedAt.toISOString(),
  deletedAt: m.deletedAt?.toISOString(),
}));
```

7. Include in the return array:
```typescript
return [
  ...threadChanges,
  ...pieceChanges,
  ...journalEntryChanges,
  ...journalImageChanges,
  ...materialChanges,
];
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/sync/sync-material.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add apps/api/src/sync/schemas.ts apps/api/src/sync/sync-service.ts apps/api/tests/sync/sync-material.test.ts
git commit -m "feat(api): add pieceMaterial sync support with tests"
```

---

## Task 6: iOS — PieceMaterial Model & MaterialType Enum

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/PieceMaterial.swift`
- Create: `apps/ios/stitchuation/stitchuation/Models/MaterialType.swift`
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift` (add to ModelContainer)
- Create: `apps/ios/stitchuation/stitchuationTests/PieceMaterialTests.swift`

**Step 1: Write failing test**

Create `apps/ios/stitchuation/stitchuationTests/PieceMaterialTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("PieceMaterial Tests")
struct PieceMaterialTests {
    @Test("MaterialType has 4 cases")
    func materialTypeCaseCount() {
        #expect(MaterialType.allCases.count == 4)
    }

    @Test("MaterialType raw values match API values")
    func materialTypeRawValues() {
        #expect(MaterialType.thread.rawValue == "thread")
        #expect(MaterialType.bead.rawValue == "bead")
        #expect(MaterialType.accessory.rawValue == "accessory")
        #expect(MaterialType.other.rawValue == "other")
    }

    @Test("MaterialType display names are correct")
    func materialTypeDisplayNames() {
        #expect(MaterialType.thread.displayName == "Thread")
        #expect(MaterialType.bead.displayName == "Bead")
        #expect(MaterialType.accessory.displayName == "Accessory")
        #expect(MaterialType.other.displayName == "Other")
    }

    @Test("MaterialType Codable round-trip")
    func materialTypeCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        for type in MaterialType.allCases {
            let data = try encoder.encode(type)
            let decoded = try decoder.decode(MaterialType.self, from: data)
            #expect(decoded == type)
        }
    }

    @Test("PieceMaterial initializes with defaults")
    func defaultInit() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(piece: piece, name: "Dark Green")

        #expect(material.name == "Dark Green")
        #expect(material.materialType == .other)
        #expect(material.quantity == 1)
        #expect(material.acquired == false)
        #expect(material.sortOrder == 0)
        #expect(material.brand == nil)
        #expect(material.code == nil)
        #expect(material.unit == nil)
        #expect(material.notes == nil)
        #expect(material.deletedAt == nil)
    }

    @Test("PieceMaterial initializes with all fields")
    func fullInit() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Splendor",
            name: "Dark Green",
            code: "S832",
            quantity: 2,
            unit: "Card",
            notes: "for 18 ct",
            acquired: true,
            sortOrder: 3
        )

        #expect(material.materialType == .thread)
        #expect(material.brand == "Splendor")
        #expect(material.code == "S832")
        #expect(material.quantity == 2)
        #expect(material.unit == "Card")
        #expect(material.notes == "for 18 ct")
        #expect(material.acquired == true)
        #expect(material.sortOrder == 3)
    }

    @Test("PieceMaterial displayLine formats correctly")
    func displayLine() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")

        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832")
        #expect(m1.displayLine == "Splendor · Dark Green (S832)")

        let m2 = PieceMaterial(piece: piece, name: "Beading Needle")
        #expect(m2.displayLine == "Beading Needle")

        let m3 = PieceMaterial(piece: piece, brand: "DMC", name: "Black")
        #expect(m3.displayLine == "DMC · Black")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:stitchuationTests/PieceMaterialTests 2>&1 | tail -20`
Expected: FAIL — types don't exist.

**Step 3: Create MaterialType enum**

Create `apps/ios/stitchuation/stitchuation/Models/MaterialType.swift`:

```swift
import Foundation

enum MaterialType: String, Codable, CaseIterable {
    case thread
    case bead
    case accessory
    case other

    var displayName: String {
        switch self {
        case .thread: return "Thread"
        case .bead: return "Bead"
        case .accessory: return "Accessory"
        case .other: return "Other"
        }
    }
}
```

**Step 4: Create PieceMaterial model**

Create `apps/ios/stitchuation/stitchuation/Models/PieceMaterial.swift`:

```swift
import Foundation
import SwiftData

@Model
final class PieceMaterial {
    @Attribute(.unique) var id: UUID
    var piece: StitchPiece
    var materialType: MaterialType
    var brand: String?
    var name: String
    var code: String?
    var quantity: Int
    var unit: String?
    var notes: String?
    var acquired: Bool
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        piece: StitchPiece,
        materialType: MaterialType = .other,
        brand: String? = nil,
        name: String,
        code: String? = nil,
        quantity: Int = 1,
        unit: String? = nil,
        notes: String? = nil,
        acquired: Bool = false,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.piece = piece
        self.materialType = materialType
        self.brand = brand
        self.name = name
        self.code = code
        self.quantity = quantity
        self.unit = unit
        self.notes = notes
        self.acquired = acquired
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    /// Formatted display string: "Brand · Name (Code)" or subset
    var displayLine: String {
        var parts: [String] = []
        if let brand { parts.append(brand) }
        parts.append(name)
        var line = parts.joined(separator: " · ")
        if let code { line += " (\(code))" }
        return line
    }
}
```

**Step 5: Add `@Relationship` to StitchPiece and update ModelContainer**

In `apps/ios/stitchuation/stitchuation/Models/StitchPiece.swift`, add after the `entries` relationship:

```swift
@Relationship(deleteRule: .cascade, inverse: \PieceMaterial.piece)
var materials: [PieceMaterial] = []
```

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, add `PieceMaterial.self` to the `ModelContainer`:

```swift
modelContainer = try ModelContainer(for: NeedleThread.self, StitchPiece.self, JournalEntry.self, JournalImage.self, PendingUpload.self, PieceMaterial.self)
```

**Step 6: Run test to verify it passes**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:stitchuationTests/PieceMaterialTests 2>&1 | tail -20`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/MaterialType.swift \
        apps/ios/stitchuation/stitchuation/Models/PieceMaterial.swift \
        apps/ios/stitchuation/stitchuation/Models/StitchPiece.swift \
        apps/ios/stitchuation/stitchuation/stitchuationApp.swift \
        apps/ios/stitchuation/stitchuationTests/PieceMaterialTests.swift
git commit -m "feat(ios): add PieceMaterial model and MaterialType enum"
```

---

## Task 7: iOS — MaterialsSection View

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift`
- Create: `apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`

**Step 1: Create MaterialRowView**

Create `apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift`:

```swift
import SwiftUI

struct MaterialRowView: View {
    @Bindable var material: PieceMaterial

    var body: some View {
        HStack(spacing: Spacing.md) {
            Button {
                material.acquired.toggle()
                material.updatedAt = Date()
            } label: {
                Image(systemName: material.acquired ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(material.acquired ? Color.sage : Color.slate)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(material.displayLine)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(material.acquired ? Color.clay : Color.espresso)
                    .strikethrough(material.acquired, color: Color.clay)

                if material.quantity > 0 || material.unit != nil {
                    HStack(spacing: Spacing.xs) {
                        if material.quantity > 0 {
                            Text("\(material.quantity)")
                                .font(.typeStyle(.data))
                                .foregroundStyle(Color.walnut)
                        }
                        if let unit = material.unit {
                            Text(unit)
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.clay)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, Spacing.sm)
        .contentShape(Rectangle())
    }
}
```

**Step 2: Create MaterialsSection**

Create `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift`:

```swift
import SwiftUI

struct MaterialsSection: View {
    let piece: StitchPiece
    let onAddMaterial: () -> Void
    let onScanGuide: () -> Void
    let onEditMaterial: (PieceMaterial) -> Void

    private var activeMaterials: [PieceMaterial] {
        piece.materials
            .filter { $0.deletedAt == nil }
            .sorted { $0.sortOrder < $1.sortOrder }
    }

    private var acquiredCount: Int {
        activeMaterials.filter(\.acquired).count
    }

    private var progress: Double {
        guard !activeMaterials.isEmpty else { return 0 }
        return Double(acquiredCount) / Double(activeMaterials.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header with progress
            HStack {
                Text("Materials")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)

                Spacer()

                if !activeMaterials.isEmpty {
                    Text("\(acquiredCount)/\(activeMaterials.count) \u{2713}")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
            }

            // Progress bar
            if !activeMaterials.isEmpty {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.parchment)
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.sage)
                            .frame(width: geo.size.width * progress, height: 6)
                            .animation(.easeInOut(duration: 0.3), value: progress)
                    }
                }
                .frame(height: 6)

                Text("\(Int(progress * 100))%")
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.clay)
            }

            // Material list or empty state
            if activeMaterials.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: "No materials yet",
                    message: "Add supplies manually or scan your stitch guide"
                )
            } else {
                ForEach(activeMaterials, id: \.id) { material in
                    MaterialRowView(material: material)
                        .onTapGesture { onEditMaterial(material) }

                    if material.id != activeMaterials.last?.id {
                        Divider()
                            .background(Color.parchment)
                    }
                }
            }

            // Action buttons
            HStack(spacing: Spacing.md) {
                Button {
                    onAddMaterial()
                } label: {
                    Label("Add Material", systemImage: "plus")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }

                Button {
                    onScanGuide()
                } label: {
                    Label("Scan Guide", systemImage: "camera.viewfinder")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .padding(.top, Spacing.sm)
        }
        .padding(.horizontal, Spacing.lg)
    }
}
```

**Step 3: Add MaterialsSection to ProjectDetailView**

In `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`, add state variables:

```swift
@State private var showAddMaterial = false
@State private var showScanMaterials = false
@State private var editingMaterial: PieceMaterial? = nil
```

Add the MaterialsSection in the ScrollView's VStack, between the info section and journal section:

```swift
// Materials section
MaterialsSection(
    piece: piece,
    onAddMaterial: { showAddMaterial = true },
    onScanGuide: { showScanMaterials = true },
    onEditMaterial: { material in editingMaterial = material }
)
```

Add sheet presentations (initially pointing to placeholder views — will be implemented in later tasks):

```swift
.sheet(isPresented: $showAddMaterial, onDismiss: { loadPiece() }) {
    if let piece {
        AddMaterialView(piece: piece)
    }
}
.sheet(item: $editingMaterial, onDismiss: { loadPiece() }) { material in
    AddMaterialView(piece: piece!, editing: material)
}
```

Note: `showScanMaterials` sheet will be wired in Task 10.

**Step 4: Update delete cascade in ProjectDetailView and CanvasDetailView**

In both delete confirmation handlers, add after the journal entry cascade loop:

```swift
// Soft-delete child materials
for material in piece.materials where material.deletedAt == nil {
    material.deletedAt = now
    material.updatedAt = now
}
```

**Step 5: Build to verify compilation**

Run: `cd apps/ios && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -10`
Expected: BUILD SUCCEEDED (will have warnings about unresolved `AddMaterialView` — that's Task 8)

Note: If `AddMaterialView` doesn't exist yet, create a minimal placeholder:

```swift
// Placeholder until Task 8
struct AddMaterialView: View {
    let piece: StitchPiece
    var editing: PieceMaterial? = nil
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        Text("Add Material — Coming Soon")
    }
}
```

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift \
        apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift \
        apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift \
        apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): add MaterialsSection and MaterialRowView to ProjectDetailView"
```

---

## Task 8: iOS — AddMaterialView (Manual Entry Form)

**Files:**
- Create (or replace placeholder): `apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift`

**Step 1: Implement AddMaterialView**

Create `apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift`:

```swift
import SwiftUI
import SwiftData

struct AddMaterialView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    var editing: PieceMaterial? = nil

    @State private var materialType: MaterialType = .other
    @State private var brand = ""
    @State private var name = ""
    @State private var code = ""
    @State private var quantity = 1
    @State private var unit = ""
    @State private var notes = ""

    private var isEditing: Bool { editing != nil }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Type", selection: $materialType) {
                        ForEach(MaterialType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                    .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Type")
                }
                .listRowBackground(Color.parchment)

                Section {
                    TextField("Brand (e.g. Splendor, DMC)", text: $brand)
                        .font(.typeStyle(.body))
                    TextField("Name (e.g. Dark Green)", text: $name)
                        .font(.typeStyle(.body))
                    TextField("Code (e.g. S832, #424)", text: $code)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Details")
                }
                .listRowBackground(Color.parchment)

                Section {
                    Stepper("Quantity: \(quantity)", value: $quantity, in: 1...99)
                        .font(.typeStyle(.body))
                    TextField("Unit (e.g. Card, Spool, Tube)", text: $unit)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Quantity")
                }
                .listRowBackground(Color.parchment)

                Section {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Notes")
                }
                .listRowBackground(Color.parchment)
            }
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle(isEditing ? "Edit Material" : "Add Material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!canSave)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .onAppear {
                if let editing {
                    materialType = editing.materialType
                    brand = editing.brand ?? ""
                    name = editing.name
                    code = editing.code ?? ""
                    quantity = editing.quantity
                    unit = editing.unit ?? ""
                    notes = editing.notes ?? ""
                }
            }
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.playfair(15, weight: .semibold))
            .foregroundStyle(Color.walnut)
            .textCase(nil)
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        let trimmedBrand = brand.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUnit = unit.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)

        if let editing {
            editing.materialType = materialType
            editing.brand = trimmedBrand.isEmpty ? nil : trimmedBrand
            editing.name = trimmedName
            editing.code = trimmedCode.isEmpty ? nil : trimmedCode
            editing.quantity = quantity
            editing.unit = trimmedUnit.isEmpty ? nil : trimmedUnit
            editing.notes = trimmedNotes.isEmpty ? nil : trimmedNotes
            editing.updatedAt = Date()
        } else {
            let nextSortOrder = piece.materials
                .filter { $0.deletedAt == nil }
                .map(\.sortOrder)
                .max()
                .map { $0 + 1 } ?? 0

            let material = PieceMaterial(
                piece: piece,
                materialType: materialType,
                brand: trimmedBrand.isEmpty ? nil : trimmedBrand,
                name: trimmedName,
                code: trimmedCode.isEmpty ? nil : trimmedCode,
                quantity: quantity,
                unit: trimmedUnit.isEmpty ? nil : trimmedUnit,
                notes: trimmedNotes.isEmpty ? nil : trimmedNotes,
                sortOrder: nextSortOrder
            )
            modelContext.insert(material)
        }

        dismiss()
    }
}
```

**Step 2: Build to verify**

Run: `cd apps/ios && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift
git commit -m "feat(ios): add AddMaterialView for manual material entry and editing"
```

---

## Task 9: iOS — OCR Parsing Service

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift`

**Step 1: Write failing tests**

Create `apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("StitchGuideParser Tests")
struct StitchGuideParserTests {
    let parser = StitchGuideParser()

    // MARK: - Known Brand Patterns

    @Test("parses Splendor thread line")
    func parseSplendor() {
        let result = parser.parseLine("Splendor - Dark Green (S832) - 1 Card")
        #expect(result.brand == "Splendor")
        #expect(result.name == "Dark Green")
        #expect(result.code == "S832")
        #expect(result.quantity == 1)
        #expect(result.unit == "Card")
        #expect(result.materialType == .thread)
    }

    @Test("parses Flair thread line")
    func parseFlair() {
        let result = parser.parseLine("Flair - Antique Mauve (F511) - 1 Card")
        #expect(result.brand == "Flair")
        #expect(result.name == "Antique Mauve")
        #expect(result.code == "F511")
        #expect(result.materialType == .thread)
    }

    @Test("parses Neon Rays thread line")
    func parseNeonRays() {
        let result = parser.parseLine("Neon Rays - Emerald (N38) - 1 Card")
        #expect(result.brand == "Neon Rays")
        #expect(result.code == "N38")
        #expect(result.materialType == .thread)
    }

    @Test("parses DMC thread line")
    func parseDMC() {
        let result = parser.parseLine("DMC - Black (310) - 2 Skeins")
        #expect(result.brand == "DMC")
        #expect(result.name == "Black")
        #expect(result.code == "310")
        #expect(result.quantity == 2)
        #expect(result.unit == "Skeins")
        #expect(result.materialType == .thread)
    }

    @Test("parses Sundance Beads line")
    func parseSundanceBeads() {
        let result = parser.parseLine("Sundance Beads - Emerald (#424) - 1 Tube")
        #expect(result.brand == "Sundance Beads")
        #expect(result.code == "#424")
        #expect(result.materialType == .bead)
    }

    @Test("parses Silk Lamé Braid line")
    func parseSilkLame() {
        let result = parser.parseLine("Silk Lamé Braid - Gold (SL102) - 1 Spool")
        #expect(result.brand == "Silk Lamé Braid")
        #expect(result.code == "SL102")
        #expect(result.materialType == .thread)
    }

    // MARK: - Fallback Parsing

    @Test("parses unknown brand with dash delimiter")
    func parseUnknownBrand() {
        let result = parser.parseLine("Mystery Brand - Pretty Color (X99) - 3 Cards")
        #expect(result.brand == "Mystery Brand")
        #expect(result.name == "Pretty Color")
        #expect(result.code == "X99")
        #expect(result.quantity == 3)
        #expect(result.unit == "Cards")
    }

    @Test("parses line without quantity")
    func parseNoQuantity() {
        let result = parser.parseLine("DMC - Ecru (Ecru)")
        #expect(result.brand == "DMC")
        #expect(result.name == "Ecru")
        #expect(result.quantity == 1)
    }

    @Test("parses simple line without dashes")
    func parseSimpleLine() {
        let result = parser.parseLine("Beading Needle & Clear Thread")
        #expect(result.name == "Beading Needle & Clear Thread")
        #expect(result.brand == nil)
        #expect(result.materialType == .accessory)
    }

    // MARK: - Classification

    @Test("classifies needle as accessory")
    func classifyNeedle() {
        let result = parser.parseLine("Size 24 Tapestry Needle")
        #expect(result.materialType == .accessory)
    }

    @Test("classifies bead keyword")
    func classifyBeadKeyword() {
        let result = parser.parseLine("Mill Hill Glass Beads - Red (02013)")
        #expect(result.materialType == .bead)
    }

    // MARK: - Quantity Extraction

    @Test("extracts plural units")
    func pluralUnits() {
        let result = parser.parseLine("DMC - Red (321) - 3 Skeins")
        #expect(result.quantity == 3)
        #expect(result.unit == "Skeins")
    }

    @Test("extracts Strands unit")
    func strandsUnit() {
        let result = parser.parseLine("Kreinik - Gold (002) - 1 Spool")
        #expect(result.quantity == 1)
        #expect(result.unit == "Spool")
    }

    // MARK: - Batch Parsing

    @Test("parseLines filters headers and blank lines")
    func parseLinesFiltering() {
        let lines = [
            "Fibers:",
            "Splendor - Dark Green (S832) - 1 Card",
            "",
            "Flair - Antique Mauve (F511) - 1 Card",
            "Stitches:",
            "Continental",
        ]
        let results = parser.parseLines(lines)
        #expect(results.count == 2)
        #expect(results[0].brand == "Splendor")
        #expect(results[1].brand == "Flair")
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:stitchuationTests/StitchGuideParserTests 2>&1 | tail -20`
Expected: FAIL — `StitchGuideParser` doesn't exist.

**Step 3: Implement StitchGuideParser**

Create `apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift`:

```swift
import Foundation

struct ParsedMaterial {
    var materialType: MaterialType = .other
    var brand: String? = nil
    var name: String = ""
    var code: String? = nil
    var quantity: Int = 1
    var unit: String? = nil
}

final class StitchGuideParser {
    // Known brand → (code regex pattern, material type)
    private static let knownBrands: [(brand: String, codePattern: String, type: MaterialType)] = [
        ("Splendor", "S\\d+", .thread),
        ("Flair", "F\\d+", .thread),
        ("Neon Rays", "N\\d+", .thread),
        ("Silk Lamé Braid", "SL\\d+", .thread),
        ("Radiance", "J\\d+", .thread),
        ("Petite Very Velvet", "V\\d+", .thread),
        ("Sundance Beads", "#\\d+", .bead),
        ("DMC", "\\d{3,4}", .thread),
        ("Kreinik", "\\d+", .thread),
    ]

    private static let quantityPattern = try! NSRegularExpression(
        pattern: "(\\d+)\\s+(Cards?|Spools?|Tubes?|Strands?|Skeins?|Hanks?)",
        options: .caseInsensitive
    )

    private static let codeInParensPattern = try! NSRegularExpression(
        pattern: "\\(([^)]+)\\)",
        options: []
    )

    private static let hashCodePattern = try! NSRegularExpression(
        pattern: "#(\\d+)",
        options: []
    )

    private static let headerPatterns = ["fibers:", "stitches:", "threads:", "materials:", "supplies:"]
    private static let accessoryKeywords = ["needle", "stretcher", "frame", "scissors", "laying tool"]
    private static let beadKeywords = ["bead", "beads"]

    func parseLine(_ line: String) -> ParsedMaterial {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return ParsedMaterial() }

        var result = ParsedMaterial()

        // Try dash-delimited split first
        let segments = trimmed.components(separatedBy: " - ").map { $0.trimmingCharacters(in: .whitespaces) }

        if segments.count >= 2 {
            result.brand = segments[0]

            // Middle segment(s) = name + possible code
            let middleSegments = segments.count >= 3 ? Array(segments[1..<segments.count - 1]) : [segments[1]]
            let middle = middleSegments.joined(separator: " - ")

            // Extract code from parentheses
            let nsMiddle = middle as NSString
            if let match = Self.codeInParensPattern.firstMatch(in: middle, range: NSRange(location: 0, length: nsMiddle.length)) {
                let codeValue = nsMiddle.substring(with: match.range(at: 1))
                result.code = codeValue
                result.name = nsMiddle.replacingCharacters(in: match.range, with: "").trimmingCharacters(in: .whitespaces)
            } else {
                result.name = middle
            }

            // Last segment — check for quantity
            if segments.count >= 3 {
                let last = segments.last!
                extractQuantity(from: last, into: &result)
                // If no quantity found, treat it as part of the name
                if result.unit == nil && result.quantity == 1 {
                    result.name += " - " + last
                }
            }
        } else {
            // No dash delimiter — use entire line as name
            result.name = trimmed
        }

        // Extract hash code if not already found
        if result.code == nil {
            let nsLine = trimmed as NSString
            if let match = Self.hashCodePattern.firstMatch(in: trimmed, range: NSRange(location: 0, length: nsLine.length)) {
                result.code = "#" + nsLine.substring(with: match.range(at: 1))
            }
        }

        // Classify material type
        result.materialType = classify(result)

        return result
    }

    func parseLines(_ lines: [String]) -> [ParsedMaterial] {
        lines
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { line in
                !line.isEmpty &&
                !Self.headerPatterns.contains(where: { line.lowercased().hasPrefix($0) }) &&
                line.count > 3 // Filter very short garbage
            }
            .map { parseLine($0) }
            .filter { !$0.name.isEmpty }
    }

    private func extractQuantity(from text: String, into result: inout ParsedMaterial) {
        let nsText = text as NSString
        if let match = Self.quantityPattern.firstMatch(in: text, range: NSRange(location: 0, length: nsText.length)) {
            result.quantity = Int(nsText.substring(with: match.range(at: 1))) ?? 1
            result.unit = nsText.substring(with: match.range(at: 2))
        }
    }

    private func classify(_ material: ParsedMaterial) -> MaterialType {
        // Check known brands first
        if let brand = material.brand {
            for known in Self.knownBrands {
                if brand.localizedCaseInsensitiveContains(known.brand) {
                    return known.type
                }
            }
        }

        let lowerName = material.name.lowercased()
        let lowerBrand = (material.brand ?? "").lowercased()
        let combined = lowerBrand + " " + lowerName

        // Keyword classification
        if Self.beadKeywords.contains(where: { combined.contains($0) }) {
            return .bead
        }
        if Self.accessoryKeywords.contains(where: { combined.contains($0) }) {
            return .accessory
        }

        // If it has a brand, likely thread
        if material.brand != nil && !material.brand!.isEmpty {
            return .thread
        }

        return .other
    }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:stitchuationTests/StitchGuideParserTests 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift \
        apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift
git commit -m "feat(ios): add StitchGuideParser with brand-aware heuristic parsing"
```

---

## Task 10: iOS — ScanMaterialsView & ParsedMaterialsReviewView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift`
- Create: `apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift` (wire up scan sheet)

**Step 1: Create ScanMaterialsView**

Create `apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift`:

```swift
import SwiftUI
import PhotosUI
import Vision
#if canImport(UIKit)
import UIKit
#endif

struct ScanMaterialsView: View {
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    let onMaterialsParsed: ([ParsedMaterial]) -> Void

    @State private var selectedPhoto: PhotosPickerItem? = nil
    @State private var showCamera = false
    @State private var isProcessing = false
    @State private var errorMessage: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()

                VStack(spacing: Spacing.xl) {
                    if isProcessing {
                        VStack(spacing: Spacing.lg) {
                            ProgressView()
                                .tint(Color.terracotta)
                                .scaleEffect(1.5)
                            Text("Reading stitch guide...")
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.walnut)
                        }
                    } else {
                        EmptyStateView(
                            icon: "camera.viewfinder",
                            title: "Scan Stitch Guide",
                            message: "Take a photo or choose from your library to import the fibers list"
                        )

                        VStack(spacing: Spacing.md) {
                            if CameraView.isCameraAvailable {
                                Button {
                                    showCamera = true
                                } label: {
                                    Label("Take Photo", systemImage: "camera")
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, Spacing.md)
                                        .background(Color.terracotta)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                }
                            }

                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("Choose from Library", systemImage: "photo")
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(Color.terracotta)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, Spacing.md)
                                    .background(Color.cream)
                                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                                            .stroke(Color.terracotta, lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.horizontal, Spacing.xxxl)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.dustyRose)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, Spacing.lg)
                        }
                    }
                }
            }
            .navigationTitle("Scan Guide")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
            }
            .onChange(of: selectedPhoto) { _, newItem in
                guard let newItem else { return }
                Task {
                    await processPhotoItem(newItem)
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, _ in
                    showCamera = false
                    Task {
                        await processImage(image)
                    }
                }
                .ignoresSafeArea()
            }
        }
    }

    private func processPhotoItem(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            errorMessage = "Could not load image"
            return
        }
        await processImage(image)
    }

    private func processImage(_ image: UIImage) async {
        isProcessing = true
        errorMessage = nil

        guard let cgImage = image.cgImage else {
            isProcessing = false
            errorMessage = "Could not process image"
            return
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        do {
            try handler.perform([request])
            let observations = request.results ?? []

            // Sort by Y position (top to bottom) and extract text
            let sortedLines = observations
                .sorted { $0.boundingBox.origin.y > $1.boundingBox.origin.y }
                .compactMap { $0.topCandidates(1).first?.string }

            let parser = StitchGuideParser()
            let parsed = parser.parseLines(sortedLines)

            await MainActor.run {
                isProcessing = false
                if parsed.isEmpty {
                    errorMessage = "No materials found in image. Try a clearer photo of the fibers section."
                } else {
                    onMaterialsParsed(parsed)
                }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "OCR failed: \(error.localizedDescription)"
            }
        }
    }
}
```

**Step 2: Create ParsedMaterialsReviewView**

Create `apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift`:

```swift
import SwiftUI
import SwiftData

struct ParsedMaterialsReviewView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    @State var materials: [ParsedMaterial]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()

                if materials.isEmpty {
                    EmptyStateView(
                        icon: "list.clipboard",
                        title: "No materials",
                        message: "All items were removed"
                    )
                } else {
                    List {
                        ForEach(materials.indices, id: \.self) { index in
                            VStack(alignment: .leading, spacing: Spacing.xs) {
                                HStack {
                                    Text(materials[index].materialType.displayName)
                                        .font(.typeStyle(.footnote))
                                        .foregroundStyle(Color.clay)
                                        .padding(.horizontal, Spacing.sm)
                                        .padding(.vertical, Spacing.xxs)
                                        .background(Color.parchment)
                                        .clipShape(Capsule())

                                    Spacer()

                                    if materials[index].quantity > 0, let unit = materials[index].unit {
                                        Text("\(materials[index].quantity) \(unit)")
                                            .font(.typeStyle(.data))
                                            .foregroundStyle(Color.walnut)
                                    }
                                }

                                if let brand = materials[index].brand {
                                    Text(brand)
                                        .font(.typeStyle(.subheadline))
                                        .foregroundStyle(Color.walnut)
                                }

                                HStack {
                                    Text(materials[index].name)
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(Color.espresso)

                                    if let code = materials[index].code {
                                        Text("(\(code))")
                                            .font(.typeStyle(.subheadline))
                                            .foregroundStyle(Color.clay)
                                    }
                                }
                            }
                            .padding(.vertical, Spacing.xs)
                            .listRowBackground(Color.cream)
                        }
                        .onDelete { indexSet in
                            materials.remove(atOffsets: indexSet)
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("\(materials.count) Materials Found")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Discard") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save All") { saveAll() }
                        .disabled(materials.isEmpty)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func saveAll() {
        let existingMaxSort = piece.materials
            .filter { $0.deletedAt == nil }
            .map(\.sortOrder)
            .max() ?? -1

        for (index, parsed) in materials.enumerated() {
            let material = PieceMaterial(
                piece: piece,
                materialType: parsed.materialType,
                brand: parsed.brand,
                name: parsed.name,
                code: parsed.code,
                quantity: parsed.quantity,
                unit: parsed.unit,
                sortOrder: existingMaxSort + 1 + index
            )
            modelContext.insert(material)
        }

        dismiss()
    }
}
```

**Step 3: Wire up scan flow in ProjectDetailView**

In `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`:

Add state:
```swift
@State private var parsedMaterials: [ParsedMaterial]? = nil
```

Add sheet presentations:
```swift
.sheet(isPresented: $showScanMaterials) {
    if let piece {
        ScanMaterialsView(piece: piece) { parsed in
            showScanMaterials = false
            parsedMaterials = parsed
        }
    }
}
.sheet(item: Binding(
    get: { parsedMaterials.map { ParsedMaterialsWrapper(materials: $0) } },
    set: { parsedMaterials = $0?.materials }
), onDismiss: { loadPiece() }) { wrapper in
    if let piece {
        ParsedMaterialsReviewView(piece: piece, materials: wrapper.materials)
    }
}
```

Add a small wrapper struct (needed for `.sheet(item:)`) at the bottom of the file:
```swift
private struct ParsedMaterialsWrapper: Identifiable {
    let id = UUID()
    let materials: [ParsedMaterial]
}
```

**Step 4: Build to verify**

Run: `cd apps/ios && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift \
        apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift \
        apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): add OCR scanning flow with ScanMaterialsView and review step"
```

---

## Task 11: iOS — SyncEngine Support for PieceMaterial

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Add pieceMaterial change gathering**

In `SyncEngine.sync()`, after the journal image changes gathering block, add:

```swift
// Gather unsynced materials
let allMaterialDescriptor = FetchDescriptor<PieceMaterial>()
let allMaterials = try context.fetch(allMaterialDescriptor)
let unsyncedMaterials = allMaterials.filter { material in
    material.syncedAt == nil || material.updatedAt > (material.syncedAt ?? .distantPast)
}

let materialChanges: [SyncChange] = unsyncedMaterials.map { material in
    let isDeleted = material.deletedAt != nil
    var data: [String: AnyCodable]?
    if !isDeleted {
        data = [
            "pieceId": AnyCodable(material.piece.id.uuidString),
            "materialType": AnyCodable(material.materialType.rawValue),
            "brand": AnyCodable(material.brand ?? NSNull()),
            "name": AnyCodable(material.name),
            "code": AnyCodable(material.code ?? NSNull()),
            "quantity": AnyCodable(material.quantity),
            "unit": AnyCodable(material.unit ?? NSNull()),
            "notes": AnyCodable(material.notes ?? NSNull()),
            "acquired": AnyCodable(material.acquired),
            "sortOrder": AnyCodable(material.sortOrder),
        ]
    }
    return SyncChange(
        type: "pieceMaterial",
        action: isDeleted ? "delete" : "upsert",
        id: material.id.uuidString,
        data: data,
        updatedAt: formatter.string(from: material.updatedAt),
        deletedAt: material.deletedAt.map { formatter.string(from: $0) }
    )
}
```

Update the request line to include material changes:

```swift
let request = SyncRequest(lastSync: lastSyncTimestamp, changes: threadChanges + pieceChanges + entryChanges + imageChanges + materialChanges)
```

**Step 2: Add pieceMaterial server change reconciliation**

In the `for change in response.changes` loop, add after the `journalImage` block:

```swift
} else if change.type == "pieceMaterial" {
    let fetchDescriptor = FetchDescriptor<PieceMaterial>(
        predicate: #Predicate { $0.id == uuid }
    )
    let existing = try context.fetch(fetchDescriptor).first

    if change.action == "delete" {
        if let material = existing {
            guard serverUpdatedAt >= material.updatedAt else { continue }
            material.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
            material.updatedAt = serverUpdatedAt
            material.syncedAt = Date()
        }
    } else if change.action == "upsert" {
        if let material = existing {
            guard serverUpdatedAt >= material.updatedAt else { continue }
            applyMaterialData(change.data, to: material)
            material.updatedAt = serverUpdatedAt
            material.syncedAt = Date()
        } else {
            let pieceIdStr = stringValue(change.data, key: "pieceId")
            let pieceUUID = UUID(uuidString: pieceIdStr ?? "")
            var piece: StitchPiece?
            if let pieceUUID {
                let pieceFetch = FetchDescriptor<StitchPiece>(
                    predicate: #Predicate { $0.id == pieceUUID }
                )
                piece = try context.fetch(pieceFetch).first
            }
            guard let piece else { continue }
            let material = PieceMaterial(
                id: uuid,
                piece: piece,
                name: stringValue(change.data, key: "name") ?? ""
            )
            applyMaterialData(change.data, to: material)
            material.updatedAt = serverUpdatedAt
            material.syncedAt = Date()
            context.insert(material)
        }
    }
}
```

**Step 3: Mark pushed materials as synced**

After `for image in unsyncedImages { image.syncedAt = Date() }`, add:

```swift
for material in unsyncedMaterials {
    material.syncedAt = Date()
}
```

**Step 4: Add applyMaterialData helper**

Add after `applyJournalImageData`:

```swift
private func applyMaterialData(_ data: [String: AnyCodable]?, to material: PieceMaterial) {
    guard let data else { return }
    if let typeStr = data["materialType"]?.value as? String,
       let type = MaterialType(rawValue: typeStr) {
        material.materialType = type
    }
    if let v = data["brand"] {
        material.brand = v.value is NSNull ? nil : v.value as? String
    }
    if let name = data["name"]?.value as? String { material.name = name }
    if let v = data["code"] {
        material.code = v.value is NSNull ? nil : v.value as? String
    }
    if let quantity = data["quantity"]?.value as? Int { material.quantity = quantity }
    if let v = data["unit"] {
        material.unit = v.value is NSNull ? nil : v.value as? String
    }
    if let v = data["notes"] {
        material.notes = v.value is NSNull ? nil : v.value as? String
    }
    if let acquired = data["acquired"]?.value as? Bool { material.acquired = acquired }
    if let sortOrder = data["sortOrder"]?.value as? Int { material.sortOrder = sortOrder }
}
```

**Step 5: Build and run tests**

Run: `cd apps/ios && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -30`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): add pieceMaterial sync support to SyncEngine"
```

---

## Task 12: iOS — Swipe-to-Delete on Materials

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift`

**Step 1: Add swipe-to-delete to MaterialsSection**

Replace the `ForEach` block in `MaterialsSection` with a version that supports swipe:

```swift
ForEach(activeMaterials, id: \.id) { material in
    VStack(spacing: 0) {
        MaterialRowView(material: material)
            .onTapGesture { onEditMaterial(material) }

        if material.id != activeMaterials.last?.id {
            Divider()
                .background(Color.parchment)
        }
    }
    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
        Button(role: .destructive) {
            let now = Date()
            material.deletedAt = now
            material.updatedAt = now
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
}
```

Note: This requires wrapping the materials list in a `List` or using `.onDelete`. Since we're in a `VStack` inside a `ScrollView`, swipe actions won't work natively. Instead, wrap just the materials in a `List` with `.listStyle(.plain)` and `.scrollDisabled(true)`, or use the `onDelete` modifier approach. The implementer should evaluate which approach works best with the existing layout and adjust accordingly.

**Step 2: Build to verify**

Run: `cd apps/ios && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift
git commit -m "feat(ios): add swipe-to-delete on material rows"
```

---

## Task 13: Full Integration Test & Final Verification

**Step 1: Run all API tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass (should be ~220+).

**Step 2: Run all iOS tests**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | tail -30`
Expected: All tests pass (should be ~110+).

**Step 3: Verify no regressions**

Spot-check:
- Existing piece routes tests still pass
- Existing sync tests still pass
- Existing iOS model tests still pass

**Step 4: Final commit if any loose changes**

```bash
git status
# If any uncommitted changes remain:
git add -A && git commit -m "chore: final cleanup for kitting materials feature"
```
