import { describe, it, expect, beforeAll } from "vitest";
import { PieceService } from "../../src/pieces/piece-service.js";
import { AuthService } from "../../src/auth/auth-service.js";
import { NotFoundError } from "../../src/errors.js";

describe("PieceService", () => {
  let pieceService: PieceService;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    pieceService = new PieceService();
    const authService = new AuthService();

    const { user } = await authService.register({
      email: `piece-test-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Piece Tester",
    });
    userId = user.id;

    const { user: otherUser } = await authService.register({
      email: `piece-other-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Other User",
    });
    otherUserId = otherUser.id;
  });

  describe("create", () => {
    it("creates a piece with default stash status", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Melissa Shirley",
        designName: "Christmas Nutcracker",
      });

      expect(piece.id).toBeDefined();
      expect(piece.designer).toBe("Melissa Shirley");
      expect(piece.designName).toBe("Christmas Nutcracker");
      expect(piece.status).toBe("stash");
      expect(piece.imageKey).toBeNull();
    });

    it("creates a piece with a client-provided UUID", async () => {
      const clientId = crypto.randomUUID();
      const piece = await pieceService.create(userId, {
        id: clientId,
        designer: "Lee",
        designName: "Dragonfly",
      });

      expect(piece.id).toBe(clientId);
    });

    it("creates a piece with all optional fields", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Kirk & Bradley",
        designName: "Gingerbread House",
        status: "kitting",
        acquiredAt: "2025-12-25T00:00:00.000Z",
        size: "14x18",
        meshCount: 18,
        notes: "Gift from Mom",
      });

      expect(piece.status).toBe("kitting");
      expect(piece.size).toBe("14x18");
      expect(piece.meshCount).toBe(18);
      expect(piece.notes).toBe("Gift from Mom");
      expect(piece.acquiredAt).toBeDefined();
    });
  });

  describe("getById", () => {
    it("returns a piece by id", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Zecca",
        designName: "Pumpkin",
      });

      const fetched = await pieceService.getById(userId, piece.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.designer).toBe("Zecca");
    });

    it("returns null for another user's piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "DMC",
        designName: "Cross Stitch Kit",
      });

      const fetched = await pieceService.getById(otherUserId, piece.id);
      expect(fetched).toBeNull();
    });

    it("returns null for a soft-deleted piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "SoftDelGet",
        designName: "Deleted Piece",
      });

      await pieceService.softDelete(userId, piece.id);

      const fetched = await pieceService.getById(userId, piece.id);
      expect(fetched).toBeNull();
    });
  });

  describe("advanceStatus", () => {
    it("advances from stash to kitting and sets startedAt", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv1",
        designName: "Stash to Kitting",
      });

      const advanced = await pieceService.advanceStatus(userId, piece.id);
      expect(advanced.status).toBe("kitting");
      expect(advanced.startedAt).not.toBeNull();
    });

    it("advances from kitting to wip", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv2",
        designName: "Kitting to WIP",
        status: "kitting",
      });

      const advanced = await pieceService.advanceStatus(userId, piece.id);
      expect(advanced.status).toBe("wip");
    });

    it("advances from wip to stitched and sets stitchedAt", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv3",
        designName: "WIP to Stitched",
        status: "wip",
      });

      const advanced = await pieceService.advanceStatus(userId, piece.id);
      expect(advanced.status).toBe("stitched");
      expect(advanced.stitchedAt).not.toBeNull();
    });

    it("advances from stitched to at_finishing and sets finishingAt", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv4",
        designName: "Stitched to Finishing",
        status: "stitched",
      });

      const advanced = await pieceService.advanceStatus(userId, piece.id);
      expect(advanced.status).toBe("at_finishing");
      expect(advanced.finishingAt).not.toBeNull();
    });

    it("advances from at_finishing to finished and sets completedAt", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv5",
        designName: "Finishing to Finished",
        status: "at_finishing",
      });

      const advanced = await pieceService.advanceStatus(userId, piece.id);
      expect(advanced.status).toBe("finished");
      expect(advanced.completedAt).not.toBeNull();
    });

    it("throws when advancing a finished piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "Adv6",
        designName: "Already Finished",
        status: "finished",
      });

      try {
        await pieceService.advanceStatus(userId, piece.id);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("Piece is already finished");
      }
    });
  });

  describe("setStatus", () => {
    it("sets an arbitrary status for corrections", async () => {
      const piece = await pieceService.create(userId, {
        designer: "SetStatus",
        designName: "Correction Test",
      });

      const updated = await pieceService.setStatus(userId, piece.id, "wip");
      expect(updated.status).toBe("wip");
    });
  });

  describe("shelve", () => {
    it("returns piece to stash and clears timestamps", async () => {
      const piece = await pieceService.create(userId, {
        designer: "ShelveTest",
        designName: "Shelve Me",
      });

      // Advance to kitting first (sets startedAt)
      await pieceService.advanceStatus(userId, piece.id);
      // Advance to wip
      await pieceService.advanceStatus(userId, piece.id);

      const shelved = await pieceService.shelve(userId, piece.id);
      expect(shelved.status).toBe("stash");
      expect(shelved.startedAt).toBeNull();
      expect(shelved.stitchedAt).toBeNull();
      expect(shelved.finishingAt).toBeNull();
      expect(shelved.completedAt).toBeNull();
    });

    it("throws when shelving a piece already in stash", async () => {
      const piece = await pieceService.create(userId, {
        designer: "ShelveStash",
        designName: "Already Stash",
      });

      try {
        await pieceService.shelve(userId, piece.id);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toBe("Piece is already in stash");
      }
    });
  });

  describe("softDelete", () => {
    it("soft deletes a piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "DeleteTest",
        designName: "Delete Me",
      });

      const deleted = await pieceService.softDelete(userId, piece.id);
      expect(deleted.deletedAt).not.toBeNull();

      const fetched = await pieceService.getById(userId, piece.id);
      expect(fetched).toBeNull();
    });

    it("throws NotFoundError when deleting another user's piece", async () => {
      const piece = await pieceService.create(userId, {
        designer: "OtherDelete",
        designName: "Not Yours",
      });

      try {
        await pieceService.softDelete(otherUserId, piece.id);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundError);
      }
    });
  });
});
