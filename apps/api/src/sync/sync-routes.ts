import { Hono } from "hono";
import { SyncService } from "./sync-service.js";
import { syncRequestSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";

const syncRoutes = new Hono<AuthEnv>();
const syncService = new SyncService();

syncRoutes.use("/*", authMiddleware);

syncRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await syncService.sync(userId, parsed.data);
    return c.json(result);
  } catch (error: any) {
    const pgCode = error.code ?? error.cause?.code;
    if (pgCode === "23514" || pgCode === "22P02") {
      // Check constraint or invalid enum value
      return c.json({ error: "Invalid thread data" }, 400);
    }
    throw error;
  }
});

export { syncRoutes };
