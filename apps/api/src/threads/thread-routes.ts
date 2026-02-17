import { Hono } from "hono";
import { z } from "zod";
import { ThreadService } from "./thread-service.js";
import { createThreadSchema, updateThreadSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const threadRoutes = new Hono<AuthEnv>();
const threadService = new ThreadService();
const uuidSchema = z.string().uuid();

threadRoutes.use("/*", authMiddleware);

threadRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const threads = await threadService.listByUser(userId);
  return c.json(threads);
});

threadRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid thread ID" }, 400);
  }

  const thread = await threadService.getById(userId, idResult.data);
  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }
  return c.json(thread);
});

threadRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const thread = await threadService.create(userId, parsed.data);
  return c.json(thread, 201);
});

threadRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid thread ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateThreadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const thread = await threadService.update(userId, idResult.data, parsed.data);
    return c.json(thread);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

threadRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid thread ID" }, 400);
  }

  try {
    await threadService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { threadRoutes };
