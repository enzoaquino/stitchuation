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
