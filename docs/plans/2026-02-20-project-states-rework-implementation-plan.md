# Project States Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Canvas and Project into a unified `StitchPiece` entity with a 6-state lifecycle (stash → kitting → wip → stitched → atFinishing → finished), keeping separate Stash and Projects views.

**Architecture:** Replace the `canvases` + `projects` tables with a single `stitch_pieces` table. Update `journal_entries` FK from `project_id` to `piece_id`. Drop and recreate the database (no users). On iOS, replace `StashCanvas` + `StitchProject` + `ProjectStatus` with `StitchPiece` + `PieceStatus`. Update all views, view models, sync engine, and upload queue.

**Tech Stack:** TypeScript (Hono, Drizzle ORM, Zod, Vitest), Swift (SwiftUI, SwiftData, Swift Testing)

**Build command (iOS):** `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

**Test command (iOS):** `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

**Test command (API):** `cd apps/api && npx vitest run 2>&1 | tail -30`

**Design doc:** `docs/plans/2026-02-20-project-states-rework-design.md`

**Note:** SourceKit may show false positive errors on new/modified files. Trust xcodebuild output.

---

## Task 1: API — New Schema + Drop Old Migrations

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Delete: all files under `apps/api/drizzle/` (4 SQL files + meta dir)

**Step 1: Rewrite schema.ts**

Replace the entire file with the unified schema. Key changes:
- Delete `canvases` table and `projectStatusEnum`
- Delete `projects` table
- Add `pieceStatusEnum` with 6 values
- Add `stitchPieces` table merging canvas + project fields
- Change `journalEntries.projectId` → `journalEntries.pieceId`
- Update indexes accordingly

Write `apps/api/src/db/schema.ts`:

```typescript
import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const fiberTypeEnum = pgEnum("fiber_type", [
  "wool", "cotton", "silk", "synthetic", "blend", "other"
]);

export const pieceStatusEnum = pgEnum("piece_status", [
  "stash", "kitting", "wip", "stitched", "at_finishing", "finished"
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

export const stitchPieces = pgTable("stitch_pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  designer: text("designer").notNull(),
  designName: text("design_name").notNull(),
  status: pieceStatusEnum("status").notNull().default("stash"),
  imageKey: text("image_key"),
  size: text("size"),
  meshCount: integer("mesh_count"),
  notes: text("notes"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  stitchedAt: timestamp("stitched_at", { withTimezone: true }),
  finishingAt: timestamp("finishing_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("stitch_pieces_user_id_idx").on(table.userId),
  index("stitch_pieces_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  index("stitch_pieces_user_id_status_idx").on(table.userId, table.status),
]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  pieceId: uuid("piece_id").notNull().references(() => stitchPieces.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_entries_piece_id_idx").on(table.pieceId),
  index("journal_entries_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const journalImages = pgTable("journal_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntries.id),
  imageKey: text("image_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_images_entry_id_idx").on(table.entryId),
  index("journal_images_entry_id_updated_at_idx").on(table.entryId, table.updatedAt),
]);
```

**Step 2: Delete old migrations**

```bash
rm -rf apps/api/drizzle/
```

**Step 3: Generate fresh migration**

```bash
cd apps/api && npm run db:generate
```

**Step 4: Drop and recreate database, run migration**

```bash
cd apps/api && docker compose down -v && docker compose up -d postgres && sleep 3 && npm run db:migrate
```

**Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git add -u apps/api/drizzle/  # stages deleted old migrations
git commit -m "feat(api): replace canvases+projects with unified stitch_pieces schema"
```

---

## Task 2: API — Piece Service + Tests

**Files:**
- Create: `apps/api/src/pieces/piece-service.ts`
- Create: `apps/api/src/pieces/schemas.ts`
- Create: `apps/api/tests/pieces/piece-service.test.ts`
- Delete: `apps/api/src/canvases/canvas-service.ts`
- Delete: `apps/api/src/canvases/schemas.ts`
- Delete: `apps/api/src/canvases/canvas-routes.ts`
- Delete: `apps/api/src/projects/project-service.ts`

**Step 1: Write schemas.ts**

Create `apps/api/src/pieces/schemas.ts`:

```typescript
import { z } from "zod";

export const pieceStatuses = ["stash", "kitting", "wip", "stitched", "at_finishing", "finished"] as const;
export type PieceStatus = typeof pieceStatuses[number];

export const createPieceSchema = z.object({
  id: z.string().uuid().optional(),
  designer: z.string().min(1).max(200),
  designName: z.string().min(1).max(200),
  status: z.enum(pieceStatuses).optional(),
  acquiredAt: z.string().datetime().optional(),
  size: z.string().max(100).optional(),
  meshCount: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePieceSchema = createPieceSchema
  .omit({ id: true })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const setStatusSchema = z.object({
  status: z.enum(pieceStatuses),
});

export const createJournalEntrySchema = z.object({
  id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateJournalEntrySchema = z.object({
  notes: z.string().min(1).max(5000),
});

export const uuidSchema = z.string().uuid();

export type CreatePieceInput = z.infer<typeof createPieceSchema>;
export type UpdatePieceInput = z.infer<typeof updatePieceSchema>;
```

**Step 2: Write the test file**

Create `apps/api/tests/pieces/piece-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PieceService } from "../../src/pieces/piece-service.js";
import { db } from "../../src/db/connection.js";
import { users, stitchPieces } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../src/auth/auth-service.js";

const pieceService = new PieceService();
let testUserId: string;
let otherUserId: string;

beforeAll(async () => {
  const hash = await hashPassword("testpass123");
  const [user] = await db
    .insert(users)
    .values({ email: `piece-svc-${Date.now()}@test.com`, displayName: "Test", passwordHash: hash })
    .returning();
  testUserId = user.id;

  const [other] = await db
    .insert(users)
    .values({ email: `piece-svc-other-${Date.now()}@test.com`, displayName: "Other", passwordHash: hash })
    .returning();
  otherUserId = other.id;
});

describe("PieceService", () => {
  describe("create", () => {
    it("creates a piece with default stash status", async () => {
      const piece = await pieceService.create(testUserId, {
        designer: "Test Designer",
        designName: "Test Design",
      });
      expect(piece.status).toBe("stash");
      expect(piece.designer).toBe("Test Designer");
      expect(piece.designName).toBe("Test Design");
      expect(piece.userId).toBe(testUserId);
    });

    it("creates a piece with client-provided UUID", async () => {
      const clientId = crypto.randomUUID();
      const piece = await pieceService.create(testUserId, {
        id: clientId,
        designer: "D",
        designName: "N",
      });
      expect(piece.id).toBe(clientId);
    });

    it("creates a piece with all optional fields", async () => {
      const piece = await pieceService.create(testUserId, {
        designer: "Designer",
        designName: "Name",
        acquiredAt: "2024-01-15T00:00:00.000Z",
        size: "13x18",
        meshCount: 18,
        notes: "A note",
      });
      expect(piece.size).toBe("13x18");
      expect(piece.meshCount).toBe(18);
      expect(piece.notes).toBe("A note");
    });
  });

  describe("getById", () => {
    it("returns a piece by id", async () => {
      const created = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      const found = await pieceService.getById(testUserId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("returns null for other user's piece", async () => {
      const created = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      const found = await pieceService.getById(otherUserId, created.id);
      expect(found).toBeNull();
    });

    it("returns null for soft-deleted piece", async () => {
      const created = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.softDelete(testUserId, created.id);
      const found = await pieceService.getById(testUserId, created.id);
      expect(found).toBeNull();
    });
  });

  describe("advanceStatus", () => {
    it("advances stash to kitting and sets startedAt", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      const advanced = await pieceService.advanceStatus(testUserId, piece.id);
      expect(advanced.status).toBe("kitting");
      expect(advanced.startedAt).toBeTruthy();
    });

    it("advances kitting to wip", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      const advanced = await pieceService.advanceStatus(testUserId, piece.id);
      expect(advanced.status).toBe("wip");
    });

    it("advances wip to stitched and sets stitchedAt", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      await pieceService.advanceStatus(testUserId, piece.id); // → wip
      const advanced = await pieceService.advanceStatus(testUserId, piece.id);
      expect(advanced.status).toBe("stitched");
      expect(advanced.stitchedAt).toBeTruthy();
    });

    it("advances stitched to at_finishing and sets finishingAt", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      await pieceService.advanceStatus(testUserId, piece.id); // → wip
      await pieceService.advanceStatus(testUserId, piece.id); // → stitched
      const advanced = await pieceService.advanceStatus(testUserId, piece.id);
      expect(advanced.status).toBe("at_finishing");
      expect(advanced.finishingAt).toBeTruthy();
    });

    it("advances at_finishing to finished and sets completedAt", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      await pieceService.advanceStatus(testUserId, piece.id); // → wip
      await pieceService.advanceStatus(testUserId, piece.id); // → stitched
      await pieceService.advanceStatus(testUserId, piece.id); // → at_finishing
      const advanced = await pieceService.advanceStatus(testUserId, piece.id);
      expect(advanced.status).toBe("finished");
      expect(advanced.completedAt).toBeTruthy();
    });

    it("throws when advancing finished", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      // Advance through all states
      for (let i = 0; i < 5; i++) {
        await pieceService.advanceStatus(testUserId, piece.id);
      }
      await expect(pieceService.advanceStatus(testUserId, piece.id)).rejects.toThrow("already finished");
    });
  });

  describe("setStatus", () => {
    it("sets an arbitrary status for corrections", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      await pieceService.advanceStatus(testUserId, piece.id); // → wip
      const updated = await pieceService.setStatus(testUserId, piece.id, "kitting");
      expect(updated.status).toBe("kitting");
    });
  });

  describe("shelve", () => {
    it("returns piece to stash and clears project timestamps", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await pieceService.advanceStatus(testUserId, piece.id); // → kitting
      await pieceService.advanceStatus(testUserId, piece.id); // → wip
      const shelved = await pieceService.shelve(testUserId, piece.id);
      expect(shelved.status).toBe("stash");
      expect(shelved.startedAt).toBeNull();
      expect(shelved.stitchedAt).toBeNull();
      expect(shelved.finishingAt).toBeNull();
      expect(shelved.completedAt).toBeNull();
    });

    it("throws when shelving a piece already in stash", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await expect(pieceService.shelve(testUserId, piece.id)).rejects.toThrow("already in stash");
    });
  });

  describe("softDelete", () => {
    it("soft-deletes a piece", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      const deleted = await pieceService.softDelete(testUserId, piece.id);
      expect(deleted.deletedAt).toBeTruthy();
    });

    it("throws NotFoundError for other user's piece", async () => {
      const piece = await pieceService.create(testUserId, { designer: "D", designName: "N" });
      await expect(pieceService.softDelete(otherUserId, piece.id)).rejects.toThrow("not found");
    });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/pieces/piece-service.test.ts 2>&1 | tail -20`

Expected: FAIL — module not found

**Step 4: Implement piece-service.ts**

Create `apps/api/src/pieces/piece-service.ts`:

```typescript
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { stitchPieces } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreatePieceInput, UpdatePieceInput, PieceStatus } from "./schemas.js";
import { pieceStatuses } from "./schemas.js";

export class PieceService {
  async create(userId: string, input: CreatePieceInput) {
    const [piece] = await db
      .insert(stitchPieces)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        designer: input.designer,
        designName: input.designName,
        status: input.status ?? "stash",
        acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : undefined,
        size: input.size,
        meshCount: input.meshCount,
        notes: input.notes,
      })
      .returning();

    return piece;
  }

  async getById(userId: string, id: string) {
    const [piece] = await db
      .select()
      .from(stitchPieces)
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .limit(1);

    return piece ?? null;
  }

  async listByUser(userId: string) {
    return db
      .select()
      .from(stitchPieces)
      .where(and(eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .orderBy(desc(stitchPieces.createdAt));
  }

  async update(userId: string, id: string, input: UpdatePieceInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.designer !== undefined) updateData.designer = input.designer;
    if (input.designName !== undefined) updateData.designName = input.designName;
    if (input.acquiredAt !== undefined) updateData.acquiredAt = new Date(input.acquiredAt);
    if (input.size !== undefined) updateData.size = input.size;
    if (input.meshCount !== undefined) updateData.meshCount = input.meshCount;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const [updated] = await db
      .update(stitchPieces)
      .set(updateData)
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Piece");
    return updated;
  }

  async setImageKey(userId: string, id: string, imageKey: string | null) {
    const [updated] = await db
      .update(stitchPieces)
      .set({ imageKey, updatedAt: new Date() })
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Piece");
    return updated;
  }

  async advanceStatus(userId: string, id: string) {
    const piece = await this.getById(userId, id);
    if (!piece) throw new NotFoundError("Piece");

    const now = new Date();
    const currentIndex = pieceStatuses.indexOf(piece.status as PieceStatus);

    if (currentIndex >= pieceStatuses.length - 1) {
      throw new Error("Piece is already finished");
    }

    const nextStatus = pieceStatuses[currentIndex + 1];
    const updateData: Record<string, unknown> = { status: nextStatus, updatedAt: now };

    // Set the appropriate timestamp for the new state
    if (nextStatus === "kitting") updateData.startedAt = piece.startedAt ?? now;
    if (nextStatus === "stitched") updateData.stitchedAt = now;
    if (nextStatus === "at_finishing") updateData.finishingAt = now;
    if (nextStatus === "finished") updateData.completedAt = now;

    const [updated] = await db
      .update(stitchPieces)
      .set(updateData)
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId)))
      .returning();

    return updated;
  }

  async setStatus(userId: string, id: string, status: PieceStatus) {
    const piece = await this.getById(userId, id);
    if (!piece) throw new NotFoundError("Piece");

    const [updated] = await db
      .update(stitchPieces)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId)))
      .returning();

    return updated;
  }

  async shelve(userId: string, id: string) {
    const piece = await this.getById(userId, id);
    if (!piece) throw new NotFoundError("Piece");

    if (piece.status === "stash") {
      throw new Error("Piece is already in stash");
    }

    const [updated] = await db
      .update(stitchPieces)
      .set({
        status: "stash",
        startedAt: null,
        stitchedAt: null,
        finishingAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId)))
      .returning();

    return updated;
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(stitchPieces)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!deleted) throw new NotFoundError("Piece");
    return deleted;
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/pieces/piece-service.test.ts 2>&1 | tail -20`

Expected: All tests PASS

**Step 6: Delete old service/schema files**

```bash
rm apps/api/src/canvases/canvas-service.ts apps/api/src/canvases/schemas.ts apps/api/src/canvases/canvas-routes.ts
rm apps/api/src/projects/project-service.ts apps/api/src/projects/schemas.ts
```

**Step 7: Commit**

```bash
git add apps/api/src/pieces/ apps/api/tests/pieces/
git add -u  # stages deletions
git commit -m "feat(api): add PieceService with status lifecycle, shelve, and tests"
```

---

## Task 3: API — Piece Routes + Tests

**Files:**
- Create: `apps/api/src/pieces/piece-routes.ts`
- Create: `apps/api/tests/pieces/piece-routes.test.ts`
- Modify: `apps/api/src/app.ts`
- Delete: `apps/api/src/projects/project-routes.ts`

**Step 1: Write the test file**

Create `apps/api/tests/pieces/piece-routes.test.ts` with tests for:
- `GET /pieces` — list pieces
- `GET /pieces/:id` — get single piece
- `POST /pieces` — create piece (defaults to stash)
- `PUT /pieces/:id` — update piece fields
- `PUT /pieces/:id/status` — advance status
- `PUT /pieces/:id/status/set` — set arbitrary status
- `PUT /pieces/:id/shelve` — return to stash
- `DELETE /pieces/:id` — soft delete
- `POST /pieces/:id/image` — upload image
- `DELETE /pieces/:id/image` — delete image
- Journal entry/image routes nested under pieces (same as old project routes but with `/pieces` prefix)
- Error cases: invalid UUID, not found, cross-user

Follow the exact patterns from the old `canvas-routes.test.ts` and `project-routes.test.ts` test files, adapted for the new `/pieces` routes.

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/pieces/piece-routes.test.ts 2>&1 | tail -20`

Expected: FAIL

**Step 3: Implement piece-routes.ts**

Create `apps/api/src/pieces/piece-routes.ts`. This file merges the old `canvas-routes.ts` and `project-routes.ts` into one router:
- All canvas CRUD routes → piece CRUD routes
- Image upload/delete → same logic, new storage key path `pieces/` instead of `canvases/`
- `PUT /:id/status` → calls `pieceService.advanceStatus()`
- `PUT /:id/status/set` → calls `pieceService.setStatus()` (for corrections)
- `PUT /:id/shelve` → calls `pieceService.shelve()`
- All journal entry and image routes from old project-routes.ts, with piece ownership check

Include `hasValidMagicBytes`, `MAX_IMAGE_SIZE`, `ALLOWED_IMAGE_TYPES` (shared between piece image and journal image uploads — or extract to a shared utility if the implementer prefers).

**Step 4: Update app.ts**

Replace `apps/api/src/app.ts`:

```typescript
import { Hono } from "hono";
import { authRoutes } from "./auth/auth-routes.js";
import { threadRoutes } from "./threads/thread-routes.js";
import { syncRoutes } from "./sync/sync-routes.js";
import { pieceRoutes } from "./pieces/piece-routes.js";
import { imageRoutes } from "./storage/image-routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);
app.route("/threads", threadRoutes);
app.route("/sync", syncRoutes);
app.route("/pieces", pieceRoutes);
app.route("/images", imageRoutes);

export default app;
```

**Step 5: Delete old route files**

```bash
rm apps/api/src/projects/project-routes.ts
```

**Step 6: Run piece route tests**

Run: `cd apps/api && npx vitest run tests/pieces/piece-routes.test.ts 2>&1 | tail -20`

Expected: All tests PASS

**Step 7: Commit**

```bash
git add apps/api/src/pieces/piece-routes.ts apps/api/src/app.ts apps/api/tests/pieces/piece-routes.test.ts
git add -u
git commit -m "feat(api): add piece routes merging canvas+project endpoints"
```

---

## Task 4: API — Journal Service Update + Tests

**Files:**
- Modify: `apps/api/src/projects/journal-service.ts` → move to `apps/api/src/pieces/journal-service.ts`
- Update: `apps/api/tests/projects/journal-service.test.ts` → move to `apps/api/tests/pieces/journal-service.test.ts`
- Update: `apps/api/tests/projects/journal-routes.test.ts` → move to `apps/api/tests/pieces/journal-routes.test.ts`

**Step 1: Move journal-service.ts to pieces directory**

Copy `apps/api/src/projects/journal-service.ts` to `apps/api/src/pieces/journal-service.ts` and update:
- Change `journalEntries.projectId` references to `journalEntries.pieceId`
- The `createEntry` method's second parameter changes from `projectId` to `pieceId`
- The `listEntries` method's filter changes from `projectId` to `pieceId`

**Step 2: Move and update journal tests**

Move journal test files from `tests/projects/` to `tests/pieces/`. Update:
- All `projectId` references to `pieceId`
- Test setup: create a `stitchPiece` instead of a `canvas` + `project`
- Route paths: `/projects/:id/entries` → `/pieces/:id/entries`

**Step 3: Run journal tests**

Run: `cd apps/api && npx vitest run tests/pieces/journal-service.test.ts tests/pieces/journal-routes.test.ts 2>&1 | tail -30`

Expected: All tests PASS

**Step 4: Delete old project directory**

```bash
rm -rf apps/api/src/projects/ apps/api/tests/projects/
```

**Step 5: Commit**

```bash
git add apps/api/src/pieces/journal-service.ts apps/api/tests/pieces/
git add -u
git commit -m "refactor(api): move journal service to pieces module, update pieceId FK"
```

---

## Task 5: API — Sync Service Update + Tests

**Files:**
- Modify: `apps/api/src/sync/sync-service.ts`
- Modify: `apps/api/src/sync/schemas.ts`
- Modify: `apps/api/tests/sync/sync-service.test.ts`
- Modify: `apps/api/tests/sync/sync-routes.test.ts`

**Step 1: Update sync schemas**

In `apps/api/src/sync/schemas.ts`, change the type enum:

```typescript
import { z } from "zod";

const syncChangeSchema = z.object({
  type: z.enum(["thread", "piece", "journalEntry", "journalImage"]),
  action: z.enum(["upsert", "delete"]),
  id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
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

Key change: `"canvas"` and `"project"` replaced with `"piece"`.

**Step 2: Update sync-service.ts**

Replace the `processCanvasChange` and `processProjectChange` methods with a single `processPieceChange` method. Update:

- Import `stitchPieces` instead of `canvases` and `projects`
- `ALLOWED_CANVAS_FIELDS` + `ALLOWED_PROJECT_FIELDS` → single `ALLOWED_PIECE_FIELDS`:
  ```typescript
  const ALLOWED_PIECE_FIELDS = new Set([
    "designer", "designName", "status", "imageKey", "size", "meshCount", "notes",
    "acquiredAt", "startedAt", "stitchedAt", "finishingAt", "completedAt",
  ]);
  ```
- `ALLOWED_JOURNAL_ENTRY_FIELDS`: change `"projectId"` to `"pieceId"`
- `getChangesSince`: query `stitchPieces` instead of `canvases` + `projects`, emit `type: "piece"` changes
- Journal entry changes: emit `pieceId` instead of `projectId` in data

**Step 3: Update sync tests**

In `apps/api/tests/sync/sync-service.test.ts`:
- Replace all canvas/project test setup with piece setup
- Change `type: "canvas"` and `type: "project"` to `type: "piece"`
- Change sync data fields to match new `ALLOWED_PIECE_FIELDS`
- Change `projectId` to `pieceId` in journal entry sync data

In `apps/api/tests/sync/sync-routes.test.ts`:
- Update type enum validation tests: `"canvas"` → `"piece"`, remove `"project"`

**Step 4: Run all sync tests**

Run: `cd apps/api && npx vitest run tests/sync/ 2>&1 | tail -20`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/sync/ apps/api/tests/sync/
git commit -m "feat(api): update sync service for unified stitch_pieces entity"
```

---

## Task 6: API — Delete Old Canvas/Project Tests + Full Test Run

**Files:**
- Delete: `apps/api/tests/canvases/` (entire directory)
- Delete: `apps/api/tests/projects/` (entire directory, if not already deleted in Task 4)

**Step 1: Delete old test files**

```bash
rm -rf apps/api/tests/canvases/ apps/api/tests/projects/
```

**Step 2: Run all API tests**

Run: `cd apps/api && npx vitest run 2>&1 | tail -30`

Expected: All tests PASS. If any old tests reference `canvases` or `projects`, fix the imports.

**Step 3: Commit**

```bash
git add -u
git commit -m "chore(api): remove old canvas and project tests"
```

---

## Task 7: iOS — PieceStatus + StitchPiece Models + Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/PieceStatus.swift`
- Create: `apps/ios/stitchuation/stitchuation/Models/StitchPiece.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/PieceStatusTests.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/StitchPieceTests.swift`
- Delete: `apps/ios/stitchuation/stitchuation/Models/ProjectStatus.swift`
- Delete: `apps/ios/stitchuation/stitchuation/Models/StashCanvas.swift`
- Delete: `apps/ios/stitchuation/stitchuation/Models/StitchProject.swift`

**Step 1: Write PieceStatus enum**

Create `apps/ios/stitchuation/stitchuation/Models/PieceStatus.swift`:

```swift
import Foundation

enum PieceStatus: String, Codable, CaseIterable {
    case stash
    case kitting
    case wip
    case stitched
    case atFinishing = "at_finishing"
    case finished

    var displayName: String {
        switch self {
        case .stash: return "Stash"
        case .kitting: return "Kitting"
        case .wip: return "WIP"
        case .stitched: return "Stitched"
        case .atFinishing: return "At Finishing"
        case .finished: return "Finished"
        }
    }

    /// Statuses that appear in the Projects Active tab
    static let activeStatuses: [PieceStatus] = [.kitting, .wip, .stitched, .atFinishing]

    /// Whether this is an active project status (not stash, not finished)
    var isActive: Bool { Self.activeStatuses.contains(self) }

    /// The next status in the lifecycle, or nil if finished
    var next: PieceStatus? {
        guard let index = Self.allCases.firstIndex(of: self),
              index + 1 < Self.allCases.count else { return nil }
        return Self.allCases[index + 1]
    }
}
```

**Step 2: Write StitchPiece model**

Create `apps/ios/stitchuation/stitchuation/Models/StitchPiece.swift`:

```swift
import Foundation
import SwiftData

@Model
final class StitchPiece {
    @Attribute(.unique) var id: UUID
    var designer: String
    var designName: String
    var status: PieceStatus
    var imageKey: String?
    var size: String?
    var meshCount: Int?
    var notes: String?
    var acquiredAt: Date?
    var startedAt: Date?
    var stitchedAt: Date?
    var finishingAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalEntry.piece)
    var entries: [JournalEntry] = []

    init(
        id: UUID = UUID(),
        designer: String,
        designName: String,
        status: PieceStatus = .stash,
        imageKey: String? = nil,
        size: String? = nil,
        meshCount: Int? = nil,
        notes: String? = nil,
        acquiredAt: Date? = nil,
        startedAt: Date? = nil
    ) {
        self.id = id
        self.designer = designer
        self.designName = designName
        self.status = status
        self.imageKey = imageKey
        self.size = size
        self.meshCount = meshCount
        self.notes = notes
        self.acquiredAt = acquiredAt
        self.startedAt = startedAt
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 3: Update JournalEntry model**

Modify `apps/ios/stitchuation/stitchuation/Models/JournalEntry.swift`:
- Change `var project: StitchProject` → `var piece: StitchPiece`
- Update init to take `piece: StitchPiece` instead of `project: StitchProject`

```swift
import Foundation
import SwiftData

@Model
final class JournalEntry {
    @Attribute(.unique) var id: UUID
    var piece: StitchPiece
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalImage.entry)
    var images: [JournalImage] = []

    init(
        id: UUID = UUID(),
        piece: StitchPiece,
        notes: String? = nil
    ) {
        self.id = id
        self.piece = piece
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 4: Write PieceStatusTests**

Create `apps/ios/stitchuation/stitchuationTests/PieceStatusTests.swift`:

```swift
import Testing
@testable import stitchuation

@Suite("PieceStatus Tests")
struct PieceStatusTests {
    @Test("has 6 cases")
    func caseCount() {
        #expect(PieceStatus.allCases.count == 6)
    }

    @Test("raw values match API values")
    func rawValues() {
        #expect(PieceStatus.stash.rawValue == "stash")
        #expect(PieceStatus.kitting.rawValue == "kitting")
        #expect(PieceStatus.wip.rawValue == "wip")
        #expect(PieceStatus.stitched.rawValue == "stitched")
        #expect(PieceStatus.atFinishing.rawValue == "at_finishing")
        #expect(PieceStatus.finished.rawValue == "finished")
    }

    @Test("display names are correct")
    func displayNames() {
        #expect(PieceStatus.stash.displayName == "Stash")
        #expect(PieceStatus.kitting.displayName == "Kitting")
        #expect(PieceStatus.wip.displayName == "WIP")
        #expect(PieceStatus.stitched.displayName == "Stitched")
        #expect(PieceStatus.atFinishing.displayName == "At Finishing")
        #expect(PieceStatus.finished.displayName == "Finished")
    }

    @Test("next status follows lifecycle")
    func nextStatus() {
        #expect(PieceStatus.stash.next == .kitting)
        #expect(PieceStatus.kitting.next == .wip)
        #expect(PieceStatus.wip.next == .stitched)
        #expect(PieceStatus.stitched.next == .atFinishing)
        #expect(PieceStatus.atFinishing.next == .finished)
        #expect(PieceStatus.finished.next == nil)
    }

    @Test("active statuses are kitting through atFinishing")
    func activeStatuses() {
        #expect(PieceStatus.stash.isActive == false)
        #expect(PieceStatus.kitting.isActive == true)
        #expect(PieceStatus.wip.isActive == true)
        #expect(PieceStatus.stitched.isActive == true)
        #expect(PieceStatus.atFinishing.isActive == true)
        #expect(PieceStatus.finished.isActive == false)
    }
}
```

**Step 5: Write StitchPieceTests**

Create `apps/ios/stitchuation/stitchuationTests/StitchPieceTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("StitchPiece Tests")
struct StitchPieceTests {
    @Test("initializes with required fields and stash status")
    func initWithRequired() {
        let piece = StitchPiece(designer: "Melissa Shirley", designName: "Garden")
        #expect(piece.designer == "Melissa Shirley")
        #expect(piece.designName == "Garden")
        #expect(piece.status == .stash)
        #expect(piece.imageKey == nil)
        #expect(piece.startedAt == nil)
        #expect(piece.entries.isEmpty)
    }

    @Test("initializes with all fields")
    func initWithAll() {
        let id = UUID()
        let now = Date()
        let piece = StitchPiece(
            id: id,
            designer: "D",
            designName: "N",
            status: .wip,
            imageKey: "img.jpg",
            size: "13x18",
            meshCount: 18,
            notes: "Note",
            acquiredAt: now,
            startedAt: now
        )
        #expect(piece.id == id)
        #expect(piece.status == .wip)
        #expect(piece.meshCount == 18)
        #expect(piece.startedAt != nil)
    }

    @Test("timestamps are set on creation")
    func timestamps() {
        let piece = StitchPiece(designer: "D", designName: "N")
        #expect(piece.createdAt <= Date())
        #expect(piece.updatedAt <= Date())
        #expect(piece.deletedAt == nil)
        #expect(piece.syncedAt == nil)
    }
}
```

**Step 6: Delete old model files and their tests**

```bash
rm apps/ios/stitchuation/stitchuation/Models/ProjectStatus.swift
rm apps/ios/stitchuation/stitchuation/Models/StashCanvas.swift
rm apps/ios/stitchuation/stitchuation/Models/StitchProject.swift
rm apps/ios/stitchuation/stitchuationTests/ProjectStatusTests.swift
rm apps/ios/stitchuation/stitchuationTests/CanvasTests.swift
rm apps/ios/stitchuation/stitchuationTests/StitchProjectTests.swift
```

**Step 7: Build to check for compile errors** (will fail — views still reference old types)

This step is expected to fail. The model layer is correct, but views haven't been updated yet. Just verify the new model files compile by checking the error output references old type names in views, not in the new model files.

**Step 8: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/PieceStatus.swift apps/ios/stitchuation/stitchuation/Models/StitchPiece.swift apps/ios/stitchuation/stitchuation/Models/JournalEntry.swift
git add apps/ios/stitchuation/stitchuationTests/PieceStatusTests.swift apps/ios/stitchuation/stitchuationTests/StitchPieceTests.swift
git add -u
git commit -m "feat(ios): add StitchPiece and PieceStatus models, replace StashCanvas+StitchProject"
```

---

## Task 8: iOS — PieceStatusBadge + ViewModel Updates

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift` → rename to `PieceStatusBadge.swift`
- Modify: `apps/ios/stitchuation/stitchuation/ViewModels/StashListViewModel.swift`
- Modify: `apps/ios/stitchuation/stitchuation/ViewModels/ProjectListViewModel.swift`

**Step 1: Create PieceStatusBadge (replace ProjectStatusBadge)**

Delete `ProjectStatusBadge.swift`, create `PieceStatusBadge.swift`:

```swift
import SwiftUI

struct PieceStatusBadge: View {
    let status: PieceStatus

    @State private var badgeScale: CGFloat = 1.0

    private var backgroundColor: Color {
        switch status {
        case .stash: return Color.walnut
        case .kitting: return Color.dustyRose
        case .wip: return Color.terracotta
        case .stitched: return Color.sage
        case .atFinishing: return Color.dustyRose
        case .finished: return Color.sage
        }
    }

    var body: some View {
        Text(status.displayName)
            .font(.typeStyle(.footnote))
            .fontWeight(.medium)
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xxs)
            .background(backgroundColor)
            .clipShape(Capsule())
            .scaleEffect(badgeScale)
            .onChange(of: status) { _, _ in
                withAnimation(Motion.bouncy) {
                    badgeScale = 1.15
                }
                withAnimation(Motion.bouncy.delay(0.15)) {
                    badgeScale = 1.0
                }
            }
    }
}
```

**Step 2: Update StashListViewModel**

Replace `StashCanvas` references with `StitchPiece`:

```swift
import Foundation

@MainActor
@Observable
final class StashListViewModel {
    var searchText = ""
    var showAllPieces = false

    func filteredPieces(from pieces: [StitchPiece]) -> [StitchPiece] {
        let filtered = showAllPieces ? pieces : pieces.filter { $0.status == .stash }
        guard !searchText.isEmpty else { return filtered }
        let search = searchText.lowercased()
        return filtered.filter { piece in
            piece.designer.lowercased().contains(search)
                || piece.designName.lowercased().contains(search)
        }
    }

    func deletePieces(from pieces: [StitchPiece], at offsets: IndexSet) {
        let now = Date()
        for index in offsets {
            let piece = pieces[index]
            piece.deletedAt = now
            piece.updatedAt = now
        }
    }
}
```

**Step 3: Update ProjectListViewModel**

Replace `StitchProject` references with `StitchPiece`:

```swift
import Foundation

@MainActor
@Observable
final class ProjectListViewModel {
    var searchText = ""
    var showFinished = false

    func filteredPieces(from pieces: [StitchPiece]) -> [StitchPiece] {
        let statusFiltered: [StitchPiece]
        if showFinished {
            statusFiltered = pieces.filter { $0.status == .finished }
        } else {
            statusFiltered = pieces.filter { $0.status.isActive }
        }
        guard !searchText.isEmpty else { return statusFiltered }
        let query = searchText.lowercased()
        return statusFiltered.filter { piece in
            piece.designName.lowercased().contains(query) ||
            piece.designer.lowercased().contains(query)
        }
    }

    func piecesByStatus(from pieces: [StitchPiece]) -> [(PieceStatus, [StitchPiece])] {
        let grouped = Dictionary(grouping: pieces) { $0.status }
        let order: [PieceStatus] = showFinished ? [.finished] : PieceStatus.activeStatuses
        return order.compactMap { status in
            guard let items = grouped[status], !items.isEmpty else { return nil }
            return (status, items)
        }
    }
}
```

**Step 4: Update ViewModel tests**

Update `StashListViewModelTests.swift` and `ProjectListViewModelTests.swift` to use `StitchPiece` instead of `StashCanvas`/`StitchProject`.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/PieceStatusBadge.swift
git add apps/ios/stitchuation/stitchuation/ViewModels/
git add apps/ios/stitchuation/stitchuationTests/StashListViewModelTests.swift apps/ios/stitchuation/stitchuationTests/ProjectListViewModelTests.swift
git add -u
git commit -m "feat(ios): add PieceStatusBadge, update view models for StitchPiece"
```

---

## Task 9: iOS — Update StashListView + CanvasDetailView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`

**Step 1: Rewrite StashListView**

Key changes:
- Query `StitchPiece` instead of `StashCanvas`
- Add "Show All" toggle in toolbar
- `CanvasRowView` uses `StitchPiece`, shows `PieceStatusBadge` when status != `.stash`
- When `showAllPieces` is false (default), show only stash items
- When `showAllPieces` is true, show everything with status badges

**Step 2: Rewrite CanvasDetailView**

Key changes:
- Load `StitchPiece` instead of `StashCanvas`
- Remove the `ProjectNavID` workaround and the project link section
- Add "Start Project" button when status is `.stash` — sets status to `.kitting` and `startedAt = Date()`
- Show status badge when status is not `.stash`
- `EditCanvasView` sheet takes `StitchPiece` (updated in next task)
- Delete cleanup references `StitchPiece` for PendingUpload queries

**Step 3: Build to check progress**

Build will likely still fail due to other views not yet updated. Verify the errors are only in files not yet touched.

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/StashListView.swift apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): update StashListView and CanvasDetailView for StitchPiece"
```

---

## Task 10: iOS — Update ProjectListView + ProjectDetailView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`
- Delete: `apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift`

**Step 1: Rewrite ProjectListView**

Key changes:
- Query `StitchPiece` instead of `StitchProject`
- Add `Picker` (segmented control) at top: "Active" / "Finished"
- Toggle `viewModel.showFinished` based on segment
- `ProjectRowView` uses `StitchPiece` directly (no `.canvas` accessor needed)
- "+" button opens a picker sheet showing stash pieces (replaces `StartProjectView`)
- Picker sheet: list stash items, tapping one sets status to `.kitting` and `startedAt = Date()`

**Step 2: Rewrite ProjectDetailView**

Key changes:
- Load `StitchPiece` instead of `StitchProject`
- Image: `piece.imageKey` instead of `project.canvas.imageKey`
- Status section: use `PieceStatusBadge`, advance button uses `PieceStatus.next`:
  - kitting → "Start Stitching"
  - wip → "Mark Stitched"
  - stitched → "Send to Finishing"
  - atFinishing → "Mark Finished"
  - finished → no button
- Make status badge tappable → sheet with all 6 `PieceStatus` cases for correction
- Add "Return to Stash" in `···` menu:
  - Sets status to `.stash`
  - Clears `startedAt`, `stitchedAt`, `finishingAt`, `completedAt`
  - Journal entries preserved
- Info section: show `stitchedAt` date row
- `AddJournalEntryView` takes `StitchPiece` instead of `StitchProject`
- Delete action: soft-delete piece and children

**Step 3: Delete StartProjectView**

```bash
rm apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift
```

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git add -u
git commit -m "feat(ios): update ProjectListView and ProjectDetailView for StitchPiece lifecycle"
```

---

## Task 11: iOS — Update Form Views (Add/Edit Canvas, AddJournalEntry)

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift`

**Step 1: Update AddCanvasView**

Key changes:
- Create `StitchPiece` instead of `StashCanvas`
- Upload path: `"/pieces/\(piece.id.uuidString)/image"` instead of `"/canvases/..."`
- Server creation: POST to `/pieces` instead of `/canvases`
- All field mappings stay the same (designer, designName, acquiredAt, size, meshCount, notes)

**Step 2: Update EditCanvasView**

Key changes:
- `@Bindable var canvas: StitchPiece` instead of `StashCanvas` (or rename parameter to `piece`)

**Step 3: Update AddJournalEntryView**

Key changes:
- `let piece: StitchPiece` instead of `let project: StitchProject`
- Upload path: `"/pieces/\(piece.id.uuidString)/entries/\(entry.id.uuidString)/images"` instead of `"/projects/..."`
- Entry creation: `JournalEntry(piece: piece, ...)` instead of `JournalEntry(project: project, ...)`
- Server calls: POST to `/pieces/:id/entries` instead of `/projects/:id/entries`

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): update form views for StitchPiece"
```

---

## Task 12: iOS — Update SyncEngine + UploadQueue + App Entry

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift`

**Step 1: Update SyncEngine**

Key changes:
- Remove canvas and project gathering sections
- Add single piece gathering section:
  - Fetch all `StitchPiece`, filter unsynced
  - Emit `type: "piece"` changes with fields: designer, designName, status, imageKey, size, meshCount, notes, acquiredAt, startedAt, stitchedAt, finishingAt, completedAt
- Remove `applyCanvasData` and `applyProjectData` methods
- Add `applyPieceData` method handling all fields
- Server change processing: replace `"canvas"` and `"project"` handlers with single `"piece"` handler
- Journal entry changes: `"pieceId"` instead of `"projectId"`
- Mark synced: single `unsyncedPieces` loop instead of separate canvas/project loops
- Change request: `threadChanges + pieceChanges + entryChanges + imageChanges`

**Step 2: Update UploadQueue**

In `updateEntity` method:
- Change `"canvas"` entity type to `"piece"` (or keep both during transition)
- Fetch `StitchPiece` instead of `StashCanvas` for piece image uploads

**Step 3: Update PendingUpload**

Change `entityType` documentation/comments from `"canvas"` to `"piece"`. The string values are just identifiers, so just update what the code checks for.

**Step 4: Update stitchuationApp.swift**

Change `ModelContainer` initialization:
```swift
modelContainer = try ModelContainer(for: NeedleThread.self, StitchPiece.self, JournalEntry.self, JournalImage.self, PendingUpload.self)
```

Remove `StashCanvas.self` and `StitchProject.self`.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift apps/ios/stitchuation/stitchuation/stitchuationApp.swift apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift
git commit -m "feat(ios): update SyncEngine and UploadQueue for StitchPiece"
```

---

## Task 13: iOS — Update Remaining Tests

**Files:**
- Modify: `apps/ios/stitchuation/stitchuationTests/JournalEntryTests.swift`
- Modify: `apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift`
- Modify: `apps/ios/stitchuation/stitchuationTests/UploadQueueTests.swift`
- Modify: `apps/ios/stitchuation/stitchuationTests/StashListViewModelTests.swift`
- Modify: `apps/ios/stitchuation/stitchuationTests/ProjectListViewModelTests.swift`

**Step 1: Update JournalEntryTests**

Change `StitchProject`/`StashCanvas` references to `StitchPiece`:
```swift
let piece = StitchPiece(designer: "D", designName: "N")
let entry = JournalEntry(piece: piece, notes: "Test")
```

**Step 2: Update PendingUploadTests**

Change `"canvas"` entity type to `"piece"` where applicable.

**Step 3: Update StashListViewModelTests**

Replace `StashCanvas` construction with `StitchPiece`. Test the new `showAllPieces` toggle.

**Step 4: Update ProjectListViewModelTests**

Replace `StitchProject`/`StashCanvas` construction with `StitchPiece`. Test `showFinished` toggle and `piecesByStatus` grouping with new statuses.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuationTests/
git commit -m "test(ios): update all tests for StitchPiece model"
```

---

## Task 14: iOS + API — Full Build & Test Verification

**Step 1: Build iOS**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 2: Run iOS tests**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: All tests pass (2 pre-existing KeychainHelperTests failures in simulator are expected)

**Step 3: Run API tests**

Run: `cd apps/api && npx vitest run 2>&1 | tail -30`

Expected: All tests pass

**Step 4: Fix any issues found**

---

## Summary

| Task | Description | Scope |
|------|-------------|-------|
| 1 | New schema + drop old migrations | API |
| 2 | PieceService + tests | API |
| 3 | Piece routes + tests | API |
| 4 | Journal service move + update | API |
| 5 | Sync service update + tests | API |
| 6 | Delete old test files + full API test run | API |
| 7 | PieceStatus + StitchPiece models + tests | iOS |
| 8 | PieceStatusBadge + ViewModel updates | iOS |
| 9 | StashListView + CanvasDetailView | iOS |
| 10 | ProjectListView + ProjectDetailView | iOS |
| 11 | Form views (Add/Edit/Journal) | iOS |
| 12 | SyncEngine + UploadQueue + App entry | iOS |
| 13 | Update remaining tests | iOS |
| 14 | Full build & test verification | Both |
