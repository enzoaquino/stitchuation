import { Hono } from "hono";
import { AuthService, AuthError } from "./auth-service.js";
import { registerSchema, loginSchema } from "./schemas.js";

const authRoutes = new Hono();
const authService = new AuthService();

authRoutes.post("/register", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.register(parsed.data);
    return c.json(result, 201);
  } catch (error: any) {
    const pgCode = error.code ?? error.cause?.code;
    if (pgCode === "23505") {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw error;
  }
});

authRoutes.post("/login", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.login(parsed.data);
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    throw error;
  }
});

export { authRoutes };
