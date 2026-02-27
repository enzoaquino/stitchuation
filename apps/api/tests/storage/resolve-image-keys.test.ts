import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetStorage } from "../../src/storage/index.js";
import {
  resolveImageKey,
  resolvePieceImageKeys,
  resolvePieceImageKeysArray,
} from "../../src/storage/resolve-image-keys.js";

describe("resolveImageKey utilities", () => {
  const originalStorageProvider = process.env.STORAGE_PROVIDER;

  beforeAll(() => {
    // Use local storage so resolveUrl returns key as-is
    process.env.STORAGE_PROVIDER = "local";
    resetStorage();
  });

  afterAll(() => {
    if (originalStorageProvider) {
      process.env.STORAGE_PROVIDER = originalStorageProvider;
    } else {
      delete process.env.STORAGE_PROVIDER;
    }
    resetStorage();
  });

  describe("resolveImageKey", () => {
    it("returns null for null input", () => {
      expect(resolveImageKey(null)).toBeNull();
    });

    it("returns the key via storage resolveUrl for non-null input", () => {
      // Local storage resolveUrl returns key as-is
      expect(resolveImageKey("pieces/user1/abc.jpg")).toBe("pieces/user1/abc.jpg");
    });
  });

  describe("resolvePieceImageKeys", () => {
    it("transforms imageKey on an object", () => {
      const piece = { id: "1", imageKey: "pieces/user1/abc.jpg", designer: "Test" };
      const result = resolvePieceImageKeys(piece);

      expect(result.imageKey).toBe("pieces/user1/abc.jpg");
      expect(result.id).toBe("1");
      expect(result.designer).toBe("Test");
    });

    it("preserves null imageKey", () => {
      const piece = { id: "2", imageKey: null };
      const result = resolvePieceImageKeys(piece);
      expect(result.imageKey).toBeNull();
    });

    it("returns a new object (does not mutate input)", () => {
      const piece = { id: "3", imageKey: "test.jpg" };
      const result = resolvePieceImageKeys(piece);
      expect(result).not.toBe(piece);
    });
  });

  describe("resolvePieceImageKeysArray", () => {
    it("transforms imageKey on each object in array", () => {
      const pieces = [
        { id: "1", imageKey: "a.jpg" },
        { id: "2", imageKey: null },
        { id: "3", imageKey: "b.jpg" },
      ];
      const result = resolvePieceImageKeysArray(pieces);

      expect(result).toHaveLength(3);
      expect(result[0].imageKey).toBe("a.jpg");
      expect(result[1].imageKey).toBeNull();
      expect(result[2].imageKey).toBe("b.jpg");
    });

    it("returns empty array for empty input", () => {
      expect(resolvePieceImageKeysArray([])).toEqual([]);
    });
  });
});
