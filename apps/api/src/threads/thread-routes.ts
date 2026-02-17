import { Hono } from "hono";
import { ThreadService } from "./thread-service.js";
import { createThreadSchema, updateThreadSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";

const threadRoutes = new Hono();
const threadService = new ThreadService();

threadRoutes.use("/*", authMiddleware);

threadRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const threads = await threadService.listByUser(userId);
  return c.json(threads);
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
  const id = c.req.param("id");

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
    const thread = await threadService.update(userId, id, parsed.data);
    return c.json(thread);
  } catch {
    return c.json({ error: "Thread not found" }, 404);
  }
});

threadRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  try {
    await threadService.softDelete(userId, id);
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Thread not found" }, 404);
  }
});

export { threadRoutes };
