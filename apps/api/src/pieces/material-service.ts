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
        name: input.name,
        materialType: input.materialType ?? "other",
        brand: input.brand ?? null,
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
    const values = items.map((input) => ({
      ...(input.id ? { id: input.id } : {}),
      userId,
      pieceId,
      name: input.name,
      materialType: input.materialType ?? "other",
      brand: input.brand ?? null,
      code: input.code ?? null,
      quantity: input.quantity ?? 1,
      unit: input.unit ?? null,
      notes: input.notes ?? null,
      acquired: input.acquired ? 1 : 0,
      sortOrder: input.sortOrder ?? 0,
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
