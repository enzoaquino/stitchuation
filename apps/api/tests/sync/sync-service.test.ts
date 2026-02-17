import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";

describe("SyncService", () => {
  let syncService: SyncService;
  let threadService: ThreadService;
  let userId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    threadService = new ThreadService();
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
});
