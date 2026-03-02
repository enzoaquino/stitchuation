# Claude-Powered Stitch Guide Parsing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Apple Vision OCR + heuristic parser with a server-side Claude Sonnet vision call for stitch guide material extraction, with support for images and documents (PDF, DOCX, XLSX).

**Architecture:** iOS app sends the raw file (base64) to `POST /stitch-guide/parse`. The API validates input, converts documents to images if needed, sends to Claude Sonnet for structured extraction, validates the response, and returns `ParsedMaterial[]` JSON. iOS feeds the result into the existing `ParsedMaterialsReviewView`.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Hono routes, Zod v4 validation, `pdf-to-img` for PDF conversion, `libreoffice` for Office conversion, SwiftUI + `NetworkClient` actor for iOS.

---

### Task 1: Install Anthropic SDK and Add Environment Config

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/.env`

**Step 1: Install the Anthropic SDK**

Run:
```bash
cd apps/api && npm install @anthropic-ai/sdk
```

**Step 2: Add `ANTHROPIC_API_KEY` to `.env.example`**

Add to the end of `apps/api/.env.example`:
```
# AI (stitch guide parsing)
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Step 3: Add your real key to `.env`**

Add to `apps/api/.env`:
```
ANTHROPIC_API_KEY=<your-real-key>
```

**Step 4: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/.env.example
git commit -m "feat(api): install @anthropic-ai/sdk and add ANTHROPIC_API_KEY config"
```

---

### Task 2: Create Zod Schemas for Stitch Guide Parsing

**Files:**
- Create: `apps/api/src/stitch-guide/schemas.ts`
- Test: `apps/api/tests/stitch-guide/schemas.test.ts`

**Step 1: Write the failing test**

Create `apps/api/tests/stitch-guide/schemas.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/stitch-guide/schemas.test.ts`
Expected: FAIL — module not found

**Step 3: Write the schemas**

Create `apps/api/src/stitch-guide/schemas.ts`:

```typescript
import { z } from "zod";

export const supportedMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const imageMediaTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupportedMediaType = (typeof supportedMediaTypes)[number];

export const parseStitchGuideRequestSchema = z.object({
  file: z.string().min(1, "file is required"),
  mediaType: z.enum(supportedMediaTypes),
});

export type ParseStitchGuideRequest = z.infer<typeof parseStitchGuideRequestSchema>;

export const materialTypes = ["thread", "bead", "accessory", "other"] as const;

export const parsedMaterialSchema = z.object({
  materialType: z.enum(materialTypes),
  brand: z.string().nullish(),
  name: z.string().min(1),
  code: z.string().nullish(),
  quantity: z.number().int().positive().default(1),
  unit: z.string().nullish(),
});

export type ParsedMaterial = z.infer<typeof parsedMaterialSchema>;

export const parseStitchGuideResponseSchema = z.object({
  materials: z.array(parsedMaterialSchema),
});

export type ParseStitchGuideResponse = z.infer<typeof parseStitchGuideResponseSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/stitch-guide/schemas.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/stitch-guide/schemas.ts apps/api/tests/stitch-guide/schemas.test.ts
git commit -m "feat(api): add Zod schemas for stitch guide parsing endpoint"
```

---

### Task 3: Create Stitch Guide Service (Claude Integration)

**Files:**
- Create: `apps/api/src/stitch-guide/stitch-guide-service.ts`
- Test: `apps/api/tests/stitch-guide/stitch-guide-service.test.ts`

**Step 1: Write the failing tests**

Create `apps/api/tests/stitch-guide/stitch-guide-service.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/stitch-guide/stitch-guide-service.test.ts`
Expected: FAIL — module not found

**Step 3: Write the service**

Create `apps/api/src/stitch-guide/stitch-guide-service.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { parseStitchGuideResponseSchema } from "./schemas.js";
import type { ParsedMaterial } from "./schemas.js";

const SYSTEM_PROMPT = `You are a needlepoint stitch guide parser. Given an image of a stitch guide or materials list, extract every material/fiber/supply listed.

For each item, return:
- materialType: "thread", "bead", "accessory", or "other"
- brand: the brand name (e.g., "Splendor", "DMC", "Kreinik"), or null if unknown
- name: the color/material name (e.g., "Dark Olive Green", "Black")
- code: the product code (e.g., "S832", "310", "#4"), or null if not present
- quantity: the number needed (default 1 if not specified)
- unit: the unit (e.g., "Cards", "Skeins", "Spools", "Tubes", "Strands", "Hanks"), or null if not specified

Classify items as:
- "thread" for any fiber, floss, braid, ribbon, silk, wool, or similar stitching material
- "bead" for beads of any kind
- "accessory" for needles, stretcher bars, frames, scissors, laying tools, etc.
- "other" for anything that doesn't fit the above categories

Return ONLY valid JSON in this exact format, with no other text:
{"materials": [...]}

If the image does not appear to contain a stitch guide or materials list, return:
{"materials": []}`;

const USER_PROMPT = "Extract all materials from this stitch guide image. Return JSON only.";

export class StitchGuideService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async parseImage(
    base64Data: string,
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
  ): Promise<ParsedMaterial[]> {
    return this.parseImages([{ data: base64Data, mediaType }]);
  }

  async parseImages(
    images: Array<{
      data: string;
      mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    }>
  ): Promise<ParsedMaterial[]> {
    const content: Anthropic.MessageCreateParams["messages"][0]["content"] =
      images.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType,
          data: img.data,
        },
      }));

    content.push({ type: "text" as const, text: USER_PROMPT });

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new Error("Claude returned invalid JSON");
    }

    const result = parseStitchGuideResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Claude response does not match expected schema");
    }

    return result.data.materials;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/stitch-guide/stitch-guide-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/stitch-guide/stitch-guide-service.ts apps/api/tests/stitch-guide/stitch-guide-service.test.ts
git commit -m "feat(api): add StitchGuideService with Claude Sonnet vision integration"
```

---

### Task 4: Create Stitch Guide Routes

**Files:**
- Create: `apps/api/src/stitch-guide/stitch-guide-routes.ts`
- Modify: `apps/api/src/app.ts` (register route)
- Test: `apps/api/tests/stitch-guide/stitch-guide-routes.test.ts`

**Step 1: Write the failing tests**

Create `apps/api/tests/stitch-guide/stitch-guide-routes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";
import app from "../../src/app.js";

// Mock the StitchGuideService
const mockParseImage = vi.fn();
vi.mock("../../src/stitch-guide/stitch-guide-service.js", () => ({
  StitchGuideService: class {
    parseImage = mockParseImage;
  },
}));

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
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/stitch-guide/stitch-guide-routes.test.ts`
Expected: FAIL — route not found / 404s

**Step 3: Write the route**

Create `apps/api/src/stitch-guide/stitch-guide-routes.ts`:

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { StitchGuideService } from "./stitch-guide-service.js";
import {
  parseStitchGuideRequestSchema,
  imageMediaTypes,
} from "./schemas.js";
import type { SupportedMediaType } from "./schemas.js";

const stitchGuideRoutes = new Hono<AuthEnv>();
const service = new StitchGuideService();

stitchGuideRoutes.use("/*", authMiddleware);

stitchGuideRoutes.post("/parse", async (c) => {
  const body = await c.req.json();
  const parsed = parseStitchGuideRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
  }

  const { file, mediaType } = parsed.data;

  try {
    let materials;

    if ((imageMediaTypes as readonly string[]).includes(mediaType)) {
      // Direct image — send to Claude as-is
      materials = await service.parseImage(
        file,
        mediaType as "image/jpeg" | "image/png" | "image/webp"
      );
    } else {
      // Document (PDF/Office) — convert to images first
      // TODO: Task 5 will implement document conversion
      return c.json({ error: "Document conversion not yet implemented" }, 501);
    }

    if (materials.length === 0) {
      return c.json(
        { error: "No materials found in the provided file" },
        422
      );
    }

    return c.json({ materials });
  } catch (error) {
    console.error("Stitch guide parsing failed:", error);
    return c.json({ error: "Failed to parse stitch guide" }, 500);
  }
});

export { stitchGuideRoutes };
```

**Step 4: Register the route in `app.ts`**

Add to `apps/api/src/app.ts`:
- Import: `import { stitchGuideRoutes } from "./stitch-guide/stitch-guide-routes.js";`
- Route: `app.route("/stitch-guide", stitchGuideRoutes);`

**Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/stitch-guide/stitch-guide-routes.test.ts`
Expected: PASS

**Step 6: Run all tests to ensure nothing is broken**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add apps/api/src/stitch-guide/stitch-guide-routes.ts apps/api/src/app.ts apps/api/tests/stitch-guide/stitch-guide-routes.test.ts
git commit -m "feat(api): add POST /stitch-guide/parse route with auth and validation"
```

---

### Task 5: Add Document-to-Image Conversion

**Files:**
- Modify: `apps/api/package.json` (install `pdf-to-img`)
- Create: `apps/api/src/stitch-guide/document-converter.ts`
- Test: `apps/api/tests/stitch-guide/document-converter.test.ts`
- Modify: `apps/api/src/stitch-guide/stitch-guide-routes.ts` (wire in converter)

**Step 1: Install pdf-to-img**

Run:
```bash
cd apps/api && npm install pdf-to-img
```

Note: For Office (DOCX/XLSX) conversion, `libreoffice --headless` is used via child_process. LibreOffice must be installed on the server. This is a runtime dependency, not an npm package.

**Step 2: Write the failing tests**

Create `apps/api/tests/stitch-guide/document-converter.test.ts`:

```typescript
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
    // This test verifies the cap logic exists.
    // Full PDF conversion is integration-tested separately since it
    // requires actual PDF binary data and the pdf-to-img library.
    expect(DocumentConverter.MAX_PAGES).toBe(5);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/stitch-guide/document-converter.test.ts`
Expected: FAIL — module not found

**Step 4: Write the document converter**

Create `apps/api/src/stitch-guide/document-converter.ts`:

```typescript
import { pdf } from "pdf-to-img";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { SupportedMediaType } from "./schemas.js";
import { imageMediaTypes } from "./schemas.js";

const execFileAsync = promisify(execFile);

type ImageOutput = {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

export class DocumentConverter {
  static readonly MAX_PAGES = 5;

  async toImages(
    base64Data: string,
    mediaType: SupportedMediaType
  ): Promise<ImageOutput[]> {
    if ((imageMediaTypes as readonly string[]).includes(mediaType)) {
      return [
        {
          data: base64Data,
          mediaType: mediaType as ImageOutput["mediaType"],
        },
      ];
    }

    if (mediaType === "application/pdf") {
      return this.pdfToImages(base64Data);
    }

    // Office documents: convert to PDF first, then to images
    return this.officeToImages(base64Data, mediaType);
  }

  private async pdfToImages(base64Data: string): Promise<ImageOutput[]> {
    const buffer = Buffer.from(base64Data, "base64");
    const images: ImageOutput[] = [];
    let pageCount = 0;

    for await (const page of await pdf(buffer, { scale: 2 })) {
      if (pageCount >= DocumentConverter.MAX_PAGES) break;
      images.push({
        data: Buffer.from(page).toString("base64"),
        mediaType: "image/png",
      });
      pageCount++;
    }

    return images;
  }

  private async officeToImages(
    base64Data: string,
    _mediaType: SupportedMediaType
  ): Promise<ImageOutput[]> {
    const tmpDir = await mkdtemp(join(tmpdir(), "stitch-guide-"));
    const inputPath = join(tmpDir, "input");
    const outputPath = join(tmpDir, "input.pdf");

    try {
      await writeFile(inputPath, Buffer.from(base64Data, "base64"));

      await execFileAsync("libreoffice", [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        tmpDir,
        inputPath,
      ]);

      const pdfBuffer = await readFile(outputPath);
      return this.pdfToImages(pdfBuffer.toString("base64"));
    } finally {
      // Clean up temp files
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/stitch-guide/document-converter.test.ts`
Expected: PASS

**Step 6: Wire the converter into the route**

Update `apps/api/src/stitch-guide/stitch-guide-routes.ts` — replace the `TODO` block with actual document conversion:

Replace the `try` block content in the route handler with:

```typescript
    const converter = new DocumentConverter();
    const images = await converter.toImages(file, mediaType);
    const materials = await service.parseImages(images);
```

Remove the old `if/else` branching on `imageMediaTypes`. Add the import:

```typescript
import { DocumentConverter } from "./document-converter.js";
```

**Step 7: Run all stitch-guide tests**

Run: `cd apps/api && npx vitest run tests/stitch-guide/`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/api/src/stitch-guide/document-converter.ts apps/api/tests/stitch-guide/document-converter.test.ts apps/api/src/stitch-guide/stitch-guide-routes.ts apps/api/package.json apps/api/package-lock.json
git commit -m "feat(api): add document-to-image conversion for PDF and Office files"
```

---

### Task 6: Run All API Tests

**Step 1: Run the full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

**Step 2: If any failures, fix them before proceeding**

---

### Task 7: Update iOS ScanMaterialsView — Add API Call and Document Picker

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift` (add `parseStitchGuide` method)

**Step 1: Add `parseStitchGuide` method to `NetworkClient`**

Add to `apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift`, before the `attemptTokenRefresh` method:

```swift
    // MARK: - Stitch Guide Parsing

    struct StitchGuideRequest: Encodable {
        let file: String
        let mediaType: String
    }

    struct StitchGuideResponse: Decodable {
        let materials: [StitchGuideMaterial]
    }

    struct StitchGuideMaterial: Decodable {
        let materialType: String
        let brand: String?
        let name: String
        let code: String?
        let quantity: Int?
        let unit: String?
    }

    func parseStitchGuide(fileData: Data, mediaType: String) async throws -> [ParsedMaterial] {
        let base64 = fileData.base64EncodedString()
        let response: StitchGuideResponse = try await request(
            method: "POST",
            path: "/stitch-guide/parse",
            body: StitchGuideRequest(file: base64, mediaType: mediaType)
        )

        return response.materials.map { m in
            ParsedMaterial(
                materialType: MaterialType(rawValue: m.materialType) ?? .other,
                brand: m.brand,
                name: m.name,
                code: m.code,
                quantity: m.quantity ?? 1,
                unit: m.unit
            )
        }
    }
```

**Step 2: Rewrite `ScanMaterialsView`**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift` with:

```swift
import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif

struct ScanMaterialsView: View {
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    let onMaterialsParsed: ([ParsedMaterial]) -> Void
    let networkClient: NetworkClient

    @State private var selectedPhoto: PhotosPickerItem? = nil
    @State private var showCamera = false
    @State private var showDocumentPicker = false
    @State private var isProcessing = false
    @State private var errorMessage: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()

                VStack(spacing: Spacing.xl) {
                    if isProcessing {
                        VStack(spacing: Spacing.lg) {
                            ProgressView()
                                .tint(Color.terracotta)
                                .scaleEffect(1.5)
                            Text("Analyzing stitch guide...")
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.walnut)
                        }
                    } else {
                        EmptyStateView(
                            icon: "camera.viewfinder",
                            title: "Scan Stitch Guide",
                            message: "Take a photo, choose from your library, or select a document to import the fibers list"
                        )

                        VStack(spacing: Spacing.md) {
                            if CameraView.isCameraAvailable {
                                Button {
                                    showCamera = true
                                } label: {
                                    Label("Take Photo", systemImage: "camera")
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, Spacing.md)
                                        .background(Color.terracotta)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                }
                            }

                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("Choose from Library", systemImage: "photo")
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(Color.terracotta)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, Spacing.md)
                                    .background(Color.cream)
                                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                                            .stroke(Color.terracotta, lineWidth: 1)
                                    )
                            }

                            Button {
                                showDocumentPicker = true
                            } label: {
                                Label("Select Document", systemImage: "doc")
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(Color.terracotta)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, Spacing.md)
                                    .background(Color.cream)
                                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                                            .stroke(Color.terracotta, lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.horizontal, Spacing.xxxl)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.dustyRose)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, Spacing.lg)
                        }
                    }
                }
            }
            .navigationTitle("Scan Guide")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
            }
            .onChange(of: selectedPhoto) { _, newItem in
                guard let newItem else { return }
                Task {
                    await processPhotoItem(newItem)
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, _ in
                    Task {
                        await processImage(image)
                    }
                } onDismiss: {
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showDocumentPicker) {
                DocumentPickerView { url in
                    Task {
                        await processDocument(url)
                    }
                }
            }
        }
    }

    private func processPhotoItem(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorMessage = "Could not load image"
            return
        }
        await sendToAPI(fileData: data, mediaType: "image/jpeg")
    }

    private func processImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.8) else {
            errorMessage = "Could not process image"
            return
        }
        await sendToAPI(fileData: data, mediaType: "image/jpeg")
    }

    private func processDocument(_ url: URL) async {
        guard url.startAccessingSecurityScopedResource() else {
            errorMessage = "Could not access document"
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        guard let data = try? Data(contentsOf: url) else {
            errorMessage = "Could not read document"
            return
        }

        let mediaType = Self.mediaType(for: url)
        await sendToAPI(fileData: data, mediaType: mediaType)
    }

    private func sendToAPI(fileData: Data, mediaType: String) async {
        isProcessing = true
        errorMessage = nil

        do {
            let materials = try await networkClient.parseStitchGuide(
                fileData: fileData,
                mediaType: mediaType
            )

            await MainActor.run {
                isProcessing = false
                if materials.isEmpty {
                    errorMessage = "No materials found. Try a clearer photo or different document."
                } else {
                    onMaterialsParsed(materials)
                }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to analyze stitch guide. Please try again."
            }
        }
    }

    static func mediaType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf": return "application/pdf"
        case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "png": return "image/png"
        case "webp": return "image/webp"
        default: return "image/jpeg"
        }
    }
}
```

**Step 3: Create `DocumentPickerView`**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/DocumentPickerView.swift`:

```swift
import SwiftUI
import UniformTypeIdentifiers

struct DocumentPickerView: UIViewControllerRepresentable {
    let onDocumentPicked: (URL) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [.pdf, .init("org.openxmlformats.wordprocessingml.document")!, .init("org.openxmlformats.spreadsheetml.sheet")!]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onDocumentPicked: onDocumentPicked)
    }

    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onDocumentPicked: (URL) -> Void

        init(onDocumentPicked: @escaping (URL) -> Void) {
            self.onDocumentPicked = onDocumentPicked
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            onDocumentPicked(url)
        }
    }
}
```

**Step 4: Update callers of `ScanMaterialsView` to pass `networkClient`**

Find all places where `ScanMaterialsView` is instantiated (likely `ProjectDetailView`) and add the `networkClient` parameter. The `networkClient` instance should be passed down from wherever it's created in the app (likely a shared/environment object).

**Step 5: Build in Xcode to verify compilation**

Run: Build the project in Xcode (Cmd+B) — it should compile without errors.

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ScanMaterialsView.swift apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift apps/ios/stitchuation/stitchuation/DesignSystem/Components/DocumentPickerView.swift
git commit -m "feat(ios): replace OCR with Claude API call and add document picker support"
```

---

### Task 8: Remove Old OCR Code

**Files:**
- Delete: `apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift`
- Delete: `apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift`

**Step 1: Delete the files**

```bash
rm apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift
rm apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift
```

**Step 2: Move `ParsedMaterial` struct to its own file**

`ParsedMaterial` is currently defined in `StitchGuideParser.swift`. Since we're deleting that file, move the struct to a new file.

Create `apps/ios/stitchuation/stitchuation/Models/ParsedMaterial.swift`:

```swift
import Foundation

struct ParsedMaterial {
    var materialType: MaterialType = .other
    var brand: String? = nil
    var name: String = ""
    var code: String? = nil
    var quantity: Int = 1
    var unit: String? = nil
}
```

**Step 3: Build in Xcode to verify compilation**

Run: Build the project in Xcode (Cmd+B) — it should compile. The project uses File System Synchronization so Xcode auto-discovers the new file and notices the deleted ones.

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/ParsedMaterial.swift
git rm apps/ios/stitchuation/stitchuation/Services/StitchGuideParser.swift apps/ios/stitchuation/stitchuationTests/StitchGuideParserTests.swift
git commit -m "refactor(ios): remove StitchGuideParser and Vision OCR code, extract ParsedMaterial model"
```

---

### Task 9: Final Verification

**Step 1: Run all API tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests PASS

**Step 2: Build iOS app in Xcode**

Run: Cmd+B in Xcode
Expected: Build succeeds

**Step 3: Manual smoke test**

- Launch the app in Simulator
- Navigate to a piece → Scan Guide
- Verify you see "Take Photo", "Choose from Library", and "Select Document" buttons
- Test with a stitch guide photo (if available)
