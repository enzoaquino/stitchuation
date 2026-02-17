import { describe, it, expect, beforeAll } from "vitest";
import { ThreadService } from "../../src/threads/thread-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("ThreadService", () => {
  let threadService: ThreadService;
  let userId: string;

  beforeAll(async () => {
    threadService = new ThreadService();
    const authService = new AuthService();
    const { user } = await authService.register({
      email: `thread-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Thread Tester",
    });
    userId = user.id;
  });

  it("creates and retrieves a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "310",
      colorName: "Black",
      colorHex: "#000000",
      fiberType: "cotton",
      quantity: 3,
    });

    expect(thread.id).toBeDefined();
    expect(thread.brand).toBe("DMC");
    expect(thread.number).toBe("310");
    expect(thread.quantity).toBe(3);

    const fetched = await threadService.getById(userId, thread.id);
    expect(fetched?.brand).toBe("DMC");
  });

  it("lists threads for a user", async () => {
    // Create a thread to ensure list is not empty (independent of other tests)
    await threadService.create(userId, {
      brand: "ListTest",
      number: "001",
      quantity: 1,
    });

    const threads = await threadService.listByUser(userId);
    expect(threads.length).toBeGreaterThan(0);
  });

  it("updates a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "Appleton",
      number: "992",
      quantity: 1,
    });

    const updated = await threadService.update(userId, thread.id, {
      quantity: 5,
      colorName: "Sea Green",
    });

    expect(updated.quantity).toBe(5);
    expect(updated.colorName).toBe("Sea Green");
  });

  it("soft deletes a thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "Paternayan",
      number: "220",
      quantity: 2,
    });

    await threadService.softDelete(userId, thread.id);

    const fetched = await threadService.getById(userId, thread.id);
    expect(fetched).toBeNull();
  });

  it("does not return soft-deleted threads in list", async () => {
    const thread = await threadService.create(userId, {
      brand: "DeleteTest",
      number: "999",
      quantity: 1,
    });

    await threadService.softDelete(userId, thread.id);

    const threads = await threadService.listByUser(userId);
    const found = threads.find((t) => t.id === thread.id);
    expect(found).toBeUndefined();
  });

  it("rejects updating a soft-deleted thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "SoftDelUpdate",
      number: "555",
      quantity: 1,
    });

    await threadService.softDelete(userId, thread.id);

    try {
      await threadService.update(userId, thread.id, { quantity: 10 });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }
  });

  it("prevents accessing another user's thread", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "777",
      quantity: 1,
    });

    const fetched = await threadService.getById("00000000-0000-0000-0000-000000000000", thread.id);
    expect(fetched).toBeNull();
  });

  it("prevents updating another user's thread with NotFoundError", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "888",
      quantity: 1,
    });

    try {
      await threadService.update("00000000-0000-0000-0000-000000000000", thread.id, { quantity: 99 });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).message).toBe("Thread not found");
    }
  });

  it("creates a thread with a client-provided UUID", async () => {
    const clientId = crypto.randomUUID();
    const thread = await threadService.create(userId, {
      id: clientId,
      brand: "DMC",
      number: "444",
      quantity: 2,
    });

    expect(thread.id).toBe(clientId);
  });
});
