import { describe, it, expect } from "vitest";
import {
  parseStitchGuideRequestSchema,
  parsedMaterialSchema,
  parseStitchGuideResponseSchema,
} from "../../src/stitch-guide/schemas.js";

describe("parseStitchGuideRequestSchema", () => {
  it("accepts a valid image request", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "aGVsbG8=",
      mediaType: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PDF request", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "aGVsbG8=",
      mediaType: "application/pdf",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid DOCX request", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "aGVsbG8=",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid XLSX request", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "aGVsbG8=",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported media type", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "aGVsbG8=",
      mediaType: "text/plain",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing file", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      mediaType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty file string", () => {
    const result = parseStitchGuideRequestSchema.safeParse({
      file: "",
      mediaType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });
});

describe("parsedMaterialSchema", () => {
  it("accepts a valid material", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      brand: "DMC",
      name: "Black",
      code: "310",
      quantity: 2,
      unit: "Skeins",
    });
    expect(result.success).toBe(true);
  });

  it("accepts material with only required fields", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "other",
      name: "Unknown fiber",
    });
    expect(result.success).toBe(true);
  });

  it("defaults quantity to 1 when missing", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      name: "DMC 310",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(1);
    }
  });

  it("accepts ribbon materialType", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "ribbon",
      brand: "Treenway Silk",
      name: "Peach Phlox",
      quantity: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.materialType).toBe("ribbon");
    }
  });

  it("coerces unknown materialType to 'other'", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "fiber",
      name: "Silk ribbon",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.materialType).toBe("other");
    }
  });

  it("coerces numeric code to string", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      name: "Black",
      code: 310,
      quantity: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("310");
    }
  });

  it("falls back name to code when name is null", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      brand: "Silk Lame Braid",
      name: null,
      code: "LB94",
      quantity: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("LB94");
    }
  });

  it("falls back name to brand when both name and code are null", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      brand: "Silk Lame Braid",
      name: null,
      code: null,
      quantity: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Silk Lame Braid");
    }
  });

  it("coerces string quantity to number", () => {
    const result = parsedMaterialSchema.safeParse({
      materialType: "thread",
      name: "Black",
      quantity: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
    }
  });
});

describe("parseStitchGuideResponseSchema", () => {
  it("accepts a valid response with materials", () => {
    const result = parseStitchGuideResponseSchema.safeParse({
      materials: [
        { materialType: "thread", name: "DMC 310", quantity: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty materials array", () => {
    const result = parseStitchGuideResponseSchema.safeParse({
      materials: [],
    });
    expect(result.success).toBe(true);
  });
});
