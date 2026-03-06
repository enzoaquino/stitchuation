import { describe, it, expect, beforeAll } from "vitest";
import { SyncService } from "../../src/sync/sync-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { PieceService } from "../../src/pieces/piece-service.js";
import { MaterialService } from "../../src/pieces/material-service.js";
import { ThreadService } from "../../src/threads/thread-service.js";

describe("SyncService — PieceMaterial", () => {
  let syncService: SyncService;
  let pieceService: PieceService;
  let materialService: MaterialService;
  let threadService: ThreadService;
  let userId: string;
  let pieceId: string;

  beforeAll(async () => {
    syncService = new SyncService();
    pieceService = new PieceService();
    materialService = new MaterialService();
    threadService = new ThreadService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `sync-material-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Sync Material Tester",
    });
    userId = user.id;
    const piece = await pieceService.create(userId, {
      designer: "Sync Test",
      designName: "Sync Canvas",
    });
    pieceId = piece.id;
  });

  it("pushes new material from client", async () => {
    const materialId = crypto.randomUUID();
    const result = await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            pieceId,
            materialType: "thread",
            brand: "DMC",
            name: "Black",
            code: "310",
            quantity: 2,
            unit: "skeins",
            acquired: false,
            sortOrder: 1,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.serverTimestamp).toBeDefined();

    const material = await materialService.getById(userId, materialId);
    expect(material).not.toBeNull();
    expect(material?.brand).toBe("DMC");
    expect(material?.name).toBe("Black");
    expect(material?.code).toBe("310");
    expect(material?.quantity).toBe(2);
    expect(material?.unit).toBe("skeins");
    expect(material?.acquired).toBe(0); // stored as integer in DB
    expect(material?.sortOrder).toBe(1);
    expect(material?.materialType).toBe("thread");
    expect(material?.pieceId).toBe(pieceId);
  });

  it("pulls material changes from server", async () => {
    const before = new Date(Date.now() - 1000).toISOString();

    const material = await materialService.create(userId, pieceId, {
      name: "Pull Test Material",
      materialType: "bead",
      brand: "Mill Hill",
      code: "00123",
      quantity: 5,
      unit: "packs",
      acquired: true,
      sortOrder: 3,
    });

    const result = await syncService.sync(userId, {
      lastSync: before,
      changes: [],
    });

    const found = result.changes.find(
      (c: any) => c.type === "pieceMaterial" && c.id === material.id,
    );
    expect(found).toBeDefined();
    expect(found!.data?.name).toBe("Pull Test Material");
    expect(found!.data?.materialType).toBe("bead");
    expect(found!.data?.brand).toBe("Mill Hill");
    expect(found!.data?.acquired).toBe(true); // boolean on wire
    expect(found!.data?.pieceId).toBe(pieceId);
  });

  it("updates existing material via sync", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Original Material",
      materialType: "thread",
      brand: "Appleton",
      quantity: 1,
    });

    const newerTimestamp = new Date(Date.now() + 60000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: material.id,
          data: {
            name: "Updated Material",
            quantity: 10,
            acquired: true,
          },
          updatedAt: newerTimestamp,
        },
      ],
    });

    const updated = await materialService.getById(userId, material.id);
    expect(updated?.name).toBe("Updated Material");
    expect(updated?.quantity).toBe(10);
    expect(updated?.acquired).toBe(1); // stored as integer
    expect(updated?.brand).toBe("Appleton"); // unchanged field preserved
  });

  it("soft deletes material via sync", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Delete Me Material",
      materialType: "accessory",
    });

    const deleteTimestamp = new Date(Date.now() + 1000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "delete",
          id: material.id,
          updatedAt: deleteTimestamp,
          deletedAt: deleteTimestamp,
        },
      ],
    });

    const deleted = await materialService.getById(userId, material.id);
    expect(deleted).toBeNull();
  });

  it("prevents re-parenting material via sync update", async () => {
    // Create a second piece
    const piece2 = await pieceService.create(userId, {
      designer: "Other Designer",
      designName: "Other Canvas",
    });

    const material = await materialService.create(userId, pieceId, {
      name: "No Reparent Material",
      materialType: "thread",
      brand: "DMC",
    });

    const newerTimestamp = new Date(Date.now() + 60000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: material.id,
          data: {
            pieceId: piece2.id,
            name: "Reparented Name",
          },
          updatedAt: newerTimestamp,
        },
      ],
    });

    const updated = await materialService.getById(userId, material.id);
    expect(updated?.pieceId).toBe(pieceId); // pieceId unchanged
    expect(updated?.name).toBe("Reparented Name"); // other fields updated
  });

  it("requires valid pieceId for new insert", async () => {
    const materialId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            pieceId: "not-a-valid-uuid",
            name: "Bad Piece Material",
            materialType: "thread",
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const material = await materialService.getById(userId, materialId);
    expect(material).toBeNull();
  });

  it("syncs threadId when pushing material with linked thread", async () => {
    // Create a thread via sync
    const threadId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "thread",
          action: "upsert",
          id: threadId,
          data: {
            brand: "DMC",
            number: "321",
            colorName: "Red",
            fiberType: "cotton",
            quantity: 2,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Push a material with threadId referencing the thread
    const materialId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            pieceId,
            threadId,
            materialType: "thread",
            brand: "DMC",
            name: "Red",
            code: "321",
            quantity: 2,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const material = await materialService.getById(userId, materialId);
    expect(material).not.toBeNull();
    expect(material?.threadId).toBe(threadId);
  });

  it("pulls threadId in sync response", async () => {
    const before = new Date(Date.now() - 1000).toISOString();

    // Create a thread
    const thread = await threadService.create(userId, {
      brand: "Appleton",
      number: "992",
      colorName: "Bright Yellow",
      quantity: 1,
    });

    // Create a material linked to the thread
    const materialId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            pieceId,
            threadId: thread.id,
            materialType: "thread",
            brand: "Appleton",
            name: "Bright Yellow",
            code: "992",
            quantity: 1,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Pull changes since before creation
    const result = await syncService.sync(userId, {
      lastSync: before,
      changes: [],
    });

    const found = result.changes.find(
      (c: any) => c.type === "pieceMaterial" && c.id === materialId,
    );
    expect(found).toBeDefined();
    expect(found!.data?.threadId).toBe(thread.id);
  });

  it("allows clearing threadId via sync update", async () => {
    // Create a thread
    const thread = await threadService.create(userId, {
      brand: "Silk Mori",
      number: "100",
      quantity: 3,
    });

    // Create a material with threadId
    const materialId = crypto.randomUUID();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            pieceId,
            threadId: thread.id,
            materialType: "thread",
            brand: "Silk Mori",
            name: "White",
            code: "100",
            quantity: 3,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Verify threadId is set
    const before = await materialService.getById(userId, materialId);
    expect(before?.threadId).toBe(thread.id);

    // Send an update with threadId: null to clear it
    const newerTimestamp = new Date(Date.now() + 60000).toISOString();
    await syncService.sync(userId, {
      lastSync: null,
      changes: [
        {
          type: "pieceMaterial",
          action: "upsert",
          id: materialId,
          data: {
            threadId: null,
          },
          updatedAt: newerTimestamp,
        },
      ],
    });

    const updated = await materialService.getById(userId, materialId);
    expect(updated?.threadId).toBeNull();
  });
});
