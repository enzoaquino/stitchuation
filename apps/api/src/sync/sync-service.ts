import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { threads, canvases, projects, journalEntries, journalImages } from "../db/schema.js";
import type { SyncChange, SyncRequest } from "./schemas.js";
import { getStorage } from "../storage/index.js";

// Allowlisted fields that clients may set via sync
const ALLOWED_THREAD_FIELDS = new Set([
  "brand",
  "number",
  "colorName",
  "colorHex",
  "fiberType",
  "quantity",
  "barcode",
  "weightOrLength",
  "notes",
]);

const ALLOWED_CANVAS_FIELDS = new Set([
  "designer",
  "designName",
  "acquiredAt",
  "imageKey",
  "size",
  "meshCount",
  "notes",
]);

const ALLOWED_PROJECT_FIELDS = new Set([
  "canvasId",
  "status",
  "startedAt",
  "finishingAt",
  "completedAt",
]);

const ALLOWED_JOURNAL_ENTRY_FIELDS = new Set([
  "projectId",
  "notes",
]);

const ALLOWED_JOURNAL_IMAGE_FIELDS = new Set([
  "entryId",
  "imageKey",
  "sortOrder",
]);

function pickAllowedFields(data: Record<string, unknown>, allowedFields: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export class SyncService {
  async sync(userId: string, request: SyncRequest) {
    const serverTimestamp = new Date();

    // Process incoming changes in a transaction for atomicity
    await db.transaction(async (tx) => {
      for (const change of request.changes) {
        if (change.type === "thread") {
          await this.processThreadChange(tx, userId, change);
        } else if (change.type === "canvas") {
          await this.processCanvasChange(tx, userId, change);
        } else if (change.type === "project") {
          await this.processProjectChange(tx, userId, change);
        } else if (change.type === "journalEntry") {
          await this.processJournalEntryChange(tx, userId, change);
        } else if (change.type === "journalImage") {
          await this.processJournalImageChange(tx, userId, change);
        }
      }
    });

    // Gather server changes since lastSync
    const changes = await this.getChangesSince(userId, request.lastSync);

    return {
      serverTimestamp: serverTimestamp.toISOString(),
      changes,
    };
  }

  private async processThreadChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(threads)
        .where(and(eq(threads.id, change.id), eq(threads.userId, userId)))
        .limit(1);

      // Server wins on ties (strict <)
      if (existing && existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(threads)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(and(eq(threads.id, change.id), eq(threads.userId, userId)));
      }
      return;
    }

    // Upsert
    const [existing] = await tx
      .select()
      .from(threads)
      .where(and(eq(threads.id, change.id), eq(threads.userId, userId)))
      .limit(1);

    if (!existing) {
      // New thread from client — use allowlisted fields only
      // onConflictDoNothing handles the case where the thread ID
      // exists but belongs to another user
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_THREAD_FIELDS) : {};
      await tx.insert(threads).values({
        id: change.id,
        userId,
        brand: (allowed.brand as string) ?? "",
        number: (allowed.number as string) ?? "",
        colorName: allowed.colorName as string | undefined,
        colorHex: allowed.colorHex as string | undefined,
        fiberType: (allowed.fiberType as any) ?? "wool",
        quantity: (allowed.quantity as number) ?? 0,
        barcode: allowed.barcode as string | undefined,
        weightOrLength: allowed.weightOrLength as string | undefined,
        notes: allowed.notes as string | undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else if (existing.updatedAt < clientUpdatedAt) {
      // Client is newer (server wins on ties) — apply allowlisted fields
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        Object.assign(updateData, pickAllowedFields(change.data, ALLOWED_THREAD_FIELDS));
      }
      await tx
        .update(threads)
        .set(updateData)
        .where(and(eq(threads.id, change.id), eq(threads.userId, userId)));
    }
    // else: server is newer or equal, ignore client change
  }

  private async processCanvasChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(canvases)
        .where(and(eq(canvases.id, change.id), eq(canvases.userId, userId)))
        .limit(1);

      if (existing && existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(canvases)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(and(eq(canvases.id, change.id), eq(canvases.userId, userId)));

        // Clean up image file
        if (existing.imageKey) {
          try {
            const storage = getStorage();
            await storage.delete(existing.imageKey);
          } catch {
            // Best-effort cleanup — do not fail sync
          }
        }
      }
      return;
    }

    const [existing] = await tx
      .select()
      .from(canvases)
      .where(and(eq(canvases.id, change.id), eq(canvases.userId, userId)))
      .limit(1);

    if (!existing) {
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_CANVAS_FIELDS) : {};
      await tx.insert(canvases).values({
        id: change.id,
        userId,
        designer: (allowed.designer as string) ?? "",
        designName: (allowed.designName as string) ?? "",
        acquiredAt: allowed.acquiredAt ? new Date(allowed.acquiredAt as string) : undefined,
        imageKey: allowed.imageKey as string | undefined,
        size: allowed.size as string | undefined,
        meshCount: allowed.meshCount as number | undefined,
        notes: allowed.notes as string | undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else if (existing.updatedAt < clientUpdatedAt) {
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        const allowed = pickAllowedFields(change.data, ALLOWED_CANVAS_FIELDS);
        if (allowed.acquiredAt) {
          allowed.acquiredAt = new Date(allowed.acquiredAt as string);
        }
        Object.assign(updateData, allowed);
      }
      await tx
        .update(canvases)
        .set(updateData)
        .where(and(eq(canvases.id, change.id), eq(canvases.userId, userId)));
    }
  }

  private async processProjectChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, change.id), eq(projects.userId, userId)))
        .limit(1);

      if (existing && existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(projects)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(and(eq(projects.id, change.id), eq(projects.userId, userId)));
      }
      return;
    }

    const [existing] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, change.id), eq(projects.userId, userId)))
      .limit(1);

    if (!existing) {
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_PROJECT_FIELDS) : {};
      await tx.insert(projects).values({
        id: change.id,
        userId,
        canvasId: (allowed.canvasId as string) ?? "",
        status: (allowed.status as any) ?? "wip",
        startedAt: allowed.startedAt ? new Date(allowed.startedAt as string) : undefined,
        finishingAt: allowed.finishingAt ? new Date(allowed.finishingAt as string) : undefined,
        completedAt: allowed.completedAt ? new Date(allowed.completedAt as string) : undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else if (existing.updatedAt < clientUpdatedAt) {
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        const allowed = pickAllowedFields(change.data, ALLOWED_PROJECT_FIELDS);
        if (allowed.startedAt) {
          allowed.startedAt = new Date(allowed.startedAt as string);
        }
        if (allowed.finishingAt) {
          allowed.finishingAt = new Date(allowed.finishingAt as string);
        }
        if (allowed.completedAt) {
          allowed.completedAt = new Date(allowed.completedAt as string);
        }
        Object.assign(updateData, allowed);
      }
      await tx
        .update(projects)
        .set(updateData)
        .where(and(eq(projects.id, change.id), eq(projects.userId, userId)));
    }
  }

  private async processJournalEntryChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, change.id), eq(journalEntries.userId, userId)))
        .limit(1);

      if (existing && existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(journalEntries)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(and(eq(journalEntries.id, change.id), eq(journalEntries.userId, userId)));
      }
      return;
    }

    const [existing] = await tx
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, change.id), eq(journalEntries.userId, userId)))
      .limit(1);

    if (!existing) {
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_JOURNAL_ENTRY_FIELDS) : {};
      await tx.insert(journalEntries).values({
        id: change.id,
        userId,
        projectId: (allowed.projectId as string) ?? "",
        notes: allowed.notes as string | undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else if (existing.updatedAt < clientUpdatedAt) {
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        Object.assign(updateData, pickAllowedFields(change.data, ALLOWED_JOURNAL_ENTRY_FIELDS));
      }
      await tx
        .update(journalEntries)
        .set(updateData)
        .where(and(eq(journalEntries.id, change.id), eq(journalEntries.userId, userId)));
    }
  }

  private async processJournalImageChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(journalImages)
        .where(eq(journalImages.id, change.id))
        .limit(1);

      if (!existing) return;

      // Verify the image's parent entry belongs to this user
      const [parentEntry] = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, existing.entryId), eq(journalEntries.userId, userId)))
        .limit(1);

      if (!parentEntry) return; // Skip silently — entry doesn't belong to this user

      if (existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(journalImages)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(eq(journalImages.id, change.id));

        // Clean up image file
        if (existing.imageKey) {
          try {
            const storage = getStorage();
            await storage.delete(existing.imageKey);
          } catch {
            // Best-effort cleanup — do not fail sync
          }
        }
      }
      return;
    }

    const [existing] = await tx
      .select()
      .from(journalImages)
      .where(eq(journalImages.id, change.id))
      .limit(1);

    if (!existing) {
      // New image — verify the target entry belongs to this user
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_JOURNAL_IMAGE_FIELDS) : {};
      const targetEntryId = (allowed.entryId as string) ?? "";

      if (targetEntryId) {
        const [parentEntry] = await tx
          .select()
          .from(journalEntries)
          .where(and(eq(journalEntries.id, targetEntryId), eq(journalEntries.userId, userId)))
          .limit(1);

        if (!parentEntry) return; // Skip silently — entry doesn't belong to this user
      }

      await tx.insert(journalImages).values({
        id: change.id,
        entryId: targetEntryId,
        imageKey: (allowed.imageKey as string) ?? "",
        sortOrder: (allowed.sortOrder as number) ?? 0,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else {
      // Existing image — verify the image's parent entry belongs to this user
      const [parentEntry] = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, existing.entryId), eq(journalEntries.userId, userId)))
        .limit(1);

      if (!parentEntry) return; // Skip silently — entry doesn't belong to this user

      if (existing.updatedAt < clientUpdatedAt) {
        const updateData: Record<string, unknown> = {
          updatedAt: clientUpdatedAt,
        };
        if (change.data) {
          Object.assign(updateData, pickAllowedFields(change.data, ALLOWED_JOURNAL_IMAGE_FIELDS));
        }
        await tx
          .update(journalImages)
          .set(updateData)
          .where(eq(journalImages.id, change.id));
      }
    }
  }

  private async getChangesSince(userId: string, lastSync: string | null) {
    const since = lastSync ? new Date(lastSync) : new Date(0);

    const changedThreads = await db
      .select()
      .from(threads)
      .where(and(eq(threads.userId, userId), gt(threads.updatedAt, since)));

    const changedCanvases = await db
      .select()
      .from(canvases)
      .where(and(eq(canvases.userId, userId), gt(canvases.updatedAt, since)));

    const changedProjects = await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), gt(projects.updatedAt, since)));

    const changedJournalEntries = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), gt(journalEntries.updatedAt, since)));

    // Journal images don't have userId — query via entries belonging to the user
    let changedJournalImages: (typeof journalImages.$inferSelect)[] = [];
    const userEntryIds = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId));

    if (userEntryIds.length > 0) {
      changedJournalImages = await db
        .select()
        .from(journalImages)
        .where(
          and(
            inArray(journalImages.entryId, userEntryIds.map((e) => e.id)),
            gt(journalImages.updatedAt, since),
          ),
        );
    }

    const threadChanges = changedThreads.map((t) => ({
      type: "thread" as const,
      action: t.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: t.id,
      data: t.deletedAt
        ? undefined
        : {
            brand: t.brand,
            number: t.number,
            colorName: t.colorName,
            colorHex: t.colorHex,
            fiberType: t.fiberType,
            quantity: t.quantity,
            barcode: t.barcode,
            weightOrLength: t.weightOrLength,
            notes: t.notes,
          },
      updatedAt: t.updatedAt.toISOString(),
      deletedAt: t.deletedAt?.toISOString(),
    }));

    const canvasChanges = changedCanvases.map((c) => ({
      type: "canvas" as const,
      action: c.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: c.id,
      data: c.deletedAt
        ? undefined
        : {
            designer: c.designer,
            designName: c.designName,
            acquiredAt: c.acquiredAt?.toISOString(),
            imageKey: c.imageKey,
            size: c.size,
            meshCount: c.meshCount,
            notes: c.notes,
          },
      updatedAt: c.updatedAt.toISOString(),
      deletedAt: c.deletedAt?.toISOString(),
    }));

    const projectChanges = changedProjects.map((p) => ({
      type: "project" as const,
      action: p.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: p.id,
      data: p.deletedAt
        ? undefined
        : {
            canvasId: p.canvasId,
            status: p.status,
            startedAt: p.startedAt?.toISOString(),
            finishingAt: p.finishingAt?.toISOString(),
            completedAt: p.completedAt?.toISOString(),
          },
      updatedAt: p.updatedAt.toISOString(),
      deletedAt: p.deletedAt?.toISOString(),
    }));

    const journalEntryChanges = changedJournalEntries.map((e) => ({
      type: "journalEntry" as const,
      action: e.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: e.id,
      data: e.deletedAt
        ? undefined
        : {
            projectId: e.projectId,
            notes: e.notes,
          },
      updatedAt: e.updatedAt.toISOString(),
      deletedAt: e.deletedAt?.toISOString(),
    }));

    const journalImageChanges = changedJournalImages.map((i) => ({
      type: "journalImage" as const,
      action: i.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: i.id,
      data: i.deletedAt
        ? undefined
        : {
            entryId: i.entryId,
            imageKey: i.imageKey,
            sortOrder: i.sortOrder,
          },
      updatedAt: i.updatedAt.toISOString(),
      deletedAt: i.deletedAt?.toISOString(),
    }));

    return [
      ...threadChanges,
      ...canvasChanges,
      ...projectChanges,
      ...journalEntryChanges,
      ...journalImageChanges,
    ];
  }
}
