import { describe, it, expect, beforeAll } from "vitest";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("CanvasService", () => {
  let canvasService: CanvasService;
  let userId: string;

  beforeAll(async () => {
    canvasService = new CanvasService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `canvas-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Canvas Tester",
    });
    userId = user.id;
  });

  it("creates and retrieves a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Melissa Shirley",
      designName: "Christmas Nutcracker",
    });

    expect(canvas.id).toBeDefined();
    expect(canvas.designer).toBe("Melissa Shirley");
    expect(canvas.designName).toBe("Christmas Nutcracker");
    expect(canvas.imageKey).toBeNull();

    const fetched = await canvasService.getById(userId, canvas.id);
    expect(fetched?.designer).toBe("Melissa Shirley");
  });

  it("creates a canvas with all optional fields", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Kirk & Bradley",
      designName: "Gingerbread House",
      acquiredAt: "2025-12-25T00:00:00.000Z",
      size: "14x18",
      meshCount: 18,
      notes: "Gift from Mom",
    });

    expect(canvas.size).toBe("14x18");
    expect(canvas.meshCount).toBe(18);
    expect(canvas.notes).toBe("Gift from Mom");
    expect(canvas.acquiredAt).toBeDefined();
  });

  it("creates a canvas with a client-provided UUID", async () => {
    const clientId = crypto.randomUUID();
    const canvas = await canvasService.create(userId, {
      id: clientId,
      designer: "Lee",
      designName: "Dragonfly",
    });

    expect(canvas.id).toBe(clientId);
  });

  it("lists canvases for a user ordered by createdAt desc", async () => {
    const canvases = await canvasService.listByUser(userId);
    expect(canvases.length).toBeGreaterThan(0);

    for (let i = 1; i < canvases.length; i++) {
      expect(canvases[i - 1].createdAt >= canvases[i].createdAt).toBe(true);
    }
  });

  it("updates a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Zecca",
      designName: "Pumpkin",
    });

    const updated = await canvasService.update(userId, canvas.id, {
      meshCount: 13,
      notes: "Started stitching",
    });

    expect(updated.meshCount).toBe(13);
    expect(updated.notes).toBe("Started stitching");
    expect(updated.designer).toBe("Zecca");
  });

  it("soft deletes a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Labors of Love",
      designName: "Snowflake",
    });

    await canvasService.softDelete(userId, canvas.id);

    const fetched = await canvasService.getById(userId, canvas.id);
    expect(fetched).toBeNull();
  });

  it("does not return soft-deleted canvases in list", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DeleteListTest",
      designName: "Test Canvas",
    });

    await canvasService.softDelete(userId, canvas.id);

    const canvases = await canvasService.listByUser(userId);
    const found = canvases.find((c) => c.id === canvas.id);
    expect(found).toBeUndefined();
  });

  it("rejects updating a soft-deleted canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "SoftDelUpdate",
      designName: "Test",
    });

    await canvasService.softDelete(userId, canvas.id);

    try {
      await canvasService.update(userId, canvas.id, { notes: "nope" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("prevents accessing another user's canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "DMC",
      designName: "Cross Stitch Kit",
    });

    const fetched = await canvasService.getById("00000000-0000-0000-0000-000000000000", canvas.id);
    expect(fetched).toBeNull();
  });

  it("prevents updating another user's canvas with NotFoundError", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "Another User Test",
      designName: "Forbidden Canvas",
    });

    try {
      await canvasService.update("00000000-0000-0000-0000-000000000000", canvas.id, { notes: "hacked" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).message).toBe("Canvas not found");
    }
  });

  it("updates imageKey on a canvas", async () => {
    const canvas = await canvasService.create(userId, {
      designer: "ImageTest",
      designName: "Test Image",
    });

    const withImage = await canvasService.setImageKey(userId, canvas.id, "canvases/test/image.jpg");
    expect(withImage.imageKey).toBe("canvases/test/image.jpg");

    const cleared = await canvasService.setImageKey(userId, canvas.id, null);
    expect(cleared.imageKey).toBeNull();
  });
});
