import type { Context, Next } from "hono";
import { verifyAccessToken } from "./jwt.js";

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    c.set("userId", payload.userId);
    c.set("email", payload.email);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}
