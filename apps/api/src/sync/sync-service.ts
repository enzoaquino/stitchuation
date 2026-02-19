import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/connection.js";
import { threads, canvases } from "../db/schema.js";
import type { SyncChange, SyncRequest } from "./schemas.js";

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

    return [...threadChanges, ...canvasChanges];
  }
}
