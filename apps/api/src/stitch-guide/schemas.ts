import { z } from "zod";

export const supportedMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const imageMediaTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupportedMediaType = (typeof supportedMediaTypes)[number];

export const parseStitchGuideRequestSchema = z.object({
  file: z.string().min(1, "file is required"),
  mediaType: z.enum(supportedMediaTypes),
});

export type ParseStitchGuideRequest = z.infer<typeof parseStitchGuideRequestSchema>;

export const materialTypes = ["thread", "bead", "accessory", "other"] as const;

// Coerce Claude's materialType to our enum, defaulting unknown values to "other"
const materialTypeSchema = z
  .string()
  .transform((val) => {
    const lower = val.toLowerCase();
    if (materialTypes.includes(lower as (typeof materialTypes)[number])) {
      return lower as (typeof materialTypes)[number];
    }
    return "other" as const;
  });

export const parsedMaterialSchema = z.object({
  materialType: materialTypeSchema,
  brand: z.string().nullish(),
  name: z.string().min(1),
  code: z.union([z.string(), z.number().transform(String)]).nullish(),
  quantity: z
    .union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().positive())
    .default(1),
  unit: z.string().nullish(),
});

export type ParsedMaterial = z.infer<typeof parsedMaterialSchema>;

export const parseStitchGuideResponseSchema = z.object({
  materials: z.array(parsedMaterialSchema),
});

export type ParseStitchGuideResponse = z.infer<typeof parseStitchGuideResponseSchema>;
