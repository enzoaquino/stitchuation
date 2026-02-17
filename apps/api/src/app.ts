import { Hono } from "hono";
import { authRoutes } from "./auth/auth-routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);

export default app;
