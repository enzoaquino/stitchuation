import { describe, it, expect, beforeAll } from "vitest";
import { JournalService } from "../../src/projects/journal-service.js";
import { ProjectService } from "../../src/projects/project-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("JournalService", () => {
  let journalService: JournalService;
  let projectService: ProjectService;
  let canvasService: CanvasService;
  let userId: string;
  let otherUserId: string;
  let projectId: string;

  beforeAll(async () => {
    journalService = new JournalService();
    projectService = new ProjectService();
    canvasService = new CanvasService();
    const authService = new AuthService();

    const { user } = await authService.register({
      email: `journal-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Journal Tester",
    });
    userId = user.id;

    const { user: otherUser } = await authService.register({
      email: `journal-other-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Other Journal User",
    });
    otherUserId = otherUser.id;

    const canvas = await canvasService.create(userId, {
      designer: "Journal Designer",
      designName: "Journal Canvas",
    });
    const project = await projectService.create(userId, { canvasId: canvas.id });
    projectId = project.id;
  });

  describe("entries", () => {
    it("creates a journal entry with notes", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Started stitching the border today.",
      });

      expect(entry.id).toBeDefined();
      expect(entry.projectId).toBe(projectId);
      expect(entry.userId).toBe(userId);
      expect(entry.notes).toBe("Started stitching the border today.");
      expect(entry.deletedAt).toBeNull();
    });

    it("creates a journal entry without notes", async () => {
      const entry = await journalService.createEntry(userId, projectId, {});

      expect(entry.id).toBeDefined();
      expect(entry.notes).toBeNull();
    });

    it("creates a journal entry with a client-provided UUID", async () => {
      const clientId = crypto.randomUUID();
      const entry = await journalService.createEntry(userId, projectId, {
        id: clientId,
        notes: "Client UUID entry",
      });

      expect(entry.id).toBe(clientId);
    });

    it("lists entries ordered by createdAt desc", async () => {
      const entries = await journalService.listEntries(userId, projectId);
      expect(entries.length).toBeGreaterThan(0);

      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1].createdAt >= entries[i].createdAt).toBe(true);
      }
    });

    it("isolates entries by user", async () => {
      const entries = await journalService.listEntries(otherUserId, projectId);
      expect(entries.length).toBe(0);
    });

    it("gets an entry by ID", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Get by ID test",
      });

      const fetched = await journalService.getEntry(userId, entry.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(entry.id);
      expect(fetched!.notes).toBe("Get by ID test");
    });

    it("returns null for non-existent entry", async () => {
      const fetched = await journalService.getEntry(userId, crypto.randomUUID());
      expect(fetched).toBeNull();
    });

    it("prevents accessing another user's entry", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Isolation test",
      });

      const fetched = await journalService.getEntry(otherUserId, entry.id);
      expect(fetched).toBeNull();
    });

    it("updates entry notes", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Original notes",
      });

      const updated = await journalService.updateEntry(userId, entry.id, {
        notes: "Updated notes",
      });

      expect(updated.notes).toBe("Updated notes");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(entry.updatedAt.getTime());
    });

    it("throws NotFoundError when updating non-existent entry", async () => {
      try {
        await journalService.updateEntry(userId, crypto.randomUUID(), {
          notes: "nope",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
      }
    });

    it("throws NotFoundError when updating another user's entry", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Other user update test",
      });

      try {
        await journalService.updateEntry(otherUserId, entry.id, {
          notes: "hacked",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
      }
    });

    it("soft deletes an entry", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "To be deleted",
      });

      const deleted = await journalService.softDeleteEntry(userId, entry.id);
      expect(deleted.deletedAt).toBeDefined();

      const fetched = await journalService.getEntry(userId, entry.id);
      expect(fetched).toBeNull();
    });

    it("throws NotFoundError when soft deleting non-existent entry", async () => {
      try {
        await journalService.softDeleteEntry(userId, crypto.randomUUID());
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
      }
    });

    it("does not list soft-deleted entries", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Delete list test",
      });

      await journalService.softDeleteEntry(userId, entry.id);

      const entries = await journalService.listEntries(userId, projectId);
      const found = entries.find((e) => e.id === entry.id);
      expect(found).toBeUndefined();
    });
  });

  describe("images", () => {
    it("adds an image to an entry", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Image test entry",
      });

      const image = await journalService.addImage(entry.id, "journal/img1.jpg", 0);

      expect(image.id).toBeDefined();
      expect(image.entryId).toBe(entry.id);
      expect(image.imageKey).toBe("journal/img1.jpg");
      expect(image.sortOrder).toBe(0);
      expect(image.deletedAt).toBeNull();
    });

    it("lists images ordered by sortOrder", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Image sort test",
      });

      await journalService.addImage(entry.id, "journal/c.jpg", 2);
      await journalService.addImage(entry.id, "journal/a.jpg", 0);
      await journalService.addImage(entry.id, "journal/b.jpg", 1);

      const images = await journalService.listImages(entry.id);
      expect(images.length).toBe(3);
      expect(images[0].imageKey).toBe("journal/a.jpg");
      expect(images[1].imageKey).toBe("journal/b.jpg");
      expect(images[2].imageKey).toBe("journal/c.jpg");
    });

    it("soft deletes an image", async () => {
      const entry = await journalService.createEntry(userId, projectId, {
        notes: "Image delete test",
      });

      const image = await journalService.addImage(entry.id, "journal/del.jpg", 0);
      const deleted = await journalService.softDeleteImage(image.id);
      expect(deleted.deletedAt).toBeDefined();

      const images = await journalService.listImages(entry.id);
      const found = images.find((i) => i.id === image.id);
      expect(found).toBeUndefined();
    });

    it("throws NotFoundError when soft deleting non-existent image", async () => {
      try {
        await journalService.softDeleteImage(crypto.randomUUID());
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
      }
    });
  });
});
