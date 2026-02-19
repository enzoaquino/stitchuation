import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";
import { CanvasService } from "../../src/canvases/canvas-service.js";

describe("SyncService", () => {
  let syncService: SyncService;
  let threadService: ThreadService;
  let canvasService: CanvasService;
  let userId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    threadService = new ThreadService();
    canvasService = new CanvasService();
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
});
