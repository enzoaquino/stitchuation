import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { StitchGuideService } from "./stitch-guide-service.js";
import { DocumentConverter } from "./document-converter.js";
import { parseStitchGuideRequestSchema } from "./schemas.js";

const stitchGuideRoutes = new Hono<AuthEnv>();
const service = new StitchGuideService();

stitchGuideRoutes.use("/*", authMiddleware);

stitchGuideRoutes.post("/parse", async (c) => {
  const body = await c.req.json();
  const parsed = parseStitchGuideRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
  }

  const { file, mediaType } = parsed.data;

  try {
    const converter = new DocumentConverter();
    const images = await converter.toImages(file, mediaType);
    const materials = await service.parseImages(images);

    if (materials.length === 0) {
      return c.json(
        { error: "No materials found in the provided file" },
        422
      );
    }

    return c.json({ materials });
  } catch (error) {
    console.error("Stitch guide parsing failed:", error);
    return c.json({ error: "Failed to parse stitch guide" }, 500);
  }
});

export { stitchGuideRoutes };
