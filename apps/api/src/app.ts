import { Hono } from "hono";
import { authRoutes } from "./auth/auth-routes.js";
import { threadRoutes } from "./threads/thread-routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);
app.route("/threads", threadRoutes);

export default app;
