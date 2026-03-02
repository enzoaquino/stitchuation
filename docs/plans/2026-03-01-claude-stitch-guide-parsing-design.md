# Claude-Powered Stitch Guide Parsing

**Date:** 2026-03-01
**Status:** Approved

## Problem

The current stitch guide scanning uses Apple Vision OCR + a heuristic `StitchGuideParser` to extract materials from photos of stitch guides. Stitch guide formats vary widely (different layouts, column structures, abbreviations, fonts) and the heuristic parser can't handle all variations reliably.

## Solution

Replace the entire local OCR + parsing pipeline with a server-side Claude Sonnet vision call. The iOS app sends the raw stitch guide file (image or document) to a new API endpoint, which processes it and forwards it to Claude Sonnet for structured extraction.

## Decisions

- **Image directly to Claude** — not OCR text. Claude sees layout, fonts, columns for better accuracy.
- **Server-side only** — API key stays on the server. Controls cost and rate-limiting.
- **General parsing endpoint** — `POST /stitch-guide/parse` returns structured data. iOS saves locally.
- **Base64 in JSON body** — stitch guide files are small. Simple implementation.
- **Support images and documents** — JPEG, PNG, WebP, PDF, DOCX, XLSX accepted.
- **Convert documents to images server-side** — PDF/Office files converted to page images before sending to Claude.
- **Remove old code** — delete StitchGuideParser and Vision OCR. Clean break.
- **Authenticated only** — prevents abuse of Claude API credits.

## API Endpoint

### `POST /stitch-guide/parse`

Authenticated. Requires JWT.

**Request:**
```json
{
  "file": "<base64-encoded file>",
  "mediaType": "image/jpeg"
}
```

Validation:
- `file` is a non-empty base64 string, max ~5MB
- `mediaType` is one of:
  - `image/jpeg`, `image/png`, `image/webp` (images)
  - `application/pdf` (PDF documents)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX)

**Response (200):**
```json
{
  "materials": [
    {
      "materialType": "thread",
      "brand": "Splendor",
      "name": "Dark Olive Green",
      "code": "S832",
      "quantity": 2,
      "unit": "Cards"
    }
  ]
}
```

Matches the existing `ParsedMaterial` struct so the iOS review screen works unchanged.

**Errors:**
- `400` — invalid file, missing fields, or unsupported media type
- `422` — Claude couldn't extract any materials
- `500` — Claude API failure

### File Organization

- `apps/api/src/stitch-guide/stitch-guide-routes.ts`
- `apps/api/src/stitch-guide/stitch-guide-service.ts`
- `apps/api/src/stitch-guide/schemas.ts`

## Server-Side Processing Pipeline

1. **Images** (`image/jpeg`, `image/png`, `image/webp`) — pass directly to Claude as a base64 image content block.
2. **PDF** (`application/pdf`) — convert pages to images server-side (e.g., `pdf-to-img` or `sharp` + `pdf.js`), then send as image content blocks.
3. **Office** (`.docx`, `.xlsx`) — convert to PDF first (e.g., `libreoffice --headless`), then PDF to images.
4. **Multi-page documents** — send all page images to Claude in a single multi-image vision call. Cap at first 5 pages.

## Claude Sonnet Integration

- **SDK:** `@anthropic-ai/sdk` npm package
- **Environment:** `ANTHROPIC_API_KEY` env var (auto-picked up by SDK)
- **Model:** `claude-sonnet-4-5-20250929`

### Service Function

Takes base64 file + media type. Processes through the pipeline above to produce one or more images. Calls Claude with:
- Image(s) as base64 `image` content blocks
- System prompt instructing structured material extraction
- User prompt requesting JSON output matching `ParsedMaterial` schema

### Prompt Design

- Identify each material line item in the stitch guide
- Classify as `thread`, `bead`, `accessory`, or `other`
- Extract: brand, name, code, quantity, unit
- Return exact JSON schema
- Return empty array if file doesn't contain a stitch guide

### Response Handling

Extract JSON from Claude's response, validate against Zod schema. Return `422` if response doesn't parse or fails validation.

## iOS Changes

### ScanMaterialsView — Simplified

- Keep image capture UI (camera + photo library)
- Add document picker (`UIDocumentPickerViewController`) for PDF and Office files
- Accepted UTTypes: images, PDF, DOCX, XLSX
- Remove all Vision/OCR code
- After capture/selection, send file as base64 to `POST /stitch-guide/parse`
- Show "Analyzing stitch guide..." spinner
- On success, pass `[ParsedMaterial]` to existing `onMaterialsParsed` callback
- On failure, show error message

### New API Client Method

`parseStitchGuide(fileData: Data, mediaType: String) async throws -> [ParsedMaterial]` — encodes file to base64, posts to endpoint, decodes response.

### Unchanged

- `ParsedMaterialsReviewView` — already consumes `[ParsedMaterial]`
- `PieceMaterial` model
- `ProjectDetailView` navigation flow
- `MaterialsSection`

### Removed

- `StitchGuideParser.swift`
- `StitchGuideParserTests.swift`
- Vision framework OCR code from `ScanMaterialsView`

## Testing

### API Tests

**Route tests** (`apps/api/tests/stitch-guide/stitch-guide-routes.test.ts`):
- 401 without auth
- 400 for missing/invalid file data
- 400 for unsupported media type
- 200 with parsed materials on success (mocked Claude)
- 422 when Claude returns no materials
- 500 when Claude API fails

**Service tests** (`apps/api/tests/stitch-guide/stitch-guide-service.test.ts`):
- Calls Anthropic SDK with correct model, image, and prompt
- Parses valid Claude JSON response into typed materials
- Handles malformed Claude response
- Handles empty materials array
- Converts PDF to images before sending to Claude
- Converts Office documents to PDF then images
- Caps multi-page documents at 5 pages

### Mocking Strategy

Mock Anthropic SDK client at service level. Route tests mock the service. No real Claude API calls in tests.

### iOS Tests

Minimal — API tests carry the weight. Review/save flow already covered by existing code paths.

## User-Facing Flow

Unchanged: Tap "Scan Guide" → take/pick photo or select document → review materials → save. Only difference is spinner text, document support, and better results.
