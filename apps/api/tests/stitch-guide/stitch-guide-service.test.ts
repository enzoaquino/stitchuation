import { describe, it, expect, vi, beforeEach } from "vitest";
import { StitchGuideService } from "../../src/stitch-guide/stitch-guide-service.js";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

describe("StitchGuideService", () => {
  let service: StitchGuideService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StitchGuideService();
  });

  it("sends image to Claude and returns parsed materials", async () => {
    const materials = [
      {
        materialType: "thread",
        brand: "Splendor",
        name: "Dark Olive Green",
        code: "S832",
        quantity: 2,
        unit: "Cards",
      },
    ];

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ materials }) }],
    });

    const result = await service.parseImage("base64data", "image/jpeg");

    expect(result).toEqual(materials);
    expect(mockCreate).toHaveBeenCalledOnce();

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-5-20250929");
    expect(callArgs.messages[0].role).toBe("user");

    // Should include an image content block
    const content = callArgs.messages[0].content;
    const imageBlock = content.find((b: any) => b.type === "image");
    expect(imageBlock).toBeDefined();
    expect(imageBlock.source.data).toBe("base64data");
    expect(imageBlock.source.media_type).toBe("image/jpeg");
  });

  it("sends multiple images for multi-page documents", async () => {
    const materials = [
      { materialType: "thread", name: "DMC 310", quantity: 1 },
    ];

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ materials }) }],
    });

    const images = [
      { data: "page1base64", mediaType: "image/png" as const },
      { data: "page2base64", mediaType: "image/png" as const },
    ];

    const result = await service.parseImages(images);

    expect(result).toEqual(materials);

    const content = mockCreate.mock.calls[0][0].messages[0].content;
    const imageBlocks = content.filter((b: any) => b.type === "image");
    expect(imageBlocks).toHaveLength(2);
  });

  it("returns empty array when Claude finds no materials", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ materials: [] }) }],
    });

    const result = await service.parseImage("base64data", "image/jpeg");
    expect(result).toEqual([]);
  });

  it("extracts JSON from markdown code fences", async () => {
    const materials = [
      { materialType: "thread", brand: "DMC", name: "Black", code: "310", quantity: 1, unit: "Skeins" },
    ];
    const wrapped = "Here are the materials:\n```json\n" + JSON.stringify({ materials }) + "\n```";

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: wrapped }],
    });

    const result = await service.parseImage("base64data", "image/jpeg");
    expect(result).toEqual(materials);
  });

  it("extracts JSON object from surrounding text", async () => {
    const materials = [
      { materialType: "bead", brand: "Sundance", name: "Gold", code: null, quantity: 1, unit: "Tubes" },
    ];
    const wrapped = "I found the following materials:\n" + JSON.stringify({ materials }) + "\nLet me know if you need anything else.";

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: wrapped }],
    });

    const result = await service.parseImage("base64data", "image/jpeg");
    expect(result).toEqual(materials);
  });

  it("throws on malformed Claude response (not JSON)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot parse this image" }],
    });

    await expect(service.parseImage("base64data", "image/jpeg")).rejects.toThrow();
  });

  it("throws on invalid materials schema from Claude", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            materials: [{ wrong: "shape" }],
          }),
        },
      ],
    });

    await expect(service.parseImage("base64data", "image/jpeg")).rejects.toThrow();
  });

  it("throws when Claude API call fails", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limited"));

    await expect(service.parseImage("base64data", "image/jpeg")).rejects.toThrow(
      "API rate limited"
    );
  });
});
