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

const USER_PROMPT =
  "Extract all materials from this stitch guide image. Return JSON only.";

function extractJson(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a JSON object in the text
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];

  return text;
}

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

    const jsonText = extractJson(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("Claude response was not valid JSON:", textBlock.text);
      throw new Error("Claude returned invalid JSON");
    }

    const result = parseStitchGuideResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Claude response does not match expected schema");
    }

    return result.data.materials;
  }
}
