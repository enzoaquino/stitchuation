import { z } from "zod";

const syncChangeSchema = z.object({
  type: z.enum(["thread"]),
  action: z.enum(["upsert", "delete"]),
  id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(),
});

export const syncRequestSchema = z.object({
  lastSync: z.string().datetime().nullable(),
  changes: z.array(syncChangeSchema),
});

export type SyncChange = z.infer<typeof syncChangeSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
