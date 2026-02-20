import { z } from "zod";

export const pieceStatuses = ["stash", "kitting", "wip", "stitched", "at_finishing", "finished"] as const;
export type PieceStatus = typeof pieceStatuses[number];

export const createPieceSchema = z.object({
  id: z.string().uuid().optional(),
  designer: z.string().min(1).max(200),
  designName: z.string().min(1).max(200),
  status: z.enum(pieceStatuses).optional(),
  acquiredAt: z.string().datetime().optional(),
  size: z.string().max(100).optional(),
  meshCount: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePieceSchema = createPieceSchema
  .omit({ id: true })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

export const setStatusSchema = z.object({
  status: z.enum(pieceStatuses),
});

export const createJournalEntrySchema = z.object({
  id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateJournalEntrySchema = z.object({
  notes: z.string().min(1).max(5000),
});

export const uuidSchema = z.string().uuid();

export type CreatePieceInput = z.infer<typeof createPieceSchema>;
export type UpdatePieceInput = z.infer<typeof updatePieceSchema>;
