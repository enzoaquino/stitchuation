import { Hono } from "hono";
import { UserService } from "./user-service.js";
import { updateProfileSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const userRoutes = new Hono<AuthEnv>();
const userService = new UserService();

userRoutes.use("/*", authMiddleware);

userRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  try {
    const profile = await userService.getProfile(userId);
    return c.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

userRoutes.patch("/me", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const userId = c.get("userId");
  try {
    const profile = await userService.updateProfile(userId, parsed.data);
    return c.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { userRoutes };
