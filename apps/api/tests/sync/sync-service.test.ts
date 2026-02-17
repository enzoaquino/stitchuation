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
});
