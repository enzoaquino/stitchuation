import { Hono } from "hono";
import { authRoutes } from "./auth/auth-routes.js";
import { threadRoutes } from "./threads/thread-routes.js";
import { syncRoutes } from "./sync/sync-routes.js";
import { pieceRoutes } from "./pieces/piece-routes.js";
import { imageRoutes } from "./storage/image-routes.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);
app.route("/threads", threadRoutes);
app.route("/sync", syncRoutes);
app.route("/pieces", pieceRoutes);
app.route("/images", imageRoutes);

export default app;
