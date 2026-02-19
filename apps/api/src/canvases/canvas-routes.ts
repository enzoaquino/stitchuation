import { Hono } from "hono";
import { z } from "zod";
import { CanvasService } from "./canvas-service.js";
import { createCanvasSchema, updateCanvasSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";
import { getStorage } from "../storage/index.js";

const canvasRoutes = new Hono<AuthEnv>();
const canvasService = new CanvasService();
const uuidSchema = z.string().uuid();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);

function hasValidMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // HEIC: check for 'ftyp' box at offset 4
  if (buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") return true;
  }
  return false;
}

canvasRoutes.use("/*", authMiddleware);

canvasRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const canvases = await canvasService.listByUser(userId);
  return c.json(canvases);
});

canvasRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }
  return c.json(canvas);
});

canvasRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const canvas = await canvasService.create(userId, parsed.data);
  return c.json(canvas, 201);
});

canvasRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const canvas = await canvasService.update(userId, idResult.data, parsed.data);
    return c.json(canvas);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

canvasRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  try {
    await canvasService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

canvasRoutes.post("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("image");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No image file provided" }, 400);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return c.json({ error: "Image must be under 10MB" }, 400);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: "Image must be JPEG, PNG, or HEIC" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasValidMagicBytes(buffer)) {
    return c.json({ error: "File content does not match an allowed image format" }, 400);
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `canvases/${userId}/${idResult.data}.${ext}`;

  const storage = getStorage();

  // Delete old image if exists
  if (canvas.imageKey) {
    await storage.delete(canvas.imageKey);
  }

  await storage.upload(buffer, key);
  const updated = await canvasService.setImageKey(userId, idResult.data, key);

  return c.json(updated);
});

canvasRoutes.delete("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid canvas ID" }, 400);
  }

  const canvas = await canvasService.getById(userId, idResult.data);
  if (!canvas) {
    return c.json({ error: "Canvas not found" }, 404);
  }

  if (canvas.imageKey) {
    const storage = getStorage();
    await storage.delete(canvas.imageKey);
  }

  const updated = await canvasService.setImageKey(userId, idResult.data, null);
  return c.json(updated);
});

export { canvasRoutes };
