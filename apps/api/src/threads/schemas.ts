import { z } from "zod";

const fiberTypes = ["wool", "cotton", "silk", "synthetic", "blend", "other"] as const;

export const createThreadSchema = z.object({
  id: z.string().uuid().optional(),
  brand: z.string().min(1).max(100),
  number: z.string().min(1).max(50),
  colorName: z.string().max(100).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fiberType: z.enum(fiberTypes).default("wool"),
  quantity: z.number().int().min(0).default(0),
  barcode: z.string().max(50).optional(),
  weightOrLength: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateThreadSchema = createThreadSchema.omit({ id: true }).partial();

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
