import { Hono } from "hono";
import { z } from "zod";
import { CanvasService } from "./canvas-service.js";
import { createCanvasSchema, updateCanvasSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const canvasRoutes = new Hono<AuthEnv>();
const canvasService = new CanvasService();
const uuidSchema = z.string().uuid();

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

export { canvasRoutes };
