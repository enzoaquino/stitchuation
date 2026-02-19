import { z } from "zod";

export const createCanvasSchema = z.object({
  id: z.string().uuid().optional(),
  designer: z.string().min(1).max(200),
  designName: z.string().min(1).max(200),
  acquiredAt: z.string().datetime().optional(),
  size: z.string().max(100).optional(),
  meshCount: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCanvasSchema = createCanvasSchema.omit({ id: true }).partial();

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
