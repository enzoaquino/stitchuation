import { describe, it, expect, beforeAll } from "vitest";
import { MaterialService } from "../../src/pieces/material-service.js";
import { PieceService } from "../../src/pieces/piece-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("MaterialService", () => {
  let materialService: MaterialService;
  let pieceService: PieceService;
  let userId: string;
  let pieceId: string;

  beforeAll(async () => {
    materialService = new MaterialService();
    pieceService = new PieceService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `material-svc-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Material Tester",
    });
    userId = user.id;
    const piece = await pieceService.create(userId, {
      designer: "Test Designer",
      designName: "Test Canvas",
    });
    pieceId = piece.id;
  });

  it("creates material with minimal fields", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Basic Thread",
    });

    expect(material.id).toBeDefined();
    expect(material.pieceId).toBe(pieceId);
    expect(material.userId).toBe(userId);
    expect(material.name).toBe("Basic Thread");
    expect(material.materialType).toBe("other");
    expect(material.quantity).toBe(1);
    expect(material.acquired).toBe(0);
    expect(material.sortOrder).toBe(0);
    expect(material.brand).toBeNull();
    expect(material.code).toBeNull();
    expect(material.unit).toBeNull();
    expect(material.notes).toBeNull();
    expect(material.deletedAt).toBeNull();
  });

  it("creates material with all fields", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "DMC Floss",
      materialType: "thread",
      brand: "DMC",
      code: "310",
      quantity: 3,
      unit: "skeins",
      notes: "Black thread for outline",
      acquired: true,
      sortOrder: 5,
    });

    expect(material.name).toBe("DMC Floss");
    expect(material.materialType).toBe("thread");
    expect(material.brand).toBe("DMC");
    expect(material.code).toBe("310");
    expect(material.quantity).toBe(3);
    expect(material.unit).toBe("skeins");
    expect(material.notes).toBe("Black thread for outline");
    expect(material.acquired).toBe(1);
    expect(material.sortOrder).toBe(5);
  });

  it("creates material with client-provided ID", async () => {
    const clientId = crypto.randomUUID();
    const material = await materialService.create(userId, pieceId, {
      id: clientId,
      name: "Client ID Thread",
    });

    expect(material.id).toBe(clientId);
  });

  it("lists materials excluding soft-deleted", async () => {
    const piece = await pieceService.create(userId, {
      designer: "List Designer",
      designName: "List Canvas",
    });

    const m1 = await materialService.create(userId, piece.id, {
      name: "Keep Me",
    });
    const m2 = await materialService.create(userId, piece.id, {
      name: "Delete Me",
    });

    await materialService.softDelete(userId, m2.id);

    const materials = await materialService.list(userId, piece.id);
    const ids = materials.map((m) => m.id);
    expect(ids).toContain(m1.id);
    expect(ids).not.toContain(m2.id);
  });

  it("lists materials ordered by sortOrder", async () => {
    const piece = await pieceService.create(userId, {
      designer: "Sort Designer",
      designName: "Sort Canvas",
    });

    await materialService.create(userId, piece.id, {
      name: "Third",
      sortOrder: 2,
    });
    await materialService.create(userId, piece.id, {
      name: "First",
      sortOrder: 0,
    });
    await materialService.create(userId, piece.id, {
      name: "Second",
      sortOrder: 1,
    });

    const materials = await materialService.list(userId, piece.id);
    expect(materials.length).toBe(3);
    expect(materials[0].name).toBe("First");
    expect(materials[1].name).toBe("Second");
    expect(materials[2].name).toBe("Third");
  });

  it("gets material by ID", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Get By ID",
    });

    const fetched = await materialService.getById(userId, material.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(material.id);
    expect(fetched!.name).toBe("Get By ID");
  });

  it("returns null for non-existent material", async () => {
    const fetched = await materialService.getById(userId, crypto.randomUUID());
    expect(fetched).toBeNull();
  });

  it("updates a material including acquired toggle", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "Update Me",
      acquired: false,
    });
    expect(material.acquired).toBe(0);

    const updated = await materialService.update(userId, material.id, {
      name: "Updated Name",
      acquired: true,
    });

    expect(updated.name).toBe("Updated Name");
    expect(updated.acquired).toBe(1);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      material.updatedAt.getTime(),
    );
  });

  it("soft deletes a material", async () => {
    const material = await materialService.create(userId, pieceId, {
      name: "To Delete",
    });

    const deleted = await materialService.softDelete(userId, material.id);
    expect(deleted.deletedAt).toBeDefined();
    expect(deleted.deletedAt).not.toBeNull();

    const fetched = await materialService.getById(userId, material.id);
    expect(fetched).toBeNull();
  });

  it("throws NotFoundError when updating non-existent material", async () => {
    try {
      await materialService.update(userId, crypto.randomUUID(), {
        name: "nope",
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("throws NotFoundError when deleting non-existent material", async () => {
    try {
      await materialService.softDelete(userId, crypto.randomUUID());
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("batch creates materials", async () => {
    const piece = await pieceService.create(userId, {
      designer: "Batch Designer",
      designName: "Batch Canvas",
    });

    const items = [
      { name: "Batch Thread 1", materialType: "thread" as const, sortOrder: 0 },
      { name: "Batch Bead 1", materialType: "bead" as const, acquired: true, sortOrder: 1 },
      { name: "Batch Other", sortOrder: 2 },
    ];

    const created = await materialService.batchCreate(userId, piece.id, items);

    expect(created.length).toBe(3);
    expect(created[0].name).toBe("Batch Thread 1");
    expect(created[0].materialType).toBe("thread");
    expect(created[1].name).toBe("Batch Bead 1");
    expect(created[1].acquired).toBe(1);
    expect(created[2].name).toBe("Batch Other");
    expect(created[2].materialType).toBe("other");

    // Verify all are associated to the piece
    const materials = await materialService.list(userId, piece.id);
    expect(materials.length).toBe(3);
  });
});
