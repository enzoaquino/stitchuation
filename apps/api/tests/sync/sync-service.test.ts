import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";
import { PieceService } from "../../src/pieces/piece-service.js";
import { JournalService } from "../../src/pieces/journal-service.js";
import { getStorage } from "../../src/storage/index.js";

describe("SyncService", () => {
  let syncService: SyncService;
  let threadService: ThreadService;
  let pieceService: PieceService;
  let journalService: JournalService;
  let userId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    threadService = new ThreadService();
    pieceService = new PieceService();
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

  describe("piece sync", () => {
    it("pushes new pieces from client", async () => {
      const pieceId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: pieceId,
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

      const piece = await pieceService.getById(userId, pieceId);
      expect(piece?.designer).toBe("Melissa Shirley");
      expect(piece?.designName).toBe("Nutcracker");
      expect(piece?.size).toBe("14x18");
      expect(piece?.meshCount).toBe(18);
      expect(piece?.status).toBe("stash"); // default status
    });

    it("pushes new piece with status from client", async () => {
      const pieceId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: pieceId,
            data: {
              designer: "Kirk & Bradley",
              designName: "WIP Piece",
              status: "wip",
              startedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      const piece = await pieceService.getById(userId, pieceId);
      expect(piece?.status).toBe("wip");
      expect(piece?.startedAt).not.toBeNull();
    });

    it("pulls piece changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      await pieceService.create(userId, {
        designer: "Kirk & Bradley",
        designName: "SyncPull Test",
      });

      const result = await syncService.sync(userId, {
        lastSync: before,
        changes: [],
      });

      const found = result.changes.find(
        (c: any) => c.type === "piece" && c.data?.designName === "SyncPull Test"
      );
      expect(found).toBeDefined();
      expect(found!.data?.designer).toBe("Kirk & Bradley");
      expect(found!.data?.status).toBe("stash");
    });

    it("applies client piece change when client is newer", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Zecca",
        designName: "Pumpkin Sync",
      });

      const newerTimestamp = new Date(Date.now() + 60000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: piece.id,
            data: { meshCount: 13 },
            updatedAt: newerTimestamp,
          },
        ],
      });

      const serverPiece = await pieceService.getById(userId, piece.id);
      expect(serverPiece?.meshCount).toBe(13);
    });

    it("server wins on equal timestamps for piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Lee",
        designName: "TieBreak Piece",
      });

      await pieceService.update(userId, piece.id, { notes: "server version" });

      const serverPiece = await pieceService.getById(userId, piece.id);
      const sameTimestamp = serverPiece!.updatedAt.toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: piece.id,
            data: { notes: "client version" },
            updatedAt: sameTimestamp,
          },
        ],
      });

      const result = await pieceService.getById(userId, piece.id);
      expect(result?.notes).toBe("server version");
    });

    it("handles piece delete via sync", async () => {
      const pieceId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: pieceId,
            data: {
              designer: "DeleteMe",
              designName: "Gone Piece",
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
            type: "piece",
            action: "delete",
            id: pieceId,
            updatedAt: deleteTimestamp,
            deletedAt: deleteTimestamp,
          },
        ],
      });

      const piece = await pieceService.getById(userId, pieceId);
      expect(piece).toBeNull();
    });

    it("ignores disallowed fields in piece sync data", async () => {
      const pieceId = crypto.randomUUID();
      const now = new Date().toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: pieceId,
            data: {
              designer: "SafeDesigner",
              designName: "Safe Piece",
              deletedAt: "2025-01-01T00:00:00Z",
              userId: "00000000-0000-0000-0000-000000000000",
            },
            updatedAt: now,
          },
        ],
      });

      const piece = await pieceService.getById(userId, pieceId);
      expect(piece).not.toBeNull();
      expect(piece?.designer).toBe("SafeDesigner");
    });
  });

  describe("journalEntry sync", () => {
    it("pushes new journal entries from client", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Journal Sync Designer",
        designName: "Journal Sync Piece",
        status: "wip",
      });

      const entryId = crypto.randomUUID();
      const result = await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: {
              pieceId: piece.id,
              notes: "Started stitching the border",
            },
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      expect(result.serverTimestamp).toBeDefined();

      const entry = await journalService.getEntry(userId, entryId);
      expect(entry).not.toBeNull();
      expect(entry?.pieceId).toBe(piece.id);
      expect(entry?.notes).toBe("Started stitching the border");
    });

    it("pulls journal entry changes since lastSync", async () => {
      const before = new Date(Date.now() - 1000).toISOString();

      const piece = await pieceService.create(userId, {
        designer: "Pull Entry Designer",
        designName: "Pull Entry Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
      expect(found!.data?.pieceId).toBe(piece.id);
    });

    it("applies client journal entry update when client is newer", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Update Entry Designer",
        designName: "Update Entry Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
      const piece = await pieceService.create(userId, {
        designer: "Delete Entry Designer",
        designName: "Delete Entry Piece",
        status: "wip",
      });

      const entryId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: {
              pieceId: piece.id,
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
      const piece = await pieceService.create(userId, {
        designer: "Image Sync Designer",
        designName: "Image Sync Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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

      const piece = await pieceService.create(userId, {
        designer: "Pull Image Designer",
        designName: "Pull Image Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
      const piece = await pieceService.create(userId, {
        designer: "Update Image Designer",
        designName: "Update Image Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
      const piece = await pieceService.create(userId, {
        designer: "CrossUser Image Designer",
        designName: "CrossUser Image Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
      const piece = await pieceService.create(userId, {
        designer: "Delete Image Designer",
        designName: "Delete Image Piece",
        status: "wip",
      });
      const entry = await journalService.createEntry(userId, piece.id, {
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
    it("deletes piece image file on soft-delete via sync", async () => {
      const storage = getStorage();

      // Create piece via sync
      const pieceId = crypto.randomUUID();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [{
          type: "piece",
          action: "upsert",
          id: pieceId,
          data: {
            designer: "Delete Test",
            designName: "Delete Piece",
            imageKey: `pieces/${userId}/${pieceId}.jpg`,
          },
          updatedAt: new Date().toISOString(),
        }],
      });

      // Upload a fake image file
      await storage.upload(Buffer.from([0xff, 0xd8]), `pieces/${userId}/${pieceId}.jpg`);

      // Verify file exists
      const fileBefore = await storage.getFilePath(`pieces/${userId}/${pieceId}.jpg`);
      expect(fileBefore).not.toBeNull();

      // Delete piece via sync
      const deleteTime = new Date(Date.now() + 1000).toISOString();
      await syncService.sync(userId, {
        lastSync: null,
        changes: [{
          type: "piece",
          action: "delete",
          id: pieceId,
          updatedAt: deleteTime,
          deletedAt: deleteTime,
        }],
      });

      // Verify file is deleted
      const fileAfter = await storage.getFilePath(`pieces/${userId}/${pieceId}.jpg`);
      expect(fileAfter).toBeNull();
    });

    it("deletes journal image file on soft-delete via sync", async () => {
      const storage = getStorage();

      // Create piece, entry, and image via sync
      const pieceId = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      const imageId = crypto.randomUUID();
      const now = new Date().toISOString();

      await syncService.sync(userId, {
        lastSync: null,
        changes: [
          {
            type: "piece",
            action: "upsert",
            id: pieceId,
            data: { designer: "JI Delete", designName: "JI Piece", status: "wip" },
            updatedAt: now,
          },
          {
            type: "journalEntry",
            action: "upsert",
            id: entryId,
            data: { pieceId, notes: "test" },
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
