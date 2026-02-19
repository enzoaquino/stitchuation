# Project Journal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project journal tracking to canvases — status flow (WIP → At Finishing → Completed), timestamped journal entries with notes and multiple images, a Projects tab, and status badges in Stitch Stash.

**Architecture:** Separate `projects`, `journal_entries`, and `journal_images` tables linked to existing `canvases`. API follows existing Hono/Drizzle/Zod patterns. iOS uses SwiftData models with SwiftUI views and SyncEngine integration. Images reuse the existing `StorageProvider` and `/images/*` endpoint.

**Tech Stack:** TypeScript (Hono, Drizzle ORM, Zod, Vitest), Swift (SwiftUI, SwiftData, Swift Testing)

**Design Doc:** `docs/plans/2026-02-18-project-journal-design.md`

---

## Task 1: API — Database Schema & Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Context:** The existing schema has `users`, `threads`, `canvases` tables and a `fiberTypeEnum`. We add a new `projectStatusEnum` and three new tables. Follow the exact patterns from `canvases` (timestamps with timezone, soft deletes, indexes).

**Step 1: Add project_status enum and projects table to schema.ts**

Add after the `canvases` table definition:

```typescript
export const projectStatusEnum = pgEnum("project_status", [
  "wip", "at_finishing", "completed"
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  canvasId: uuid("canvas_id").notNull().references(() => canvases.id).unique(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: projectStatusEnum("status").notNull().default("wip"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishingAt: timestamp("finishing_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
  index("projects_canvas_id_idx").on(table.canvasId),
  index("projects_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_entries_project_id_idx").on(table.projectId),
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

**Step 2: Generate the migration**

Run: `cd apps/api && npx drizzle-kit generate`
Expected: New SQL migration file in `drizzle/` directory

**Step 3: Run the migration**

Run: `cd apps/api && npx drizzle-kit migrate`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add projects, journal_entries, journal_images schema"
```

---

## Task 2: API — Project Zod Schemas

**Files:**
- Create: `apps/api/src/projects/schemas.ts`

**Context:** Follow the pattern from `apps/api/src/canvases/schemas.ts`. Separate create/update schemas. Use `z.string().uuid()` for IDs.

**Step 1: Create the schemas file**

```typescript
import { z } from "zod/v4";

export const createProjectSchema = z.object({
  id: z.string().uuid().optional(),
  canvasId: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createJournalEntrySchema = z.object({
  id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const updateJournalEntrySchema = z.object({
  notes: z.string().min(1).max(5000),
});

export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

export const uuidSchema = z.string().uuid();
```

**Step 2: Commit**

```bash
git add apps/api/src/projects/schemas.ts
git commit -m "feat(api): add project and journal entry Zod schemas"
```

---

## Task 3: API — Project Service (Tests First)

**Files:**
- Create: `apps/api/tests/projects/project-service.test.ts`
- Create: `apps/api/src/projects/project-service.ts`

**Context:** Follow `apps/api/src/canvases/canvas-service.ts` and `apps/api/tests/canvases/canvas-service.test.ts` patterns exactly. The service needs a canvas to exist first (create via CanvasService in test setup). Projects are 1:1 with canvases.

**Step 1: Write failing tests for project service**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { ProjectService } from "../../src/projects/project-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

const projectService = new ProjectService();
const canvasService = new CanvasService();
const authService = new AuthService();

describe("ProjectService", () => {
  let userId: string;
  let otherUserId: string;
  let canvasId: string;

  beforeAll(async () => {
    const user = await authService.register({
      email: `project-svc-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Test User",
    });
    userId = user.user.id;

    const otherUser = await authService.register({
      email: `project-svc-other-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Other User",
    });
    otherUserId = otherUser.user.id;

    const canvas = await canvasService.create(userId, {
      designer: "Test Designer",
      designName: "Test Design",
    });
    canvasId = canvas.id;
  });

  describe("create", () => {
    it("should create a project linked to a canvas", async () => {
      const project = await projectService.create(userId, { canvasId });
      expect(project.canvasId).toBe(canvasId);
      expect(project.userId).toBe(userId);
      expect(project.status).toBe("wip");
      expect(project.startedAt).toBeDefined();
      expect(project.finishingAt).toBeNull();
      expect(project.completedAt).toBeNull();
      expect(project.deletedAt).toBeNull();
    });

    it("should reject duplicate canvas linkage", async () => {
      const canvas2 = await canvasService.create(userId, {
        designer: "D", designName: "Dup Test",
      });
      await projectService.create(userId, { canvasId: canvas2.id });
      await expect(
        projectService.create(userId, { canvasId: canvas2.id })
      ).rejects.toThrow();
    });

    it("should accept client-provided UUID", async () => {
      const canvas3 = await canvasService.create(userId, {
        designer: "D", designName: "UUID Test",
      });
      const id = crypto.randomUUID();
      const project = await projectService.create(userId, { id, canvasId: canvas3.id });
      expect(project.id).toBe(id);
    });
  });

  describe("getById", () => {
    it("should return project by id", async () => {
      const canvas4 = await canvasService.create(userId, {
        designer: "D", designName: "Get Test",
      });
      const created = await projectService.create(userId, { canvasId: canvas4.id });
      const found = await projectService.getById(userId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("should return null for other user's project", async () => {
      const canvas5 = await canvasService.create(userId, {
        designer: "D", designName: "Isolation Test",
      });
      const created = await projectService.create(userId, { canvasId: canvas5.id });
      const found = await projectService.getById(otherUserId, created.id);
      expect(found).toBeNull();
    });

    it("should return null for deleted project", async () => {
      const canvas6 = await canvasService.create(userId, {
        designer: "D", designName: "Del Test",
      });
      const created = await projectService.create(userId, { canvasId: canvas6.id });
      await projectService.softDelete(userId, created.id);
      const found = await projectService.getById(userId, created.id);
      expect(found).toBeNull();
    });
  });

  describe("listByUser", () => {
    it("should list only the user's non-deleted projects", async () => {
      const projects = await projectService.listByUser(userId);
      expect(projects.length).toBeGreaterThan(0);
      for (const p of projects) {
        expect(p.userId).toBe(userId);
        expect(p.deletedAt).toBeNull();
      }
    });
  });

  describe("advanceStatus", () => {
    it("should advance from wip to at_finishing", async () => {
      const canvas7 = await canvasService.create(userId, {
        designer: "D", designName: "Advance Test",
      });
      const project = await projectService.create(userId, { canvasId: canvas7.id });
      const advanced = await projectService.advanceStatus(userId, project.id);
      expect(advanced.status).toBe("at_finishing");
      expect(advanced.finishingAt).toBeDefined();
    });

    it("should advance from at_finishing to completed", async () => {
      const canvas8 = await canvasService.create(userId, {
        designer: "D", designName: "Complete Test",
      });
      const project = await projectService.create(userId, { canvasId: canvas8.id });
      await projectService.advanceStatus(userId, project.id);
      const completed = await projectService.advanceStatus(userId, project.id);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeDefined();
    });

    it("should reject advancing past completed", async () => {
      const canvas9 = await canvasService.create(userId, {
        designer: "D", designName: "Past Complete",
      });
      const project = await projectService.create(userId, { canvasId: canvas9.id });
      await projectService.advanceStatus(userId, project.id);
      await projectService.advanceStatus(userId, project.id);
      await expect(
        projectService.advanceStatus(userId, project.id)
      ).rejects.toThrow("already completed");
    });
  });

  describe("softDelete", () => {
    it("should soft delete a project", async () => {
      const canvas10 = await canvasService.create(userId, {
        designer: "D", designName: "Soft Del",
      });
      const project = await projectService.create(userId, { canvasId: canvas10.id });
      const deleted = await projectService.softDelete(userId, project.id);
      expect(deleted.deletedAt).toBeDefined();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/projects/project-service.test.ts`
Expected: FAIL — module `../../src/projects/project-service.js` not found

**Step 3: Implement the project service**

```typescript
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/connection.js";
import { projects } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateProjectInput } from "./schemas.js";

const STATUS_ORDER = ["wip", "at_finishing", "completed"] as const;

export class ProjectService {
  async create(userId: string, input: CreateProjectInput) {
    const [project] = await db.insert(projects).values({
      ...(input.id ? { id: input.id } : {}),
      canvasId: input.canvasId,
      userId,
      status: "wip",
      startedAt: new Date(),
    }).returning();
    return project;
  }

  async getById(userId: string, id: string) {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .limit(1);
    return project ?? null;
  }

  async listByUser(userId: string) {
    return db.select().from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(projects.createdAt);
  }

  async advanceStatus(userId: string, id: string) {
    const project = await this.getById(userId, id);
    if (!project) throw new NotFoundError("Project");

    const currentIndex = STATUS_ORDER.indexOf(project.status as typeof STATUS_ORDER[number]);
    if (currentIndex >= STATUS_ORDER.length - 1) {
      throw new Error("Project is already completed");
    }

    const nextStatus = STATUS_ORDER[currentIndex + 1];
    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: now,
    };

    if (nextStatus === "at_finishing") updateData.finishingAt = now;
    if (nextStatus === "completed") updateData.completedAt = now;

    const [updated] = await db.update(projects).set(updateData)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return updated;
  }

  async softDelete(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db.update(projects)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(projects.id, id), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .returning();
    if (!deleted) throw new NotFoundError("Project");
    return deleted;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/projects/project-service.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/projects/project-service.ts apps/api/tests/projects/project-service.test.ts
git commit -m "feat(api): add project service with CRUD and status advancement"
```

---

## Task 4: API — Journal Service (Tests First)

**Files:**
- Create: `apps/api/tests/projects/journal-service.test.ts`
- Create: `apps/api/src/projects/journal-service.ts`

**Context:** The journal service handles entries and images for a project. Entries have a `projectId` and optional `notes`. Images have an `entryId`, `imageKey`, and `sortOrder`. Follow the same service patterns.

**Step 1: Write failing tests for journal service**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { JournalService } from "../../src/projects/journal-service.js";
import { ProjectService } from "../../src/projects/project-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

const journalService = new JournalService();
const projectService = new ProjectService();
const canvasService = new CanvasService();
const authService = new AuthService();

describe("JournalService", () => {
  let userId: string;
  let otherUserId: string;
  let projectId: string;

  beforeAll(async () => {
    const user = await authService.register({
      email: `journal-svc-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Test User",
    });
    userId = user.user.id;

    const otherUser = await authService.register({
      email: `journal-svc-other-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Other User",
    });
    otherUserId = otherUser.user.id;

    const canvas = await canvasService.create(userId, {
      designer: "Test Designer",
      designName: "Journal Test Design",
    });
    const project = await projectService.create(userId, { canvasId: canvas.id });
    projectId = project.id;
  });

  describe("createEntry", () => {
    it("should create a journal entry with notes", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Started the background today!",
      });
      expect(entry.projectId).toBe(projectId);
      expect(entry.userId).toBe(userId);
      expect(entry.notes).toBe("Started the background today!");
      expect(entry.deletedAt).toBeNull();
    });

    it("should create an entry without notes", async () => {
      const entry = await journalService.createEntry(userId, projectId, {});
      expect(entry.notes).toBeNull();
    });

    it("should accept client-provided UUID", async () => {
      const id = crypto.randomUUID();
      const entry = await journalService.createEntry(userId, projectId, { id, notes: "UUID test" });
      expect(entry.id).toBe(id);
    });
  });

  describe("listEntries", () => {
    it("should list entries for a project ordered by createdAt desc", async () => {
      const entries = await journalService.listEntries(userId, projectId);
      expect(entries.length).toBeGreaterThan(0);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1].createdAt >= entries[i].createdAt).toBe(true);
      }
    });

    it("should not list other user's entries", async () => {
      const entries = await journalService.listEntries(otherUserId, projectId);
      expect(entries.length).toBe(0);
    });
  });

  describe("getEntry", () => {
    it("should return entry by id", async () => {
      const created = await journalService.createEntry(userId, projectId, { notes: "Get test" });
      const found = await journalService.getEntry(userId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });
  });

  describe("updateEntry", () => {
    it("should update entry notes", async () => {
      const created = await journalService.createEntry(userId, projectId, { notes: "Original" });
      const updated = await journalService.updateEntry(userId, created.id, { notes: "Updated notes" });
      expect(updated.notes).toBe("Updated notes");
    });
  });

  describe("softDeleteEntry", () => {
    it("should soft delete an entry", async () => {
      const created = await journalService.createEntry(userId, projectId, { notes: "Delete me" });
      const deleted = await journalService.softDeleteEntry(userId, created.id);
      expect(deleted.deletedAt).toBeDefined();
      const found = await journalService.getEntry(userId, created.id);
      expect(found).toBeNull();
    });
  });

  describe("addImage", () => {
    it("should add an image to an entry", async () => {
      const entry = await journalService.createEntry(userId, projectId, { notes: "With image" });
      const image = await journalService.addImage(entry.id, "journals/test/img1.jpg", 0);
      expect(image.entryId).toBe(entry.id);
      expect(image.imageKey).toBe("journals/test/img1.jpg");
      expect(image.sortOrder).toBe(0);
    });
  });

  describe("listImages", () => {
    it("should list images for an entry ordered by sortOrder", async () => {
      const entry = await journalService.createEntry(userId, projectId, { notes: "Multi image" });
      await journalService.addImage(entry.id, "journals/test/b.jpg", 1);
      await journalService.addImage(entry.id, "journals/test/a.jpg", 0);
      const images = await journalService.listImages(entry.id);
      expect(images.length).toBe(2);
      expect(images[0].sortOrder).toBe(0);
      expect(images[1].sortOrder).toBe(1);
    });
  });

  describe("deleteImage", () => {
    it("should soft delete an image", async () => {
      const entry = await journalService.createEntry(userId, projectId, { notes: "Del img" });
      const image = await journalService.addImage(entry.id, "journals/test/del.jpg", 0);
      const deleted = await journalService.softDeleteImage(image.id);
      expect(deleted.deletedAt).toBeDefined();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/projects/journal-service.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the journal service**

```typescript
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { journalEntries, journalImages } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "./schemas.js";

export class JournalService {
  async createEntry(userId: string, projectId: string, input: CreateJournalEntryInput) {
    const [entry] = await db.insert(journalEntries).values({
      ...(input.id ? { id: input.id } : {}),
      projectId,
      userId,
      notes: input.notes ?? null,
    }).returning();
    return entry;
  }

  async listEntries(userId: string, projectId: string) {
    return db.select().from(journalEntries)
      .where(and(
        eq(journalEntries.projectId, projectId),
        eq(journalEntries.userId, userId),
        isNull(journalEntries.deletedAt),
      ))
      .orderBy(desc(journalEntries.createdAt));
  }

  async getEntry(userId: string, id: string) {
    const [entry] = await db.select().from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)))
      .limit(1);
    return entry ?? null;
  }

  async updateEntry(userId: string, id: string, input: UpdateJournalEntryInput) {
    const [updated] = await db.update(journalEntries)
      .set({ notes: input.notes, updatedAt: new Date() })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)))
      .returning();
    if (!updated) throw new NotFoundError("Journal entry");
    return updated;
  }

  async softDeleteEntry(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db.update(journalEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId), isNull(journalEntries.deletedAt)))
      .returning();
    if (!deleted) throw new NotFoundError("Journal entry");
    return deleted;
  }

  async addImage(entryId: string, imageKey: string, sortOrder: number) {
    const [image] = await db.insert(journalImages).values({
      entryId,
      imageKey,
      sortOrder,
    }).returning();
    return image;
  }

  async listImages(entryId: string) {
    return db.select().from(journalImages)
      .where(and(eq(journalImages.entryId, entryId), isNull(journalImages.deletedAt)))
      .orderBy(journalImages.sortOrder);
  }

  async softDeleteImage(id: string) {
    const now = new Date();
    const [deleted] = await db.update(journalImages)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(journalImages.id, id), isNull(journalImages.deletedAt)))
      .returning();
    if (!deleted) throw new NotFoundError("Journal image");
    return deleted;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/projects/journal-service.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/api/src/projects/journal-service.ts apps/api/tests/projects/journal-service.test.ts
git commit -m "feat(api): add journal service for entries and images"
```

---

## Task 5: API — Project Routes (Tests First)

**Files:**
- Create: `apps/api/tests/projects/project-routes.test.ts`
- Create: `apps/api/src/projects/project-routes.ts`
- Modify: `apps/api/src/app.ts` (mount routes)

**Context:** Follow `apps/api/src/canvases/canvas-routes.ts` exactly. Use `authMiddleware`, `uuidSchema.safeParse()` for param validation, `safeParse()` with error flattening for bodies. Test with `app.request()`. Mount at `/projects` in `app.ts`.

**Step 1: Write failing route tests**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";

const authService = new AuthService();
const canvasService = new CanvasService();

describe("Project Routes", () => {
  let token: string;
  let userId: string;
  let canvasId: string;

  beforeAll(async () => {
    const result = await authService.register({
      email: `project-routes-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Test User",
    });
    token = result.accessToken;
    userId = result.user.id;

    const canvas = await canvasService.create(userId, {
      designer: "Routes Designer",
      designName: "Routes Design",
    });
    canvasId = canvas.id;
  });

  describe("POST /projects", () => {
    it("should create a project", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ canvasId }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.canvasId).toBe(canvasId);
      expect(body.status).toBe("wip");
    });

    it("should reject missing canvasId", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const res = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasId }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /projects", () => {
    it("should list projects", async () => {
      const res = await app.request("/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("GET /projects/:id", () => {
    it("should get a project by id", async () => {
      const canvas2 = await canvasService.create(userId, {
        designer: "D", designName: "Get Route Test",
      });
      const createRes = await app.request("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ canvasId: canvas2.id }),
      });
      const created = await createRes.json();

      const res = await app.request(`/projects/${created.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(created.id);
    });

    it("should return 404 for non-existent project", async () => {
      const res = await app.request(`/projects/${crypto.randomUUID()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid UUID", async () => {
      const res = await app.request("/projects/not-a-uuid", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /projects/:id/status", () => {
    it("should advance status from wip to at_finishing", async () => {
      const canvas3 = await canvasService.create(userId, {
        designer: "D", designName: "Status Route Test",
      });
      const createRes = await app.request("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ canvasId: canvas3.id }),
      });
      const created = await createRes.json();

      const res = await app.request(`/projects/${created.id}/status`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("at_finishing");
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should soft delete a project", async () => {
      const canvas4 = await canvasService.create(userId, {
        designer: "D", designName: "Delete Route Test",
      });
      const createRes = await app.request("/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ canvasId: canvas4.id }),
      });
      const created = await createRes.json();

      const res = await app.request(`/projects/${created.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/projects/project-routes.test.ts`
Expected: FAIL

**Step 3: Implement project routes**

```typescript
import { Hono } from "hono";
import type { AuthEnv } from "../auth/types.js";
import { authMiddleware } from "../auth/middleware.js";
import { ProjectService } from "./project-service.js";
import { createProjectSchema, uuidSchema } from "./schemas.js";
import { NotFoundError } from "../errors.js";

const projectRoutes = new Hono<AuthEnv>();
const projectService = new ProjectService();

projectRoutes.use("/*", authMiddleware);

projectRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const projects = await projectService.listByUser(userId);
  return c.json(projects);
});

projectRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  try {
    const project = await projectService.create(userId, parsed.data);
    return c.json(project, 201);
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "A project already exists for this canvas" }, 400);
    }
    throw error;
  }
});

projectRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }
  const project = await projectService.getById(userId, idResult.data);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }
  return c.json(project);
});

projectRoutes.put("/:id/status", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }
  try {
    const project = await projectService.advanceStatus(userId, idResult.data);
    return c.json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof Error && error.message.includes("already completed")) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

projectRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }
  try {
    await projectService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { projectRoutes };
```

**Step 4: Mount routes in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { projectRoutes } from "./projects/project-routes.js";
// ... existing imports

app.route("/projects", projectRoutes);
```

**Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/projects/project-routes.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add apps/api/src/projects/project-routes.ts apps/api/src/app.ts apps/api/tests/projects/project-routes.test.ts
git commit -m "feat(api): add project CRUD routes with status advancement"
```

---

## Task 6: API — Journal Entry & Image Routes (Tests First)

**Files:**
- Create: `apps/api/tests/projects/journal-routes.test.ts`
- Modify: `apps/api/src/projects/project-routes.ts` (add journal sub-routes)

**Context:** Journal routes are nested under `/projects/:id/entries`. Image upload reuses the exact pattern from canvas image upload in `apps/api/src/canvases/canvas-routes.ts` (multipart, magic bytes, size limit). Storage key pattern: `journals/{userId}/{entryId}/{imageId}.jpg`.

**Step 1: Write failing tests for journal routes**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";

const authService = new AuthService();
const canvasService = new CanvasService();

describe("Journal Routes", () => {
  let token: string;
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const result = await authService.register({
      email: `journal-routes-${Date.now()}@test.com`,
      password: "password123",
      displayName: "Test User",
    });
    token = result.accessToken;
    userId = result.user.id;

    const canvas = await canvasService.create(userId, {
      designer: "Journal Routes Designer",
      designName: "Journal Routes Design",
    });

    const projectRes = await app.request("/projects", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ canvasId: canvas.id }),
    });
    const project = await projectRes.json();
    projectId = project.id;
  });

  describe("POST /projects/:id/entries", () => {
    it("should create a journal entry", async () => {
      const res = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "First entry!" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.notes).toBe("First entry!");
      expect(body.projectId).toBe(projectId);
    });

    it("should create an entry without notes", async () => {
      const res = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
    });

    it("should reject for non-existent project", async () => {
      const res = await app.request(`/projects/${crypto.randomUUID()}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Ghost project" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /projects/:id/entries", () => {
    it("should list entries for a project", async () => {
      const res = await app.request(`/projects/${projectId}/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /projects/:id/entries/:entryId", () => {
    it("should update entry notes", async () => {
      const createRes = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Original" }),
      });
      const entry = await createRes.json();

      const res = await app.request(`/projects/${projectId}/entries/${entry.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Updated" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes).toBe("Updated");
    });
  });

  describe("DELETE /projects/:id/entries/:entryId", () => {
    it("should soft delete an entry", async () => {
      const createRes = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Delete me" }),
      });
      const entry = await createRes.json();

      const res = await app.request(`/projects/${projectId}/entries/${entry.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("POST /projects/:id/entries/:entryId/images", () => {
    it("should upload an image to an entry", async () => {
      const createRes = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Image entry" }),
      });
      const entry = await createRes.json();

      // Create a minimal valid JPEG (FF D8 FF)
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpegData = new Uint8Array(100);
      jpegData.set(jpegHeader);
      const blob = new Blob([jpegData], { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("image", blob, "test.jpg");

      const res = await app.request(
        `/projects/${projectId}/entries/${entry.id}/images`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.imageKey).toBeDefined();
      expect(body.sortOrder).toBe(0);
    });

    it("should reject non-image files", async () => {
      const createRes = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Bad image" }),
      });
      const entry = await createRes.json();

      const blob = new Blob(["not an image"], { type: "text/plain" });
      const formData = new FormData();
      formData.append("image", blob, "test.txt");

      const res = await app.request(
        `/projects/${projectId}/entries/${entry.id}/images`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /projects/:id/entries/:entryId/images/:imageId", () => {
    it("should soft delete an image", async () => {
      const createRes = await app.request(`/projects/${projectId}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: "Del img entry" }),
      });
      const entry = await createRes.json();

      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const jpegData = new Uint8Array(100);
      jpegData.set(jpegHeader);
      const blob = new Blob([jpegData], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("image", blob, "test.jpg");

      const uploadRes = await app.request(
        `/projects/${projectId}/entries/${entry.id}/images`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      const image = await uploadRes.json();

      const res = await app.request(
        `/projects/${projectId}/entries/${entry.id}/images/${image.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/projects/journal-routes.test.ts`
Expected: FAIL

**Step 3: Add journal routes to project-routes.ts**

Add journal entry sub-routes to the existing `project-routes.ts` file. Add these route handlers after the existing project routes but before the export:

```typescript
// At the top, add imports:
import { JournalService } from "./journal-service.js";
import { createJournalEntrySchema, updateJournalEntrySchema } from "./schemas.js";
import { getStorage } from "../storage/index.js";

const journalService = new JournalService();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);

function hasValidMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  if (buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") return true;
  }
  return false;
}

// Journal entry routes
projectRoutes.get("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid project ID" }, 400);

  const project = await projectService.getById(userId, idResult.data);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const entries = await journalService.listEntries(userId, idResult.data);
  return c.json(entries);
});

projectRoutes.post("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid project ID" }, 400);

  const project = await projectService.getById(userId, idResult.data);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = createJournalEntrySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const entry = await journalService.createEntry(userId, idResult.data, parsed.data);
  return c.json(entry, 201);
});

projectRoutes.put("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) return c.json({ error: "Invalid project ID" }, 400);
  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) return c.json({ error: "Invalid entry ID" }, 400);

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = updateJournalEntrySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    const entry = await journalService.updateEntry(userId, entryIdResult.data, parsed.data);
    return c.json(entry);
  } catch (error) {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    throw error;
  }
});

projectRoutes.delete("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) return c.json({ error: "Invalid entry ID" }, 400);

  try {
    await journalService.softDeleteEntry(userId, entryIdResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    throw error;
  }
});

projectRoutes.post("/:id/entries/:entryId/images", async (c) => {
  const userId = c.get("userId");
  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) return c.json({ error: "Invalid entry ID" }, 400);

  const entry = await journalService.getEntry(userId, entryIdResult.data);
  if (!entry) return c.json({ error: "Journal entry not found" }, 404);

  const formData = await c.req.formData();
  const file = formData.get("image");
  if (!file || !(file instanceof File)) return c.json({ error: "No image file provided" }, 400);
  if (file.size > MAX_IMAGE_SIZE) return c.json({ error: "Image must be under 10MB" }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return c.json({ error: "Image must be JPEG, PNG, or HEIC" }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidMagicBytes(buffer)) return c.json({ error: "File content does not match an allowed image format" }, 400);

  // Count existing images to determine sortOrder
  const existingImages = await journalService.listImages(entryIdResult.data);
  const sortOrder = existingImages.length;

  const imageId = crypto.randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `journals/${userId}/${entryIdResult.data}/${imageId}.${ext}`;

  const storage = getStorage();
  await storage.upload(buffer, key);
  const image = await journalService.addImage(entryIdResult.data, key, sortOrder);
  return c.json(image, 201);
});

projectRoutes.delete("/:id/entries/:entryId/images/:imageId", async (c) => {
  const imageIdResult = uuidSchema.safeParse(c.req.param("imageId"));
  if (!imageIdResult.success) return c.json({ error: "Invalid image ID" }, 400);

  try {
    await journalService.softDeleteImage(imageIdResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) return c.json({ error: error.message }, 404);
    throw error;
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/projects/journal-routes.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All existing + new tests PASS

**Step 6: Commit**

```bash
git add apps/api/src/projects/project-routes.ts apps/api/tests/projects/journal-routes.test.ts
git commit -m "feat(api): add journal entry and image routes"
```

---

## Task 7: API — Sync Integration

**Files:**
- Modify: `apps/api/src/sync/sync-service.ts`
- Modify: `apps/api/src/sync/sync-routes.ts` (update schema if type enum is there)
- Modify: `apps/api/tests/sync/sync-service.test.ts`

**Context:** Add three new entity types to sync: `"project"`, `"journalEntry"`, `"journalImage"`. Follow the exact existing patterns for `"thread"` and `"canvas"` in `sync-service.ts`. Add allowed-field sets, process methods, and getChangesSince queries.

**Step 1: Write failing sync tests for new entity types**

Add new test cases to the existing sync test file:

```typescript
// Add these test cases inside the existing describe block

describe("project sync", () => {
  it("should push a project change", async () => {
    // Create a canvas first, then create a project via sync
    const canvas = await canvasService.create(userId, {
      designer: "Sync Designer", designName: "Sync Design",
    });

    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "project",
        action: "upsert",
        id: crypto.randomUUID(),
        data: { canvasId: canvas.id, status: "wip" },
        updatedAt: new Date().toISOString(),
      }],
    });

    const projectChanges = result.changes.filter((c: any) => c.type === "project");
    expect(projectChanges.length).toBeGreaterThan(0);
  });

  it("should pull project changes", async () => {
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [],
    });
    const projectChanges = result.changes.filter((c: any) => c.type === "project");
    expect(projectChanges.length).toBeGreaterThan(0);
  });
});

describe("journalEntry sync", () => {
  it("should push a journal entry change", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "JE Sync", designName: "JE Design",
    });
    const project = await projectService.create(userId, { canvasId: canvas.id });

    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "journalEntry",
        action: "upsert",
        id: crypto.randomUUID(),
        data: { projectId: project.id, notes: "Synced entry" },
        updatedAt: new Date().toISOString(),
      }],
    });

    const entryChanges = result.changes.filter((c: any) => c.type === "journalEntry");
    expect(entryChanges.length).toBeGreaterThan(0);
  });
});

describe("journalImage sync", () => {
  it("should push a journal image change", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "JI Sync", designName: "JI Design",
    });
    const project = await projectService.create(userId, { canvasId: canvas.id });
    const entry = await journalService.createEntry(userId, project.id, { notes: "Img sync" });

    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [{
        type: "journalImage",
        action: "upsert",
        id: crypto.randomUUID(),
        data: { entryId: entry.id, imageKey: "test/img.jpg", sortOrder: 0 },
        updatedAt: new Date().toISOString(),
      }],
    });

    const imageChanges = result.changes.filter((c: any) => c.type === "journalImage");
    expect(imageChanges.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run sync tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/sync/sync-service.test.ts`
Expected: FAIL — new entity types not handled

**Step 3: Add sync support for new entity types**

In `sync-service.ts`, add:

1. Allowed-field sets:
```typescript
const ALLOWED_PROJECT_FIELDS = new Set([
  "canvasId", "status", "startedAt", "finishingAt", "completedAt",
]);

const ALLOWED_JOURNAL_ENTRY_FIELDS = new Set([
  "projectId", "notes",
]);

const ALLOWED_JOURNAL_IMAGE_FIELDS = new Set([
  "entryId", "imageKey", "sortOrder",
]);
```

2. Add `processProjectChange`, `processJournalEntryChange`, `processJournalImageChange` methods following the exact same pattern as `processThreadChange` and `processCanvasChange`.

3. Update the `sync()` method's change processing loop:
```typescript
} else if (change.type === "project") {
  await this.processProjectChange(tx, userId, change);
} else if (change.type === "journalEntry") {
  await this.processJournalEntryChange(tx, userId, change);
} else if (change.type === "journalImage") {
  await this.processJournalImageChange(tx, userId, change);
}
```

4. Update `getChangesSince()` to query `projects`, `journalEntries`, and `journalImages` tables and include them in the returned changes array.

5. Update the sync request schema type enum:
```typescript
type: z.enum(["thread", "canvas", "project", "journalEntry", "journalImage"]),
```

**Step 4: Run sync tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/sync/sync-service.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add apps/api/src/sync/sync-service.ts apps/api/src/sync/sync-routes.ts apps/api/tests/sync/sync-service.test.ts
git commit -m "feat(api): add project, journalEntry, journalImage to sync"
```

---

## Task 8: iOS — SwiftData Models

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/ProjectStatus.swift`
- Create: `apps/ios/stitchuation/stitchuation/Models/StitchProject.swift`
- Create: `apps/ios/stitchuation/stitchuation/Models/JournalEntry.swift`
- Create: `apps/ios/stitchuation/stitchuation/Models/JournalImage.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Models/StashCanvas.swift` (add inverse relationship)
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift` (add to ModelContainer)

**Context:** Follow the exact `StashCanvas` model pattern. Use `@Attribute(.unique)` for UUID, include `syncedAt` for sync tracking. The `StitchProject` name avoids Swift's `Project` collision. Use `@Relationship` for parent-child links.

**Step 1: Create ProjectStatus enum**

```swift
// ProjectStatus.swift
enum ProjectStatus: String, Codable, CaseIterable {
    case wip
    case atFinishing = "at_finishing"
    case completed

    var displayName: String {
        switch self {
        case .wip: return "WIP"
        case .atFinishing: return "At Finishing"
        case .completed: return "Completed"
        }
    }
}
```

**Step 2: Create StitchProject model**

```swift
// StitchProject.swift
import Foundation
import SwiftData

@Model
final class StitchProject {
    @Attribute(.unique) var id: UUID
    var canvas: StashCanvas
    var status: ProjectStatus
    var startedAt: Date?
    var finishingAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalEntry.project)
    var entries: [JournalEntry] = []

    init(
        id: UUID = UUID(),
        canvas: StashCanvas,
        status: ProjectStatus = .wip,
        startedAt: Date? = Date(),
        finishingAt: Date? = nil,
        completedAt: Date? = nil
    ) {
        self.id = id
        self.canvas = canvas
        self.status = status
        self.startedAt = startedAt
        self.finishingAt = finishingAt
        self.completedAt = completedAt
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 3: Create JournalEntry model**

```swift
// JournalEntry.swift
import Foundation
import SwiftData

@Model
final class JournalEntry {
    @Attribute(.unique) var id: UUID
    var project: StitchProject
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalImage.entry)
    var images: [JournalImage] = []

    init(
        id: UUID = UUID(),
        project: StitchProject,
        notes: String? = nil
    ) {
        self.id = id
        self.project = project
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 4: Create JournalImage model**

```swift
// JournalImage.swift
import Foundation
import SwiftData

@Model
final class JournalImage {
    @Attribute(.unique) var id: UUID
    var entry: JournalEntry
    var imageKey: String
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        entry: JournalEntry,
        imageKey: String,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.entry = entry
        self.imageKey = imageKey
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 5: Add inverse relationship to StashCanvas**

Add to `StashCanvas.swift`:

```swift
@Relationship(inverse: \StitchProject.canvas)
var project: StitchProject?
```

Note: The default on `project` should be `nil` (no initializer change needed since it's optional).

**Step 6: Update ModelContainer in stitchuationApp.swift**

Change the ModelContainer initialization:

```swift
modelContainer = try ModelContainer(for: NeedleThread.self, StashCanvas.self, StitchProject.self, JournalEntry.self, JournalImage.self)
```

**Step 7: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/
git add apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): add StitchProject, JournalEntry, JournalImage SwiftData models"
```

---

## Task 9: iOS — Model Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuationTests/StitchProjectTests.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/JournalEntryTests.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/ProjectStatusTests.swift`

**Context:** Follow the existing test patterns in `stitchuationTests/CanvasTests.swift`. Use Swift Testing framework: `import Testing`, `@Test`, `#expect()`. Test model creation, defaults, and relationships.

**Step 1: Write ProjectStatus tests**

```swift
// ProjectStatusTests.swift
import Testing
@testable import stitchuation

struct ProjectStatusTests {
    @Test func allCasesExist() {
        #expect(ProjectStatus.allCases.count == 3)
    }

    @Test func rawValues() {
        #expect(ProjectStatus.wip.rawValue == "wip")
        #expect(ProjectStatus.atFinishing.rawValue == "at_finishing")
        #expect(ProjectStatus.completed.rawValue == "completed")
    }

    @Test func displayNames() {
        #expect(ProjectStatus.wip.displayName == "WIP")
        #expect(ProjectStatus.atFinishing.displayName == "At Finishing")
        #expect(ProjectStatus.completed.displayName == "Completed")
    }
}
```

**Step 2: Write StitchProject tests**

```swift
// StitchProjectTests.swift
import Testing
import SwiftData
@testable import stitchuation

struct StitchProjectTests {
    @Test func initSetsRequiredFields() {
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let project = StitchProject(canvas: canvas)
        #expect(project.canvas === canvas)
        #expect(project.status == .wip)
        #expect(project.startedAt != nil)
        #expect(project.finishingAt == nil)
        #expect(project.completedAt == nil)
        #expect(project.deletedAt == nil)
        #expect(project.syncedAt == nil)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let project = StitchProject(canvas: canvas)
        let after = Date()
        #expect(project.createdAt >= before)
        #expect(project.createdAt <= after)
        #expect(project.updatedAt >= before)
        #expect(project.updatedAt <= after)
    }

    @Test func initWithCustomId() {
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let customId = UUID()
        let project = StitchProject(id: customId, canvas: canvas)
        #expect(project.id == customId)
    }

    @Test func initWithAllFields() {
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let now = Date()
        let project = StitchProject(
            canvas: canvas,
            status: .atFinishing,
            startedAt: now,
            finishingAt: now,
            completedAt: nil
        )
        #expect(project.status == .atFinishing)
        #expect(project.finishingAt == now)
    }
}
```

**Step 3: Write JournalEntry tests**

```swift
// JournalEntryTests.swift
import Testing
import SwiftData
@testable import stitchuation

struct JournalEntryTests {
    @Test func initSetsRequiredFields() {
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project, notes: "Test notes")
        #expect(entry.project === project)
        #expect(entry.notes == "Test notes")
        #expect(entry.deletedAt == nil)
        #expect(entry.syncedAt == nil)
    }

    @Test func initWithoutNotes() {
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)
        #expect(entry.notes == nil)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = StashCanvas(designer: "Test", designName: "Design")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)
        let after = Date()
        #expect(entry.createdAt >= before)
        #expect(entry.createdAt <= after)
    }
}
```

**Step 4: Build to verify tests compile and pass**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -20`
Expected: Tests PASS

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuationTests/
git commit -m "test(ios): add StitchProject, JournalEntry, ProjectStatus tests"
```

---

## Task 10: iOS — ProjectListView & ViewModel

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/ViewModels/ProjectListViewModel.swift`
- Create: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift` (add Projects tab)

**Context:** Follow the exact patterns from `StashListView.swift` and `StashListViewModel.swift`. Use `@Query` with soft-delete predicate, `@Observable` view model, grouped sections by status. Design system tokens for all styling.

**Step 1: Create ProjectListViewModel**

```swift
// ProjectListViewModel.swift
import Foundation

@MainActor
@Observable
final class ProjectListViewModel {
    var searchText = ""

    func filteredProjects(from projects: [StitchProject]) -> [StitchProject] {
        guard !searchText.isEmpty else { return projects }
        let query = searchText.lowercased()
        return projects.filter { project in
            project.canvas.designName.lowercased().contains(query) ||
            project.canvas.designer.lowercased().contains(query)
        }
    }

    func projectsByStatus(from projects: [StitchProject]) -> [(ProjectStatus, [StitchProject])] {
        let grouped = Dictionary(grouping: projects) { $0.status }
        return ProjectStatus.allCases.compactMap { status in
            guard let items = grouped[status], !items.isEmpty else { return nil }
            return (status, items)
        }
    }

    func deleteProject(_ project: StitchProject) {
        let now = Date()
        project.deletedAt = now
        project.updatedAt = now
    }
}
```

**Step 2: Create ProjectListView**

```swift
// ProjectListView.swift
import SwiftUI
import SwiftData

struct ProjectListView: View {
    private static let notDeletedPredicate = #Predicate<StitchProject> { $0.deletedAt == nil }

    @Query(
        filter: ProjectListView.notDeletedPredicate,
        sort: \StitchProject.createdAt,
        order: .reverse
    )
    private var projects: [StitchProject]

    @Environment(\.modelContext) private var modelContext
    @State private var viewModel = ProjectListViewModel()
    @State private var showStartProject = false

    var body: some View {
        Group {
            if projects.isEmpty {
                emptyState
            } else {
                projectList
            }
        }
        .navigationTitle("Projects")
        .searchable(text: $viewModel.searchText, prompt: "Search projects")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Start Project", systemImage: "plus") {
                    showStartProject = true
                }
                .foregroundStyle(Color.terracotta)
            }
        }
        .sheet(isPresented: $showStartProject) {
            StartProjectView()
        }
    }

    private var projectList: some View {
        let filtered = viewModel.filteredProjects(from: projects)
        let grouped = viewModel.projectsByStatus(from: filtered)

        return List {
            ForEach(grouped, id: \.0) { status, statusProjects in
                Section {
                    ForEach(statusProjects) { project in
                        NavigationLink(value: project.id) {
                            ProjectRowView(project: project)
                        }
                    }
                    .onDelete { offsets in
                        for offset in offsets {
                            viewModel.deleteProject(statusProjects[offset])
                        }
                    }
                } header: {
                    Text(status.displayName)
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.linen)
        .navigationDestination(for: UUID.self) { projectId in
            ProjectDetailView(projectId: projectId)
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "paintbrush.pointed")
                .font(.system(size: 48))
                .foregroundStyle(Color.clay)
            Text("No Projects Yet")
                .font(.playfair(22, weight: .semibold))
                .foregroundStyle(Color.espresso)
            Text("Start one from your Stitch Stash")
                .font(.sourceSerif(15))
                .foregroundStyle(Color.walnut)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.linen)
    }
}
```

**Step 3: Create ProjectRowView (inside ProjectListView.swift or separate)**

```swift
struct ProjectRowView: View {
    let project: StitchProject

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: project.canvas.imageKey, size: 48)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(project.canvas.designName)
                    .font(.sourceSerif(17, weight: .semibold))
                    .foregroundStyle(Color.espresso)
                    .lineLimit(1)
                Text(project.canvas.designer)
                    .font(.sourceSerif(15))
                    .foregroundStyle(Color.walnut)
                    .lineLimit(1)
            }

            Spacer()

            ProjectStatusBadge(status: project.status)
        }
        .padding(.vertical, Spacing.xs)
    }
}
```

**Step 4: Create ProjectStatusBadge (design system component)**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift`:

```swift
import SwiftUI

struct ProjectStatusBadge: View {
    let status: ProjectStatus

    private var backgroundColor: Color {
        switch status {
        case .wip: return Color.terracotta
        case .atFinishing: return Color.dustyRose
        case .completed: return Color.sage
        }
    }

    var body: some View {
        Text(status.displayName)
            .font(.sourceSerif(12, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xxs)
            .background(backgroundColor)
            .clipShape(Capsule())
    }
}
```

**Step 5: Add Projects tab to ContentView.swift**

Add between the Stitch Stash tab and Settings tab:

```swift
NavigationStack {
    ProjectListView()
}
.tabItem {
    Label("Projects", systemImage: "paintbrush.pointed")
}
```

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ViewModels/ProjectListViewModel.swift
git add apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift
git add apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): add ProjectListView with grouped status sections and Projects tab"
```

---

## Task 11: iOS — StartProjectView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift`

**Context:** Modal sheet that shows a list of canvases that don't already have a project. User picks one to start a new project (status=WIP). Follows the design system patterns.

**Step 1: Create StartProjectView**

```swift
// StartProjectView.swift
import SwiftUI
import SwiftData

struct StartProjectView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @Query(
        filter: #Predicate<StashCanvas> { $0.deletedAt == nil },
        sort: \StashCanvas.createdAt,
        order: .reverse
    )
    private var allCanvases: [StashCanvas]

    private var availableCanvases: [StashCanvas] {
        allCanvases.filter { $0.project == nil }
    }

    var body: some View {
        NavigationStack {
            Group {
                if availableCanvases.isEmpty {
                    VStack(spacing: Spacing.lg) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.clay)
                        Text("No Available Canvases")
                            .font(.playfair(22, weight: .semibold))
                            .foregroundStyle(Color.espresso)
                        Text("All your canvases already have projects, or your stash is empty.")
                            .font(.sourceSerif(15))
                            .foregroundStyle(Color.walnut)
                            .multilineTextAlignment(.center)
                    }
                    .padding(Spacing.xxl)
                } else {
                    List(availableCanvases) { canvas in
                        Button {
                            startProject(from: canvas)
                        } label: {
                            HStack(spacing: Spacing.md) {
                                CanvasThumbnail(imageKey: canvas.imageKey, size: 48)
                                VStack(alignment: .leading, spacing: Spacing.xxs) {
                                    Text(canvas.designName)
                                        .font(.sourceSerif(17, weight: .semibold))
                                        .foregroundStyle(Color.espresso)
                                    Text(canvas.designer)
                                        .font(.sourceSerif(15))
                                        .foregroundStyle(Color.walnut)
                                }
                            }
                            .padding(.vertical, Spacing.xs)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(Color.linen)
            .navigationTitle("Start Project")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func startProject(from canvas: StashCanvas) {
        let project = StitchProject(canvas: canvas)
        modelContext.insert(project)
        dismiss()
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift
git commit -m "feat(ios): add StartProjectView for creating projects from canvases"
```

---

## Task 12: iOS — ProjectDetailView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`

**Context:** Shows project info, status advancement, and journal timeline. Follows `CanvasDetailView.swift` pattern for loading data by ID. Uses design system throughout.

**Step 1: Create ProjectDetailView**

```swift
// ProjectDetailView.swift
import SwiftUI
import SwiftData

struct ProjectDetailView: View {
    let projectId: UUID

    @Environment(\.modelContext) private var modelContext
    @Environment(\.networkClient) private var networkClient
    @State private var project: StitchProject?
    @State private var showAddEntry = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        Group {
            if let project {
                projectContent(project)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color.linen)
        .task { loadProject() }
        .navigationTitle(project?.canvas.designName ?? "Project")
        .toolbar {
            if project != nil {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Delete Project", role: .destructive) {
                            showDeleteConfirmation = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundStyle(Color.terracotta)
                    }
                }
            }
        }
        .confirmationDialog("Delete this project?", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let project {
                    let now = Date()
                    project.deletedAt = now
                    project.updatedAt = now
                }
            }
        }
        .sheet(isPresented: $showAddEntry, onDismiss: { loadProject() }) {
            if let project {
                AddJournalEntryView(project: project)
            }
        }
    }

    @ViewBuilder
    private func projectContent(_ project: StitchProject) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                // Canvas image
                CanvasThumbnail(imageKey: project.canvas.imageKey, size: .infinity)
                    .frame(height: 250)

                VStack(spacing: Spacing.lg) {
                    // Status section
                    statusSection(project)

                    Divider().foregroundStyle(Color.slate.opacity(0.3))

                    // Info section
                    infoSection(project)

                    Divider().foregroundStyle(Color.slate.opacity(0.3))

                    // Journal timeline
                    journalSection(project)
                }
                .padding(Spacing.lg)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            Button {
                showAddEntry = true
            } label: {
                Image(systemName: "plus")
                    .font(.title2)
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.terracotta)
                    .clipShape(Circle())
                    .shadow(color: Color.espresso.opacity(0.2), radius: 8, y: 4)
            }
            .padding(Spacing.lg)
        }
    }

    private func statusSection(_ project: StitchProject) -> some View {
        HStack {
            ProjectStatusBadge(status: project.status)

            Spacer()

            if project.status != .completed {
                Button {
                    advanceStatus(project)
                } label: {
                    Text(project.status == .wip ? "Move to Finishing" : "Mark Complete")
                        .font(.sourceSerif(15, weight: .medium))
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func infoSection(_ project: StitchProject) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Details")
                .font(.playfair(17, weight: .semibold))
                .foregroundStyle(Color.espresso)

            if let startedAt = project.startedAt {
                detailRow("Started", value: startedAt.formatted(date: .abbreviated, time: .omitted))
            }
            if let finishingAt = project.finishingAt {
                detailRow("At Finishing", value: finishingAt.formatted(date: .abbreviated, time: .omitted))
            }
            if let completedAt = project.completedAt {
                detailRow("Completed", value: completedAt.formatted(date: .abbreviated, time: .omitted))
            }
            detailRow("Designer", value: project.canvas.designer)
        }
    }

    private func detailRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.sourceSerif(15))
                .foregroundStyle(Color.clay)
                .frame(width: 100, alignment: .leading)
            Text(value)
                .font(.sourceSerif(15))
                .foregroundStyle(Color.espresso)
        }
    }

    private func journalSection(_ project: StitchProject) -> some View {
        let entries = project.entries
            .filter { $0.deletedAt == nil }
            .sorted { $0.createdAt > $1.createdAt }

        return VStack(alignment: .leading, spacing: Spacing.lg) {
            Text("Journal")
                .font(.playfair(17, weight: .semibold))
                .foregroundStyle(Color.espresso)

            if entries.isEmpty {
                Text("No entries yet — tap + to add your first update")
                    .font(.sourceSerif(15))
                    .foregroundStyle(Color.clay)
            } else {
                ForEach(entries) { entry in
                    JournalEntryCard(entry: entry)
                }
            }
        }
    }

    private func advanceStatus(_ project: StitchProject) {
        let now = Date()
        switch project.status {
        case .wip:
            project.status = .atFinishing
            project.finishingAt = now
        case .atFinishing:
            project.status = .completed
            project.completedAt = now
        case .completed:
            break
        }
        project.updatedAt = now
    }

    private func loadProject() {
        let id = projectId
        let descriptor = FetchDescriptor<StitchProject>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        project = try? modelContext.fetch(descriptor).first
    }
}
```

**Step 2: Create JournalEntryCard**

Add to the same file or a separate file in Views/:

```swift
struct JournalEntryCard: View {
    let entry: JournalEntry

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                .font(.sourceSerif(13))
                .foregroundStyle(Color.clay)

            if let notes = entry.notes, !notes.isEmpty {
                Text(notes)
                    .font(.sourceSerif(15))
                    .foregroundStyle(Color.espresso)
            }

            let activeImages = entry.images
                .filter { $0.deletedAt == nil }
                .sorted { $0.sortOrder < $1.sortOrder }

            if !activeImages.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(activeImages) { image in
                            CanvasThumbnail(imageKey: image.imageKey, size: 80)
                        }
                    }
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
    }
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): add ProjectDetailView with status advancement and journal timeline"
```

---

## Task 13: iOS — AddJournalEntryView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift`

**Context:** Modal sheet for creating a journal entry with notes and 1-4 images. Follows `AddCanvasView.swift` patterns for photo picking and image upload. Reuses `compressImage` utility.

**Step 1: Create AddJournalEntryView**

```swift
// AddJournalEntryView.swift
import SwiftUI
import SwiftData
import PhotosUI

struct AddJournalEntryView: View {
    let project: StitchProject

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    @State private var notes = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var selectedImages: [Data] = []

    private var isValid: Bool {
        !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedImages.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What did you work on?", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                } header: {
                    Text("Notes")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.sm) {
                            ForEach(selectedImages.indices, id: \.self) { index in
                                if let uiImage = UIImage(data: selectedImages[index]) {
                                    Image(uiImage: uiImage)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 80, height: 80)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                        .overlay(alignment: .topTrailing) {
                                            Button {
                                                selectedImages.remove(at: index)
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundStyle(.white, Color.espresso)
                                            }
                                            .offset(x: 4, y: -4)
                                        }
                                }
                            }

                            if selectedImages.count < 4 {
                                PhotosPicker(
                                    selection: $selectedPhotos,
                                    maxSelectionCount: 4 - selectedImages.count,
                                    matching: .images
                                ) {
                                    VStack(spacing: Spacing.xs) {
                                        Image(systemName: "photo.badge.plus")
                                            .font(.system(size: 20))
                                            .foregroundStyle(Color.terracotta)
                                        Text("Add")
                                            .font(.sourceSerif(12))
                                            .foregroundStyle(Color.walnut)
                                    }
                                    .frame(width: 80, height: 80)
                                    .background(Color.parchment)
                                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                }
                            }
                        }
                        .padding(.vertical, Spacing.xs)
                    }
                    .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
                    .onChange(of: selectedPhotos) { _, newItems in
                        Task {
                            for item in newItems {
                                if let data = try? await item.loadTransferable(type: Data.self) {
                                    if selectedImages.count < 4 {
                                        selectedImages.append(data)
                                    }
                                }
                            }
                            selectedPhotos = []
                        }
                    }
                } header: {
                    Text("Photos")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
            }
            .font(.sourceSerif(17))
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle("New Entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveEntry() }
                        .disabled(!isValid)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func saveEntry() {
        let entry = JournalEntry(
            project: project,
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        modelContext.insert(entry)

        // Create local JournalImage records and upload in background
        let imagesToUpload = selectedImages
        let entryId = entry.id
        let projectId = project.id

        for (index, imageData) in imagesToUpload.enumerated() {
            let journalImage = JournalImage(entry: entry, imageKey: "", sortOrder: index)
            modelContext.insert(journalImage)

            if let networkClient {
                let imageId = journalImage.id
                Task {
                    do {
                        let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
                        let responseData = try await networkClient.uploadImage(
                            path: "/projects/\(projectId.uuidString)/entries/\(entryId.uuidString)/images",
                            imageData: compressed,
                            filename: "\(imageId.uuidString).jpg"
                        )
                        if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                           let imageKey = json["imageKey"] as? String {
                            journalImage.imageKey = imageKey
                        }
                    } catch {
                        // Upload failed — sync will reconcile later
                    }
                }
            }
        }

        dismiss()
    }

    private func compressImage(_ data: Data, maxBytes: Int) -> Data {
        guard let uiImage = UIImage(data: data) else { return data }
        var quality: CGFloat = 0.8
        var compressed = uiImage.jpegData(compressionQuality: quality) ?? data
        while compressed.count > maxBytes && quality > 0.1 {
            quality -= 0.1
            compressed = uiImage.jpegData(compressionQuality: quality) ?? data
        }
        return compressed
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): add AddJournalEntryView with multi-image support"
```

---

## Task 14: iOS — Stitch Stash Status Badges

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`

**Context:** Show project status badges on canvas rows in Stitch Stash, and add a project info section to canvas detail view. The `StashCanvas` model now has an optional `project: StitchProject?` relationship.

**Step 1: Update CanvasRowView in StashListView.swift**

Add the status badge to `CanvasRowView`. After the existing content in the `HStack`, add:

```swift
// Inside CanvasRowView's HStack, after the existing VStack and Spacer
if let project = canvas.project, project.deletedAt == nil {
    ProjectStatusBadge(status: project.status)
}
```

**Step 2: Update CanvasDetailView to show project info**

Add a project section to the detail view, after the existing detail fields:

```swift
// Add after existing detail rows but before the end of the ScrollView's VStack
if let project = canvas.project, project.deletedAt == nil {
    Divider().foregroundStyle(Color.slate.opacity(0.3))

    HStack {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Project")
                .font(.playfair(17, weight: .semibold))
                .foregroundStyle(Color.espresso)
            ProjectStatusBadge(status: project.status)
        }
        Spacer()
        NavigationLink(value: project.id) {
            Text("View Journal")
                .font(.sourceSerif(15, weight: .medium))
                .foregroundStyle(Color.terracotta)
        }
    }
}
```

And add a `navigationDestination` for project IDs:

```swift
.navigationDestination(for: UUID.self) { projectId in
    ProjectDetailView(projectId: projectId)
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/StashListView.swift
git add apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): add project status badges to Stitch Stash views"
```

---

## Task 15: iOS — SyncEngine Updates

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Context:** Add three new entity types to SyncEngine: `"project"`, `"journalEntry"`, `"journalImage"`. Follow the exact existing patterns for `"thread"` and `"canvas"`. Gather unsynced changes, build sync requests, apply server responses with last-write-wins.

**Step 1: Add project/entry/image gathering in sync push**

In the `sync()` method, after gathering unsynced canvases, add:

```swift
// Gather unsynced projects
let projectDescriptor = FetchDescriptor<StitchProject>()
let allProjects = (try? context.fetch(projectDescriptor)) ?? []
let unsyncedProjects = allProjects.filter { p in
    p.syncedAt == nil || p.updatedAt > (p.syncedAt ?? .distantPast)
}

for project in unsyncedProjects {
    let isDelete = project.deletedAt != nil
    var data: [String: AnyCodable]? = nil
    if !isDelete {
        data = [
            "canvasId": AnyCodable(project.canvas.id.uuidString),
            "status": AnyCodable(project.status.rawValue),
            "startedAt": project.startedAt.map { AnyCodable(Self.dateFormatter.string(from: $0)) } ?? AnyCodable(NSNull()),
            "finishingAt": project.finishingAt.map { AnyCodable(Self.dateFormatter.string(from: $0)) } ?? AnyCodable(NSNull()),
            "completedAt": project.completedAt.map { AnyCodable(Self.dateFormatter.string(from: $0)) } ?? AnyCodable(NSNull()),
        ]
    }
    changes.append(SyncChange(
        type: "project",
        action: isDelete ? "delete" : "upsert",
        id: project.id.uuidString,
        data: data,
        updatedAt: Self.dateFormatter.string(from: project.updatedAt),
        deletedAt: project.deletedAt.map { Self.dateFormatter.string(from: $0) }
    ))
}

// Similarly for journal entries and images (same pattern)
```

Follow the same pattern for `JournalEntry` (type `"journalEntry"`, data fields: `projectId`, `notes`) and `JournalImage` (type `"journalImage"`, data fields: `entryId`, `imageKey`, `sortOrder`).

**Step 2: Add project/entry/image processing in sync pull**

In the response processing loop, add cases for the new types:

```swift
case "project":
    // Follow the canvas pattern: look up by ID, compare timestamps, create or update
    // Use applyProjectData() helper

case "journalEntry":
    // Same pattern, look up JournalEntry by ID

case "journalImage":
    // Same pattern, look up JournalImage by ID
```

**Step 3: Add helper methods**

```swift
private func applyProjectData(_ data: [String: AnyCodable]?, to project: StitchProject, context: ModelContext) {
    guard let data else { return }
    if let statusStr = data["status"]?.value as? String,
       let status = ProjectStatus(rawValue: statusStr) {
        project.status = status
    }
    // Handle date fields: startedAt, finishingAt, completedAt
    // Use the same NSNull/date-parsing pattern as applyCanvasData
}
```

**Step 4: Mark synced items**

After successful sync, mark all unsynced projects/entries/images as synced (same pattern as threads and canvases):

```swift
for project in unsyncedProjects { project.syncedAt = Date() }
// Same for entries and images
```

**Step 5: Build and test**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): add project, journalEntry, journalImage to SyncEngine"
```

---

## Task 16: iOS — ViewModel Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuationTests/ProjectListViewModelTests.swift`

**Context:** Follow the pattern from `StashListViewModelTests.swift`. Use Swift Testing, in-memory ModelContainer, test filtering and grouping logic.

**Step 1: Write ViewModel tests**

```swift
// ProjectListViewModelTests.swift
import Testing
import SwiftData
@testable import stitchuation

@MainActor
struct ProjectListViewModelTests {
    let viewModel = ProjectListViewModel()

    private func makeProject(designer: String, designName: String, status: ProjectStatus = .wip) -> StitchProject {
        let canvas = StashCanvas(designer: designer, designName: designName)
        return StitchProject(canvas: canvas, status: status)
    }

    @Test func filteredProjectsReturnsAllWhenSearchEmpty() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 2)
    }

    @Test func filteredProjectsByDesigner() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "alice"
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 1)
        #expect(result[0].canvas.designer == "Alice")
    }

    @Test func filteredProjectsByDesignName() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "tree"
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 1)
    }

    @Test func projectsByStatusGroupsCorrectly() {
        let projects = [
            makeProject(designer: "A", designName: "D1", status: .wip),
            makeProject(designer: "B", designName: "D2", status: .completed),
            makeProject(designer: "C", designName: "D3", status: .wip),
            makeProject(designer: "D", designName: "D4", status: .atFinishing),
        ]
        let grouped = viewModel.projectsByStatus(from: projects)
        #expect(grouped.count == 3)
        #expect(grouped[0].0 == .wip)
        #expect(grouped[0].1.count == 2)
        #expect(grouped[1].0 == .atFinishing)
        #expect(grouped[1].1.count == 1)
        #expect(grouped[2].0 == .completed)
        #expect(grouped[2].1.count == 1)
    }

    @Test func projectsByStatusOmitsEmptyGroups() {
        let projects = [
            makeProject(designer: "A", designName: "D1", status: .wip),
        ]
        let grouped = viewModel.projectsByStatus(from: projects)
        #expect(grouped.count == 1)
        #expect(grouped[0].0 == .wip)
    }

    @Test func deleteProjectSoftDeletes() {
        let project = makeProject(designer: "A", designName: "D1")
        #expect(project.deletedAt == nil)
        viewModel.deleteProject(project)
        #expect(project.deletedAt != nil)
        #expect(project.updatedAt == project.deletedAt)
    }
}
```

**Step 2: Build and run tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -20`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuationTests/ProjectListViewModelTests.swift
git commit -m "test(ios): add ProjectListViewModel tests"
```

---

## Task 17: Build Verification & Full Test Suite

**Files:** None (verification only)

**Step 1: Run full API test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS (existing + new project/journal tests)

**Step 2: Build iOS app**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Run full iOS test suite**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -20`
Expected: All tests PASS

**Step 4: Commit any remaining changes and push**

```bash
git push origin main
```
