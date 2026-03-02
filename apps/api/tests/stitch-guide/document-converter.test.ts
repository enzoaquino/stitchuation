import { describe, it, expect, vi } from "vitest";
import { DocumentConverter } from "../../src/stitch-guide/document-converter.js";

describe("DocumentConverter", () => {
  const converter = new DocumentConverter();

  it("returns the original image data for image media types", async () => {
    const result = await converter.toImages("base64imagedata", "image/jpeg");
    expect(result).toEqual([
      { data: "base64imagedata", mediaType: "image/jpeg" },
    ]);
  });

  it("returns the original image for png", async () => {
    const result = await converter.toImages("pngdata", "image/png");
    expect(result).toEqual([{ data: "pngdata", mediaType: "image/png" }]);
  });

  it("returns the original image for webp", async () => {
    const result = await converter.toImages("webpdata", "image/webp");
    expect(result).toEqual([{ data: "webpdata", mediaType: "image/webp" }]);
  });

  it("caps PDF pages at MAX_PAGES", async () => {
    expect(DocumentConverter.MAX_PAGES).toBe(5);
  });
});
