import { Hono } from "hono";
import { ProjectService } from "./project-service.js";
import { JournalService } from "./journal-service.js";
import {
  createProjectSchema,
  createJournalEntrySchema,
  updateJournalEntrySchema,
  uuidSchema,
} from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";
import { getStorage } from "../storage/index.js";

const projectRoutes = new Hono<AuthEnv>();
const projectService = new ProjectService();
const journalService = new JournalService();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);

function hasValidMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // HEIC: check for 'ftyp' box at offset 4
  if (buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") return true;
  }
  return false;
}

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

// --- Journal Entry Routes ---

projectRoutes.get("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const project = await projectService.getById(userId, idResult.data);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const entries = await journalService.listEntries(userId, idResult.data);
  return c.json(entries);
});

projectRoutes.post("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const project = await projectService.getById(userId, idResult.data);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const entry = await journalService.createEntry(userId, idResult.data, parsed.data);
  return c.json(entry, 201);
});

projectRoutes.put("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const entry = await journalService.updateEntry(userId, entryIdResult.data, parsed.data);
    return c.json(entry);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

projectRoutes.delete("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  try {
    await journalService.softDeleteEntry(userId, entryIdResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

// --- Journal Image Routes ---

projectRoutes.post("/:id/entries/:entryId/images", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid project ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  // Verify project exists and belongs to user
  const project = await projectService.getById(userId, idResult.data);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Verify entry exists and belongs to user
  const entry = await journalService.getEntry(userId, entryIdResult.data);
  if (!entry) {
    return c.json({ error: "Journal entry not found" }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get("image");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No image file provided" }, 400);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return c.json({ error: "Image must be under 10MB" }, 400);
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: "Image must be JPEG, PNG, or HEIC" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasValidMagicBytes(buffer)) {
    return c.json({ error: "File content does not match an allowed image format" }, 400);
  }

  // Auto-increment sortOrder based on existing image count
  const existingImages = await journalService.listImages(entryIdResult.data);
  const sortOrder = existingImages.length;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const imageId = crypto.randomUUID();
  const key = `journals/${userId}/${entryIdResult.data}/${imageId}.${ext}`;

  const storage = getStorage();
  await storage.upload(buffer, key);

  const image = await journalService.addImage(entryIdResult.data, key, sortOrder);
  return c.json(image, 201);
});

projectRoutes.delete("/:id/entries/:entryId/images/:imageId", async (c) => {
  const imageIdResult = uuidSchema.safeParse(c.req.param("imageId"));
  if (!imageIdResult.success) {
    return c.json({ error: "Invalid image ID" }, 400);
  }

  try {
    await journalService.softDeleteImage(imageIdResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { projectRoutes };
