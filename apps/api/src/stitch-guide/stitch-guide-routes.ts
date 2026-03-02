import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { StitchGuideService } from "./stitch-guide-service.js";
import {
  parseStitchGuideRequestSchema,
  imageMediaTypes,
} from "./schemas.js";

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
    let materials;

    if ((imageMediaTypes as readonly string[]).includes(mediaType)) {
      // Direct image — send to Claude as-is
      materials = await service.parseImage(
        file,
        mediaType as "image/jpeg" | "image/png" | "image/webp"
      );
    } else {
      // Document (PDF/Office) — convert to images first
      // TODO: Task 5 will implement document conversion
      return c.json({ error: "Document conversion not yet implemented" }, 501);
    }

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
