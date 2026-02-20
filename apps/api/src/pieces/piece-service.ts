import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { stitchPieces } from "../db/schema.js";
import { NotFoundError, BadRequestError } from "../errors.js";
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
      throw new BadRequestError("Piece is already finished");
    }

    const nextStatus = pieceStatuses[currentIndex + 1];
    const updateData: Record<string, unknown> = { status: nextStatus, updatedAt: now };

    if (nextStatus === "kitting") updateData.startedAt = piece.startedAt ?? now;
    if (nextStatus === "stitched") updateData.stitchedAt = now;
    if (nextStatus === "at_finishing") updateData.finishingAt = now;
    if (nextStatus === "finished") updateData.completedAt = now;

    const [updated] = await db
      .update(stitchPieces)
      .set(updateData)
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Piece");
    return updated;
  }

  async setStatus(userId: string, id: string, status: PieceStatus) {
    const piece = await this.getById(userId, id);
    if (!piece) throw new NotFoundError("Piece");

    const now = new Date();
    const updateData: Record<string, unknown> = { status, updatedAt: now };

    // Set/clear lifecycle timestamps based on target status
    const targetIndex = pieceStatuses.indexOf(status);
    const kittingIndex = pieceStatuses.indexOf("kitting");
    const stitchedIndex = pieceStatuses.indexOf("stitched");
    const atFinishingIndex = pieceStatuses.indexOf("at_finishing");
    const finishedIndex = pieceStatuses.indexOf("finished");

    updateData.startedAt = targetIndex >= kittingIndex ? (piece.startedAt ?? now) : null;
    updateData.stitchedAt = targetIndex >= stitchedIndex ? (piece.stitchedAt ?? now) : null;
    updateData.finishingAt = targetIndex >= atFinishingIndex ? (piece.finishingAt ?? now) : null;
    updateData.completedAt = targetIndex >= finishedIndex ? (piece.completedAt ?? now) : null;

    const [updated] = await db
      .update(stitchPieces)
      .set(updateData)
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Piece");
    return updated;
  }

  async shelve(userId: string, id: string) {
    const piece = await this.getById(userId, id);
    if (!piece) throw new NotFoundError("Piece");

    if (piece.status === "stash") {
      throw new BadRequestError("Piece is already in stash");
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
      .where(and(eq(stitchPieces.id, id), eq(stitchPieces.userId, userId), isNull(stitchPieces.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundError("Piece");
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
