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
