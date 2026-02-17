import { Hono } from "hono";
import { AuthService } from "./auth-service.js";
import { registerSchema, loginSchema } from "./schemas.js";

const authRoutes = new Hono();
const authService = new AuthService();

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.register(parsed.data);
    return c.json(result, 201);
  } catch (error: any) {
    if (error.message?.includes("duplicate") || error.code === "23505") {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw error;
  }
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await authService.login(parsed.data);
    return c.json(result, 200);
  } catch (error: any) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
});

export { authRoutes };
