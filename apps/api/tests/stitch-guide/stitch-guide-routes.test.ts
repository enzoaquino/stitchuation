import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock the StitchGuideService — vi.hoisted ensures the fn is available when vi.mock is hoisted
const { mockParseImage } = vi.hoisted(() => ({
  mockParseImage: vi.fn(),
}));
vi.mock("../../src/stitch-guide/stitch-guide-service.js", () => ({
  StitchGuideService: class {
    parseImage = mockParseImage;
  },
}));

import app from "../../src/app.js";

describe("Stitch Guide Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const authRes = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `stitch-guide-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Guide Tester",
      }),
    });
    const authBody = await authRes.json();
    accessToken = authBody.accessToken;
  });

  // --- Auth ---

  it("returns 401 without auth token", async () => {
    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "aGVsbG8=", mediaType: "image/jpeg" }),
    });
    expect(res.status).toBe(401);
  });

  // --- Validation ---

  it("returns 400 for missing file field", async () => {
    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ mediaType: "image/jpeg" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty file string", async () => {
    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ file: "", mediaType: "image/jpeg" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported media type", async () => {
    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ file: "aGVsbG8=", mediaType: "text/plain" }),
    });
    expect(res.status).toBe(400);
  });

  // --- Success ---

  it("returns 200 with parsed materials on success", async () => {
    const materials = [
      {
        materialType: "thread",
        brand: "DMC",
        name: "Black",
        code: "310",
        quantity: 2,
        unit: "Skeins",
      },
    ];
    mockParseImage.mockResolvedValue(materials);

    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ file: "aGVsbG8=", mediaType: "image/jpeg" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materials).toEqual(materials);
  });

  // --- Empty results ---

  it("returns 422 when no materials found", async () => {
    mockParseImage.mockResolvedValue([]);

    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ file: "aGVsbG8=", mediaType: "image/jpeg" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  // --- Claude failure ---

  it("returns 500 when Claude API fails", async () => {
    mockParseImage.mockRejectedValue(new Error("API rate limited"));

    const res = await app.request("/stitch-guide/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ file: "aGVsbG8=", mediaType: "image/jpeg" }),
    });

    expect(res.status).toBe(500);
  });
});
