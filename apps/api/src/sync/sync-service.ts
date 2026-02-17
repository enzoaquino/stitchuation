import { and, eq, gt } from "drizzle-orm";
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
        brand: change.data?.brand ?? "",
        number: change.data?.number ?? "",
        colorName: change.data?.colorName as string | undefined,
        colorHex: change.data?.colorHex as string | undefined,
        fiberType: (change.data?.fiberType as any) ?? "wool",
        quantity: (change.data?.quantity as number) ?? 0,
        barcode: change.data?.barcode as string | undefined,
        weightOrLength: change.data?.weightOrLength as string | undefined,
        notes: change.data?.notes as string | undefined,
        createdAt: clientUpdatedAt,
        updatedAt: clientUpdatedAt,
      });
    } else if (existing.updatedAt <= clientUpdatedAt) {
      // Client is newer — apply update
      const updateData: Record<string, unknown> = {
        updatedAt: clientUpdatedAt,
      };
      if (change.data) {
        for (const [key, value] of Object.entries(change.data)) {
          if (key !== "id" && key !== "userId" && key !== "createdAt") {
            updateData[key] = value;
          }
        }
      }
      await db
        .update(threads)
        .set(updateData)
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
