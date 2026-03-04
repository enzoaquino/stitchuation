import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { threads, stitchPieces, journalEntries, journalImages, pieceMaterials } from "../db/schema.js";
import type { SyncChange, SyncRequest } from "./schemas.js";
import { pieceStatuses, materialTypes } from "../pieces/schemas.js";
import { getStorage, resolveImageKey } from "../storage/index.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  "lotNumber",
  "notes",
]);

const ALLOWED_PIECE_FIELDS = new Set([
  "designer",
  "designName",
  "status",
  // imageKey is managed by upload endpoints, not sync — clients send resolved
  // SAS URLs which would corrupt the plain key stored in the DB
  "size",
  "meshCount",
  "notes",
  "acquiredAt",
  "startedAt",
  "stitchedAt",
  "finishingAt",
  "completedAt",
]);

const ALLOWED_JOURNAL_ENTRY_FIELDS = new Set([
  "pieceId",
  "notes",
]);

const ALLOWED_JOURNAL_IMAGE_FIELDS = new Set([
  "entryId",
  // imageKey is managed by upload endpoints, not sync
  "sortOrder",
]);

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
        } else if (change.type === "piece") {
          await this.processPieceChange(tx, userId, change);
        } else if (change.type === "journalEntry") {
          await this.processJournalEntryChange(tx, userId, change);
        } else if (change.type === "journalImage") {
          await this.processJournalImageChange(tx, userId, change);
        } else if (change.type === "pieceMaterial") {
          await this.processPieceMaterialChange(tx, userId, change);
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
        lotNumber: allowed.lotNumber as string | undefined,
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

  private async processPieceChange(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, change: SyncChange) {
    const clientUpdatedAt = new Date(change.updatedAt);

    if (change.action === "delete") {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : new Date();

      const [existing] = await tx
        .select()
        .from(stitchPieces)
        .where(and(eq(stitchPieces.id, change.id), eq(stitchPieces.userId, userId)))
        .limit(1);

      if (existing && existing.updatedAt < clientUpdatedAt) {
        await tx
          .update(stitchPieces)
          .set({ deletedAt, updatedAt: clientUpdatedAt })
          .where(and(eq(stitchPieces.id, change.id), eq(stitchPieces.userId, userId)));

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
      .from(stitchPieces)
      .where(and(eq(stitchPieces.id, change.id), eq(stitchPieces.userId, userId)))
      .limit(1);

    if (!existing) {
      const allowed = change.data ? pickAllowedFields(change.data, ALLOWED_PIECE_FIELDS) : {};
      const status = pieceStatuses.includes(allowed.status as any) ? (allowed.status as any) : "stash";
      await tx.insert(stitchPieces).values({
        id: change.id,
        userId,
        designer: (allowed.designer as string) ?? "",
        designName: (allowed.designName as string) ?? "",
        status,
        imageKey: allowed.imageKey as string | undefined,
        size: allowed.size as string | undefined,
        meshCount: allowed.meshCount as number | undefined,
        notes: allowed.notes as string | undefined,
        acquiredAt: allowed.acquiredAt ? new Date(allowed.acquiredAt as string) : undefined,
        startedAt: allowed.startedAt ? new Date(allowed.startedAt as string) : undefined,
        stitchedAt: allowed.stitchedAt ? new Date(allowed.stitchedAt as string) : undefined,
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
        const allowed = pickAllowedFields(change.data, ALLOWED_PIECE_FIELDS);
        // Validate status enum value
        if (allowed.status !== undefined && !pieceStatuses.includes(allowed.status as any)) {
          delete allowed.status;
        }
        if (allowed.acquiredAt !== undefined) {
          allowed.acquiredAt = allowed.acquiredAt ? new Date(allowed.acquiredAt as string) : null;
        }
        if (allowed.startedAt !== undefined) {
          allowed.startedAt = allowed.startedAt ? new Date(allowed.startedAt as string) : null;
        }
        if (allowed.stitchedAt !== undefined) {
          allowed.stitchedAt = allowed.stitchedAt ? new Date(allowed.stitchedAt as string) : null;
        }
        if (allowed.finishingAt !== undefined) {
          allowed.finishingAt = allowed.finishingAt ? new Date(allowed.finishingAt as string) : null;
        }
        if (allowed.completedAt !== undefined) {
          allowed.completedAt = allowed.completedAt ? new Date(allowed.completedAt as string) : null;
        }
        Object.assign(updateData, allowed);
      }
      await tx
        .update(stitchPieces)
        .set(updateData)
        .where(and(eq(stitchPieces.id, change.id), eq(stitchPieces.userId, userId)));
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
      const targetPieceId = allowed.pieceId as string | undefined;
      if (!targetPieceId || !UUID_REGEX.test(targetPieceId)) return;
      await tx.insert(journalEntries).values({
        id: change.id,
        userId,
        pieceId: targetPieceId,
        notes: allowed.notes as string | undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      }).onConflictDoNothing();
    } else if (existing.updatedAt < clientUpdatedAt) {
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        const allowed = pickAllowedFields(change.data, ALLOWED_JOURNAL_ENTRY_FIELDS);
        // Prevent re-parenting entries via sync
        delete allowed.pieceId;
        Object.assign(updateData, allowed);
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
          const allowed = pickAllowedFields(change.data, ALLOWED_JOURNAL_IMAGE_FIELDS);
          // Prevent re-parenting images via sync
          delete allowed.entryId;
          Object.assign(updateData, allowed);
        }
        await tx
          .update(journalImages)
          .set(updateData)
          .where(eq(journalImages.id, change.id));
      }
    }
  }

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

      // Validate materialType enum value
      const materialType = materialTypes.includes(allowed.materialType as any)
        ? (allowed.materialType as any)
        : "other";

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
        // Prevent re-parenting materials via sync
        delete allowed.pieceId;
        // Validate materialType enum value
        if (allowed.materialType !== undefined && !materialTypes.includes(allowed.materialType as any)) {
          delete allowed.materialType;
        }
        // Convert acquired boolean to integer
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

  private async getChangesSince(userId: string, lastSync: string | null) {
    const since = lastSync ? new Date(lastSync) : new Date(0);

    const changedThreads = await db
      .select()
      .from(threads)
      .where(and(eq(threads.userId, userId), gt(threads.updatedAt, since)));

    const changedPieces = await db
      .select()
      .from(stitchPieces)
      .where(and(eq(stitchPieces.userId, userId), gt(stitchPieces.updatedAt, since)));

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

    const changedMaterials = await db
      .select()
      .from(pieceMaterials)
      .where(and(eq(pieceMaterials.userId, userId), gt(pieceMaterials.updatedAt, since)));

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
            lotNumber: t.lotNumber,
            notes: t.notes,
          },
      updatedAt: t.updatedAt.toISOString(),
      deletedAt: t.deletedAt?.toISOString(),
    }));

    const pieceChanges = changedPieces.map((p) => ({
      type: "piece" as const,
      action: p.deletedAt ? ("delete" as const) : ("upsert" as const),
      id: p.id,
      data: p.deletedAt
        ? undefined
        : {
            designer: p.designer,
            designName: p.designName,
            status: p.status,
            imageKey: resolveImageKey(p.imageKey),
            size: p.size,
            meshCount: p.meshCount,
            notes: p.notes,
            acquiredAt: p.acquiredAt?.toISOString(),
            startedAt: p.startedAt?.toISOString(),
            stitchedAt: p.stitchedAt?.toISOString(),
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
            pieceId: e.pieceId,
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
            imageKey: resolveImageKey(i.imageKey),
            sortOrder: i.sortOrder,
          },
      updatedAt: i.updatedAt.toISOString(),
      deletedAt: i.deletedAt?.toISOString(),
    }));

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

    return [
      ...threadChanges,
      ...pieceChanges,
      ...journalEntryChanges,
      ...journalImageChanges,
      ...materialChanges,
    ];
  }
}
