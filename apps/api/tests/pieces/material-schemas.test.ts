import { describe, it, expect } from "vitest";
import {
  createMaterialSchema,
  updateMaterialSchema,
  batchCreateMaterialsSchema,
  materialTypes,
} from "../../src/pieces/schemas.js";

describe("Material Schemas", () => {
  describe("createMaterialSchema", () => {
    it("accepts minimal valid input", () => {
      const result = createMaterialSchema.safeParse({ name: "Dark Green" });
      expect(result.success).toBe(true);
    });

    it("accepts full valid input", () => {
      const result = createMaterialSchema.safeParse({
        id: crypto.randomUUID(),
        materialType: "thread",
        brand: "Splendor",
        name: "Dark Green",
        code: "S832",
        quantity: 2,
        unit: "Card",
        notes: "for 18 ct",
        acquired: true,
        sortOrder: 3,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createMaterialSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid materialType", () => {
      const result = createMaterialSchema.safeParse({
        name: "Test",
        materialType: "fabric",
      });
      expect(result.success).toBe(false);
    });

    it("rejects quantity of 0", () => {
      const result = createMaterialSchema.safeParse({
        name: "Test",
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("defaults materialType to undefined when not provided", () => {
      const result = createMaterialSchema.safeParse({ name: "Needle" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.materialType).toBeUndefined();
      }
    });
  });

  describe("updateMaterialSchema", () => {
    it("accepts partial update", () => {
      const result = updateMaterialSchema.safeParse({ acquired: true });
      expect(result.success).toBe(true);
    });

    it("rejects empty update", () => {
      const result = updateMaterialSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("batchCreateMaterialsSchema", () => {
    it("accepts array of materials", () => {
      const result = batchCreateMaterialsSchema.safeParse([
        { name: "Dark Green", brand: "Splendor", code: "S832" },
        { name: "Antique Mauve", brand: "Flair", code: "F511" },
      ]);
      expect(result.success).toBe(true);
    });

    it("rejects more than 50 items", () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ name: `Item ${i}` }));
      const result = batchCreateMaterialsSchema.safeParse(items);
      expect(result.success).toBe(false);
    });

    it("rejects empty array", () => {
      const result = batchCreateMaterialsSchema.safeParse([]);
      expect(result.success).toBe(false);
    });
  });

  it("materialTypes has correct values", () => {
    expect(materialTypes).toEqual(["thread", "bead", "accessory", "other"]);
  });
});
