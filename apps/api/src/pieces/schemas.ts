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
  .omit({ id: true, status: true })
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
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

export const materialTypes = ["thread", "bead", "accessory", "other"] as const;
export type MaterialType = typeof materialTypes[number];

export const createMaterialSchema = z.object({
  id: z.string().uuid().optional(),
  materialType: z.enum(materialTypes).optional(),
  brand: z.string().max(200).optional(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  acquired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateMaterialSchema = z.object({
  materialType: z.enum(materialTypes).optional(),
  brand: z.string().max(200).nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).nullable().optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().max(50).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  acquired: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine((obj) => Object.keys(obj).length > 0, {
  message: "At least one field is required",
});

export const batchCreateMaterialsSchema = z.array(createMaterialSchema).min(1).max(50);

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
