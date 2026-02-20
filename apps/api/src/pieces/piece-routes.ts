import { Hono } from "hono";
import { PieceService } from "./piece-service.js";
import { JournalService } from "../projects/journal-service.js";
import {
  createPieceSchema,
  updatePieceSchema,
  setStatusSchema,
  createJournalEntrySchema,
  updateJournalEntrySchema,
  uuidSchema,
} from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";
import { getStorage } from "../storage/index.js";

const pieceRoutes = new Hono<AuthEnv>();
const pieceService = new PieceService();
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

pieceRoutes.use("/*", authMiddleware);

// --- Piece CRUD ---

pieceRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const pieces = await pieceService.listByUser(userId);
  return c.json(pieces);
});

pieceRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
  }
  return c.json(piece);
});

pieceRoutes.post("/", async (c) => {
  const userId = c.get("userId");

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = createPieceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const piece = await pieceService.create(userId, parsed.data);
  return c.json(piece, 201);
});

pieceRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updatePieceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const piece = await pieceService.update(userId, idResult.data, parsed.data);
    return c.json(piece);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

pieceRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  try {
    await pieceService.softDelete(userId, idResult.data);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

// --- Status Actions ---

pieceRoutes.put("/:id/status", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  try {
    const piece = await pieceService.advanceStatus(userId, idResult.data);
    return c.json(piece);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof Error && error.message === "Piece is already finished") {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

pieceRoutes.put("/:id/status/set", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = setStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const piece = await pieceService.setStatus(userId, idResult.data, parsed.data.status);
    return c.json(piece);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

pieceRoutes.put("/:id/shelve", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  try {
    const piece = await pieceService.shelve(userId, idResult.data);
    return c.json(piece);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof Error && error.message === "Piece is already in stash") {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

// --- Image Management ---

pieceRoutes.post("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
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

  const ext = file.type === "image/png" ? "png" : file.type === "image/heic" ? "heic" : "jpg";
  const key = `pieces/${userId}/${idResult.data}.${ext}`;

  const storage = getStorage();

  // Delete old image if exists
  if (piece.imageKey) {
    await storage.delete(piece.imageKey);
  }

  await storage.upload(buffer, key);
  const updated = await pieceService.setImageKey(userId, idResult.data, key);

  return c.json(updated);
});

pieceRoutes.delete("/:id/image", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
  }

  if (piece.imageKey) {
    const storage = getStorage();
    await storage.delete(piece.imageKey);
  }

  const updated = await pieceService.setImageKey(userId, idResult.data, null);
  return c.json(updated);
});

// --- Journal Entry Routes ---

pieceRoutes.get("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
  }

  const entries = await journalService.listEntries(userId, idResult.data);
  return c.json(entries);
});

pieceRoutes.post("/:id/entries", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
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

pieceRoutes.get("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
  }

  const entry = await journalService.getEntry(userId, entryIdResult.data);
  if (!entry) {
    return c.json({ error: "Journal entry not found" }, 404);
  }

  return c.json(entry);
});

pieceRoutes.put("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  // Verify piece belongs to user
  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
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

pieceRoutes.delete("/:id/entries/:entryId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  // Verify piece belongs to user
  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
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

pieceRoutes.post("/:id/entries/:entryId/images", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  // Verify piece exists and belongs to user
  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
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
  if (existingImages.length >= 4) {
    return c.json({ error: "Maximum 4 images per entry" }, 400);
  }
  const sortOrder = existingImages.length;

  const ext = file.type === "image/png" ? "png" : file.type === "image/heic" ? "heic" : "jpg";
  const imageId = crypto.randomUUID();
  const key = `journals/${userId}/${entryIdResult.data}/${imageId}.${ext}`;

  const storage = getStorage();
  await storage.upload(buffer, key);

  const image = await journalService.addImage(entryIdResult.data, key, sortOrder);
  return c.json(image, 201);
});

pieceRoutes.delete("/:id/entries/:entryId/images/:imageId", async (c) => {
  const userId = c.get("userId");
  const idResult = uuidSchema.safeParse(c.req.param("id"));
  if (!idResult.success) {
    return c.json({ error: "Invalid piece ID" }, 400);
  }

  const entryIdResult = uuidSchema.safeParse(c.req.param("entryId"));
  if (!entryIdResult.success) {
    return c.json({ error: "Invalid entry ID" }, 400);
  }

  const imageIdResult = uuidSchema.safeParse(c.req.param("imageId"));
  if (!imageIdResult.success) {
    return c.json({ error: "Invalid image ID" }, 400);
  }

  // Verify piece belongs to user
  const piece = await pieceService.getById(userId, idResult.data);
  if (!piece) {
    return c.json({ error: "Piece not found" }, 404);
  }

  // Verify entry belongs to user
  const entry = await journalService.getEntry(userId, entryIdResult.data);
  if (!entry) {
    return c.json({ error: "Journal entry not found" }, 404);
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

export { pieceRoutes };
