import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { getStorage } from "./index.js";

const imageRoutes = new Hono<AuthEnv>();

imageRoutes.use("/*", authMiddleware);

imageRoutes.get("/*", async (c) => {
  const key = c.req.path.replace("/images/", "");
  if (!key) {
    return c.json({ error: "Missing image key" }, 400);
  }

  const storage = getStorage();
  const filePath = await storage.getFilePath(key);

  if (!filePath) {
    return c.json({ error: "Image not found" }, 404);
  }

  const content = await readFile(filePath);
  const ext = key.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "png" ? "image/png" :
    ext === "heic" ? "image/heic" :
    "image/jpeg";

  return new Response(content, {
    headers: { "Content-Type": contentType },
  });
});

export { imageRoutes };
