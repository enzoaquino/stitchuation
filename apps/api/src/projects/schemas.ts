import { z } from "zod";

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
