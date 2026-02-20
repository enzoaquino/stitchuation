import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { db } from "../db/connection.js";
import { journalEntries, journalImages } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "./schemas.js";

export class JournalService {
  async createEntry(userId: string, pieceId: string, input: CreateJournalEntryInput) {
    const [entry] = await db
      .insert(journalEntries)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId,
        pieceId,
        notes: input.notes ?? null,
      })
      .returning();

    return entry;
  }

  async listEntries(userId: string, pieceId: string) {
    return db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.pieceId, pieceId),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .orderBy(desc(journalEntries.createdAt));
  }

  async getEntry(userId: string, id: string) {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .limit(1);

    return entry ?? null;
  }

  async updateEntry(userId: string, id: string, input: UpdateJournalEntryInput) {
    const [updated] = await db
      .update(journalEntries)
      .set({ notes: input.notes, updatedAt: new Date() })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundError("Journal entry");
    return updated;
  }

  async softDeleteEntry(userId: string, id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(journalEntries)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(journalEntries.id, id),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .returning();

    if (!deleted) throw new NotFoundError("Journal entry");
    return deleted;
  }

  async addImage(entryId: string, imageKey: string, sortOrder: number) {
    const [image] = await db
      .insert(journalImages)
      .values({
        entryId,
        imageKey,
        sortOrder,
      })
      .returning();

    return image;
  }

  async listImages(entryId: string) {
    return db
      .select()
      .from(journalImages)
      .where(
        and(
          eq(journalImages.entryId, entryId),
          isNull(journalImages.deletedAt),
        ),
      )
      .orderBy(asc(journalImages.sortOrder));
  }

  async softDeleteImage(id: string) {
    const now = new Date();
    const [deleted] = await db
      .update(journalImages)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(journalImages.id, id),
          isNull(journalImages.deletedAt),
        ),
      )
      .returning();

    if (!deleted) throw new NotFoundError("Journal image");
    return deleted;
  }
}
