import { Hono } from "hono";
import { ProjectService } from "./project-service.js";
import { createProjectSchema, uuidSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const projectRoutes = new Hono<AuthEnv>();
const projectService = new ProjectService();

projectRoutes.use("/*", authMiddleware);

projectRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const projects = await projectService.listByUser(userId);
  return c.json(projects);
});

projectRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const project = await projectService.getById(userId, idResult.data);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }
  return c.json(project);
});

projectRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const project = await projectService.create(userId, parsed.data);
    return c.json(project, 201);
  } catch (error: unknown) {
    // PostgreSQL unique violation — Drizzle wraps in DrizzleQueryError with cause
    const pgError =
      error instanceof Error && "cause" in error ? (error as { cause: unknown }).cause : error;
    if (
      typeof pgError === "object" &&
      pgError !== null &&
      "code" in pgError &&
      (pgError as { code: string }).code === "23505"
    ) {
      return c.json({ error: "A project already exists for this canvas" }, 400);
    }
    throw error;
  }
});

projectRoutes.put("/:id/status", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  try {
    const project = await projectService.advanceStatus(userId, idResult.data);
    return c.json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof Error && error.message === "Project is already completed") {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

projectRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  try {
    await projectService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { projectRoutes };
