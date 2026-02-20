import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";
import { ProjectService } from "../../src/projects/project-service.js";
import { JournalService } from "../../src/projects/journal-service.js";
import { getStorage } from "../../src/storage/index.js";

describe("SyncService", () => {
  let syncService: SyncService;
  let threadService: ThreadService;
  let canvasService: CanvasService;
  let projectService: ProjectService;
  let journalService: JournalService;
  let userId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    threadService = new ThreadService();
    canvasService = new CanvasService();
    projectService = new ProjectService();
    journalService = new JournalService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `sync-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Sync Tester",
    });
    userId = user.id;
  });

  it("pushes new threads from client", async () => {
    const threadId = crypto.randomUUID();
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: threadId,
          data: {
            brand: "DMC",
            number: "310",
            colorName: "Black",
            fiberType: "cotton",
            quantity: 3,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.serverTimestamp).toBeDefined();

    const thread = await threadService.getById(userId, threadId);
    expect(thread?.brand).toBe("DMC");
  });

  it("pulls server changes since lastSync", async () => {
    const before = new Date(Date.now() - 1000).toISOString();

    await threadService.create(userId, {
      brand: "Appleton",
      number: "500",
      quantity: 2,
    });

    const result = await syncService.sync(userId, {
      lastSync: before,
      changes: [],
    });

    expect(result.changes.length).toBeGreaterThan(0);
    const appleton = result.changes.find(
      (c: any) => c.data?.brand === "Appleton" && c.data?.number === "500"
    );
    expect(appleton).toBeDefined();
  });

  it("resolves conflicts with last-write-wins (server newer wins)", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "666",
      quantity: 1,
    });

    // Server updates the thread to quantity 10
    await threadService.update(userId, thread.id, { quantity: 10 });

    // Client sends an OLDER update (quantity 5)
    const olderTimestamp = new Date(Date.now() - 60000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: thread.id,
          data: { quantity: 5 },
          updatedAt: olderTimestamp,
        },
      ],
    });

    // Server version (quantity 10) should win
    const serverThread = await threadService.getById(userId, thread.id);
    expect(serverThread?.quantity).toBe(10);
  });

  it("applies client change when client is newer", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "777",
      quantity: 1,
    });

    // Client sends a NEWER update
    const newerTimestamp = new Date(Date.now() + 60000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: thread.id,
          data: { quantity: 20 },
          updatedAt: newerTimestamp,
        },
      ],
    });

    const serverThread = await threadService.getById(userId, thread.id);
    expect(serverThread?.quantity).toBe(20);
  });

  it("handles client delete via sync", async () => {
    const threadId = crypto.randomUUID();
    // First create via sync
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: threadId,
          data: {
            brand: "DMC",
            number: "DeleteMe",
            quantity: 1,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Now delete via sync
    const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "delete",
          id: threadId,
          updatedAt: deleteTimestamp,
          deletedAt: deleteTimestamp,
        },
      ],
    });

    const thread = await threadService.getById(userId, threadId);
    expect(thread).toBeNull();
  });

  it("server wins on equal timestamps (tie-breaking)", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "TieBreak",
      quantity: 1,
    });

    // Server updates to quantity 10
    await threadService.update(userId, thread.id, { quantity: 10 });

    // Fetch server's updatedAt and send client change with exact same timestamp
    const serverThread = await threadService.getById(userId, thread.id);
    const sameTimestamp = serverThread!.updatedAt.toISOString();

    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: thread.id,
          data: { quantity: 99 },
          updatedAt: sameTimestamp,
        },
      ],
    });

    const result = await threadService.getById(userId, thread.id);
    expect(result?.quantity).toBe(10); // Server wins on tie
  });

  it("prevents cross-user sync modification", async () => {
    // Create a thread for the main user
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "CrossUser",
      quantity: 5,
    });

    // Create a second user
    const authService = new AuthService();
    const { user: otherUser } = await authService.register({
      email: `sync-other-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Other User",
    });

    // Other user tries to modify the thread via sync
    const newerTimestamp = new Date(Date.now() + 60000).toISOString();
    await syncService.sync(otherUser.id, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: thread.id,
          data: { quantity: 999 },
          updatedAt: newerTimestamp,
        },
      ],
    });

    // Original thread should be unchanged
    const result = await threadService.getById(userId, thread.id);
    expect(result?.quantity).toBe(5);
  });

  it("ignores disallowed fields in sync data (column injection)", async () => {
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();

    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: threadId,
          data: {
            brand: "DMC",
            number: "Inject",
            quantity: 1,
            deletedAt: "2025-01-01T00:00:00Z",
            userId: "00000000-0000-0000-0000-000000000000",
          },
          updatedAt: now,
        },
      ],
    });

    // Thread should exist (deletedAt was ignored)
    const thread = await threadService.getById(userId, threadId);
    expect(thread).not.toBeNull();
    expect(thread?.brand).toBe("DMC");
  });

  it("does not leak userId in sync response data", async () => {
    await threadService.create(userId, {
      brand: "DMC",
      number: "LeakTest",
      quantity: 1,
    });

    const result = await syncService.sync(userId, {
      lastSync: new Date(Date.now() - 5000).toISOString(),
      changes: [],
    });

    const found = result.changes.find((c) => c.data?.number === "LeakTest");
    expect(found).toBeDefined();
    expect(found!.data).not.toHaveProperty("userId");
    expect(found!.data).not.toHaveProperty("createdAt");
    expect(found!.data).not.toHaveProperty("deletedAt");
    expect(found!.data).toHaveProperty("brand");
  });

  it("returns empty changes array for initial sync with no server data", async () => {
    // Create a fresh user with no data
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `sync-empty-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Empty Sync User",
    });

    const result = await syncService.sync(user.id, {
      lastSync: null,
      changes: [],
    });

    expect(result.serverTimestamp).toBeDefined();
    expect(result.changes).toEqual([]);
  });

  describe("canvas sync", () => {
    it("pushes new canvases from client", async () => {
      const canvasId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvasId,
            data: {
              designer: "Melissa Shirley",
              designName: "Nutcracker",
              size: "14x18",
              meshCount: 18,
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.serverTimestamp).toBeDefined();

      const canvas = await canvasService.getById(userId, canvasId);
      expect(canvas?.designer).toBe("Melissa Shirley");
      expect(canvas?.designName).toBe("Nutcracker");
      expect(canvas?.size).toBe("14x18");
      expect(canvas?.meshCount).toBe(18);
    });

    it("pulls canvas changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      await canvasService.create(userId, {
        designer: "Kirk & Bradley",
        designName: "SyncPull Test",
      });

      const result = await syncService.sync(userId, {
        lastSync: before,
        changes: [],
      });

      const found = result.changes.find(
        (c: any) => c.type === "canvas" && c.data?.designName === "SyncPull Test"
      );
      expect(found).toBeDefined();
      expect(found!.data?.designer).toBe("Kirk & Bradley");
    });

    it("applies client canvas change when client is newer", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Zecca",
        designName: "Pumpkin Sync",
      });

      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvas.id,
            data: { meshCount: 13 },
            updatedAt: newerTimestamp,
          },
        ],
      });

      const serverCanvas = await canvasService.getById(userId, canvas.id);
      expect(serverCanvas?.meshCount).toBe(13);
    });

    it("server wins on equal timestamps for canvas", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Lee",
        designName: "TieBreak Canvas",
      });

      await canvasService.update(userId, canvas.id, { notes: "server version" });

      const serverCanvas = await canvasService.getById(userId, canvas.id);
      const sameTimestamp = serverCanvas!.updatedAt.toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvas.id,
            data: { notes: "client version" },
            updatedAt: sameTimestamp,
          },
        ],
      });

      const result = await canvasService.getById(userId, canvas.id);
      expect(result?.notes).toBe("server version");
    });

    it("handles canvas delete via sync", async () => {
      const canvasId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvasId,
            data: {
              designer: "DeleteMe",
              designName: "Gone Canvas",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "delete",
            id: canvasId,
            updatedAt: deleteTimestamp,
            deletedAt: deleteTimestamp,
          },
        ],
      });

      const canvas = await canvasService.getById(userId, canvasId);
      expect(canvas).toBeNull();
    });

    it("ignores disallowed fields in canvas sync data", async () => {
      const canvasId = crypto.randomUUID();
      const now = new Date().toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvasId,
            data: {
              designer: "SafeDesigner",
              designName: "Safe Canvas",
              deletedAt: "2025-01-01T00:00:00Z",
              userId: "00000000-0000-0000-0000-000000000000",
            },
            updatedAt: now,
          },
        ],
      });

      const canvas = await canvasService.getById(userId, canvasId);
      expect(canvas).not.toBeNull();
      expect(canvas?.designer).toBe("SafeDesigner");
    });
  });

  describe("project sync", () => {
    it("pushes new projects from client", async () => {
      // Create a canvas first (projects require a canvasId)
      const canvas = await canvasService.create(userId, {
        designer: "Project Sync Designer",
        designName: "Project Sync Canvas",
      });

      const projectId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "project",
            action: "upsert",
            id: projectId,
            data: {
              canvasId: canvas.id,
              status: "wip",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.serverTimestamp).toBeDefined();

      const project = await projectService.getById(userId, projectId);
      expect(project).not.toBeNull();
      expect(project?.canvasId).toBe(canvas.id);
      expect(project?.status).toBe("wip");
    });

    it("pulls project changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      const canvas = await canvasService.create(userId, {
        designer: "Pull Project Designer",
        designName: "Pull Project Canvas",
      });

      const project = await projectService.create(userId, { canvasId: canvas.id });

      const result = await syncService.sync(userId, {
        lastSync: before,
        changes: [],
      });

      const found = result.changes.find(
        (c: any) => c.type === "project" && c.id === project.id
      );
      expect(found).toBeDefined();
      expect(found!.data?.canvasId).toBe(canvas.id);
      expect(found!.data?.status).toBe("wip");
    });

    it("applies client project update when client is newer", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Update Sync Designer",
        designName: "Update Sync Canvas",
      });

      const project = await projectService.create(userId, { canvasId: canvas.id });

      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "project",
            action: "upsert",
            id: project.id,
            data: { status: "at_finishing" },
            updatedAt: newerTimestamp,
          },
        ],
      });

      const serverProject = await projectService.getById(userId, project.id);
      expect(serverProject?.status).toBe("at_finishing");
    });

    it("handles project delete via sync", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Delete Sync Designer",
        designName: "Delete Sync Canvas",
      });

      const projectId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "project",
            action: "upsert",
            id: projectId,
            data: {
              canvasId: canvas.id,
              status: "wip",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "project",
            action: "delete",
            id: projectId,
            updatedAt: deleteTimestamp,
            deletedAt: deleteTimestamp,
          },
        ],
      });

      const project = await projectService.getById(userId, projectId);
      expect(project).toBeNull();
    });
  });

  describe("journalEntry sync", () => {
    it("pushes new journal entries from client", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Journal Sync Designer",
        designName: "Journal Sync Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });

      const entryId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: {
              projectId: project.id,
              notes: "Started stitching the border",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.serverTimestamp).toBeDefined();

      const entry = await journalService.getEntry(userId, entryId);
      expect(entry).not.toBeNull();
      expect(entry?.projectId).toBe(project.id);
      expect(entry?.notes).toBe("Started stitching the border");
    });

    it("pulls journal entry changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      const canvas = await canvasService.create(userId, {
        designer: "Pull Entry Designer",
        designName: "Pull Entry Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Pull test entry",
      });

      const result = await syncService.sync(userId, {
        lastSync: before,
        changes: [],
      });

      const found = result.changes.find(
        (c: any) => c.type === "journalEntry" && c.id === entry.id
      );
      expect(found).toBeDefined();
      expect(found!.data?.notes).toBe("Pull test entry");
      expect(found!.data?.projectId).toBe(project.id);
    });

    it("applies client journal entry update when client is newer", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Update Entry Designer",
        designName: "Update Entry Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Original notes",
      });

      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "upsert",
            id: entry.id,
            data: { notes: "Updated notes from client" },
            updatedAt: newerTimestamp,
          },
        ],
      });

      const serverEntry = await journalService.getEntry(userId, entry.id);
      expect(serverEntry?.notes).toBe("Updated notes from client");
    });

    it("handles journal entry delete via sync", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Delete Entry Designer",
        designName: "Delete Entry Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });

      const entryId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: {
              projectId: project.id,
              notes: "Entry to delete",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "delete",
            id: entryId,
            updatedAt: deleteTimestamp,
            deletedAt: deleteTimestamp,
          },
        ],
      });

      const entry = await journalService.getEntry(userId, entryId);
      expect(entry).toBeNull();
    });
  });

  describe("journalImage sync", () => {
    it("pushes new journal images from client", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Image Sync Designer",
        designName: "Image Sync Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Entry for image sync",
      });

      const imageId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalImage",
            action: "upsert",
            id: imageId,
            data: {
              entryId: entry.id,
              imageKey: "uploads/progress-photo-1.jpg",
              sortOrder: 0,
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.serverTimestamp).toBeDefined();

      const images = await journalService.listImages(entry.id);
      const found = images.find((i) => i.id === imageId);
      expect(found).not.toBeNull();
      expect(found?.imageKey).toBe("uploads/progress-photo-1.jpg");
      expect(found?.sortOrder).toBe(0);
    });

    it("pulls journal image changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      const canvas = await canvasService.create(userId, {
        designer: "Pull Image Designer",
        designName: "Pull Image Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Entry for pull image test",
      });
      const image = await journalService.addImage(entry.id, "uploads/pull-test.jpg", 1);

      const result = await syncService.sync(userId, {
        lastSync: before,
        changes: [],
      });

      const found = result.changes.find(
        (c: any) => c.type === "journalImage" && c.id === image.id
      );
      expect(found).toBeDefined();
      expect(found!.data?.imageKey).toBe("uploads/pull-test.jpg");
      expect(found!.data?.sortOrder).toBe(1);
      expect(found!.data?.entryId).toBe(entry.id);
    });

    it("applies client journal image update when client is newer", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Update Image Designer",
        designName: "Update Image Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Entry for image update test",
      });
      const image = await journalService.addImage(entry.id, "uploads/original.jpg", 0);

      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalImage",
            action: "upsert",
            id: image.id,
            data: { sortOrder: 5 },
            updatedAt: newerTimestamp,
          },
        ],
      });

      const images = await journalService.listImages(entry.id);
      const updated = images.find((i) => i.id === image.id);
      expect(updated?.sortOrder).toBe(5);
    });

    it("prevents cross-user journal image modification via sync", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "CrossUser Image Designer",
        designName: "CrossUser Image Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Entry for cross-user image test",
      });
      const image = await journalService.addImage(entry.id, "uploads/protected.jpg", 0);

      // Create another user
      const authService = new AuthService();
      const { user: otherUser } = await authService.register({
        email: `sync-cross-img-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Cross User Image",
      });

      // Other user tries to modify the image via sync
      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(otherUser.id, {
        lastSync: null,
        changes: [
          {
            type: "journalImage",
            action: "upsert",
            id: image.id,
            data: { sortOrder: 99, imageKey: "uploads/hacked.jpg" },
            updatedAt: newerTimestamp,
          },
        ],
      });

      // Original image should be unchanged
      const images = await journalService.listImages(entry.id);
      const found = images.find((i) => i.id === image.id);
      expect(found?.imageKey).toBe("uploads/protected.jpg");
      expect(found?.sortOrder).toBe(0);
    });

    it("handles journal image delete via sync", async () => {
      const canvas = await canvasService.create(userId, {
        designer: "Delete Image Designer",
        designName: "Delete Image Canvas",
      });
      const project = await projectService.create(userId, { canvasId: canvas.id });
      const entry = await journalService.createEntry(userId, project.id, {
        notes: "Entry for image delete test",
      });

      const imageId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalImage",
            action: "upsert",
            id: imageId,
            data: {
              entryId: entry.id,
              imageKey: "uploads/delete-me.jpg",
              sortOrder: 0,
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalImage",
            action: "delete",
            id: imageId,
            updatedAt: deleteTimestamp,
            deletedAt: deleteTimestamp,
          },
        ],
      });

      const images = await journalService.listImages(entry.id);
      const found = images.find((i) => i.id === imageId);
      expect(found).toBeUndefined();
    });
  });

  describe("image cleanup on soft-delete", () => {
    it("deletes canvas image file on soft-delete via sync", async () => {
      const storage = getStorage();

      // Create canvas via sync
      const canvasId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [{
          type: "canvas",
          action: "upsert",
          id: canvasId,
          data: {
            designer: "Delete Test",
            designName: "Delete Canvas",
            imageKey: `canvases/${userId}/${canvasId}.jpg`,
          },
          updatedAt: new Date().toISOString(),
        }],
      });

      // Upload a fake image file
      await storage.upload(Buffer.from([0xff, 0xd8]), `canvases/${userId}/${canvasId}.jpg`);

      // Verify file exists
      const fileBefore = await storage.getFilePath(`canvases/${userId}/${canvasId}.jpg`);
      expect(fileBefore).not.toBeNull();

      // Delete canvas via sync
      const deleteTime = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [{
          type: "canvas",
          action: "delete",
          id: canvasId,
          updatedAt: deleteTime,
          deletedAt: deleteTime,
        }],
      });

      // Verify file is deleted
      const fileAfter = await storage.getFilePath(`canvases/${userId}/${canvasId}.jpg`);
      expect(fileAfter).toBeNull();
    });

    it("deletes journal image file on soft-delete via sync", async () => {
      const storage = getStorage();

      // Create canvas, project, entry, and image via sync
      const canvasId = crypto.randomUUID();
      const projectId = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      const imageId = crypto.randomUUID();
      const now = new Date().toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "canvas",
            action: "upsert",
            id: canvasId,
            data: { designer: "JI Delete", designName: "JI Canvas" },
            updatedAt: now,
          },
          {
            type: "project",
            action: "upsert",
            id: projectId,
            data: { canvasId, status: "wip" },
            updatedAt: now,
          },
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: { projectId, notes: "test" },
            updatedAt: now,
          },
          {
            type: "journalImage",
            action: "upsert",
            id: imageId,
            data: { entryId, imageKey: `journals/${userId}/${entryId}/${imageId}.jpg`, sortOrder: 0 },
            updatedAt: now,
          },
        ],
      });

      // Upload a fake image file
      await storage.upload(Buffer.from([0xff, 0xd8]), `journals/${userId}/${entryId}/${imageId}.jpg`);
      const fileBefore = await storage.getFilePath(`journals/${userId}/${entryId}/${imageId}.jpg`);
      expect(fileBefore).not.toBeNull();

      // Delete journal image via sync
      const deleteTime = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [{
          type: "journalImage",
          action: "delete",
          id: imageId,
          updatedAt: deleteTime,
          deletedAt: deleteTime,
        }],
      });

      // Verify file is deleted
      const fileAfter = await storage.getFilePath(`journals/${userId}/${entryId}/${imageId}.jpg`);
      expect(fileAfter).toBeNull();
    });
  });
});
