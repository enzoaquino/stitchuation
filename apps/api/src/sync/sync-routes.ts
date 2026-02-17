import { Hono } from "hono";
import { SyncService } from "./sync-service.js";
import { syncRequestSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";

const syncRoutes = new Hono();
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

  const result = await syncService.sync(userId, parsed.data);
  return c.json(result);
});

export { syncRoutes };
