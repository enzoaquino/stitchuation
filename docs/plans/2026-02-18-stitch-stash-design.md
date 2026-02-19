# Stitch Stash Design

**Date:** 2026-02-18
**Status:** Approved
**Feature:** Stitch Stash — a personalized collection of canvases a user owns

## Overview

Stitch Stash is a standalone canvas collection, separate from the future Projects feature. Users can catalog canvases they own with designer, design name, optional acquisition date, an image, and basic canvas specs. The list is flat, ordered by most recently added.

## Data Model

### `canvases` table (PostgreSQL/Drizzle)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | UUID | yes | Primary key, client-generated |
| `userId` | UUID | yes | Foreign key to `users` |
| `designer` | text | yes | Free text with autocomplete from past entries |
| `designName` | text | yes | Name of the design |
| `acquiredAt` | timestamp | no | When the user acquired the canvas |
| `imageKey` | text | no | Storage key (not a URL) for the canvas image |
| `size` | text | no | Free text, e.g., "13x18", "10\" round" |
| `meshCount` | integer | no | e.g., 18 |
| `notes` | text | no | |
| `createdAt` | timestamp | yes | Auto-set |
| `updatedAt` | timestamp | yes | Auto-set, updated on change |
| `deletedAt` | timestamp | no | Soft delete for sync |

### iOS — `Canvas` SwiftData model

Same fields as the database table, plus `syncedAt` (local-only) for sync tracking. Follows the existing `NeedleThread` pattern.

## Image Storage

### StorageProvider abstraction

```
StorageProvider
  ├── upload(file, key) → url
  ├── getUrl(key) → url
  └── delete(key) → void

LocalStorageProvider    — writes to disk, serves via static file route (dev)
S3StorageProvider       — uploads to S3 bucket, returns URL (prod)
```

Lives in `apps/api/src/storage/`. Selected via `STORAGE_PROVIDER` env variable (`local` or `s3`).

### Key design decisions

- **Store keys, not URLs.** Canvas records store a storage key (e.g., `canvases/{userId}/{canvasId}.jpg`), not a direct URL. The API resolves keys to actual locations, so switching storage backends requires zero data migration.
- **API resolves images.** `GET /images/*` resolves a storage key — serves the file directly in dev, returns a 302 redirect to S3 in prod.
- **Auth on image serving.** The `/images/*` endpoint requires authentication to prevent unauthorized access.

### Upload flow

1. iOS user picks a photo via `PHPicker`
2. Image compressed/resized client-side before upload
3. App uploads to `POST /canvases/:id/image` (multipart/form-data)
4. API generates key `canvases/{userId}/{canvasId}.jpg`, stores via `StorageProvider`
5. Saves key to canvas record, returns the key in response

## API Routes

### Canvas CRUD — `/canvases`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/canvases` | List user's canvases (ordered by `createdAt` desc) |
| `POST` | `/canvases` | Create a canvas |
| `GET` | `/canvases/:id` | Get single canvas |
| `PUT` | `/canvases/:id` | Update a canvas |
| `DELETE` | `/canvases/:id` | Soft delete a canvas |
| `POST` | `/canvases/:id/image` | Upload image (multipart/form-data, 10MB limit, JPEG/PNG/HEIC) |
| `DELETE` | `/canvases/:id/image` | Remove image (deletes from storage, clears key) |

### Image serving — `/images`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/images/*` | Resolve storage key — serve file (local) or 302 redirect (S3) |

All routes require JWT auth via `authMiddleware`.

### Validation (Zod)

- `createCanvasSchema`: `designer` (required string), `designName` (required string), `acquiredAt` (optional ISO date), `size` (optional string), `meshCount` (optional positive integer), `notes` (optional string)
- `updateCanvasSchema`: all fields optional (partial of create)
- Image upload: multipart with file size limit (10MB), allowed types (JPEG, PNG, HEIC)

## iOS UI

### New tab: Stitch Stash

New tab in the tab bar using SF Symbol `square.stack.3d.up` or `tray.2`. Tab label "Stitch Stash" (or "Stash" if it clips on smaller devices). Screen title: "Stitch Stash".

### Views

- **StashListView** — Flat list of canvases, most recently added first. Each row shows thumbnail (or placeholder), design name, and designer. Search bar to filter by name/designer.
- **AddCanvasView** — Form with grouped sections. Image picker at top (tap to add photo), required fields (designer with autocomplete from past entries, design name), optional fields (acquired date picker, size, mesh count, notes).
- **CanvasDetailView** — Full canvas view. Large image at top (tappable to zoom/fullscreen), all fields displayed below. Edit/delete actions.

### Image handling

- `PHPickerViewController` wrapped in SwiftUI representable for photo selection
- Image compressed/resized client-side before upload
- Images loaded via API's `/images/*` endpoint with JWT auth
- Placeholder image (design system styled) when no image is set

### Design system

All views use Warm & Refined tokens — linen backgrounds, Playfair Display headers, Source Serif body, terracotta accents. Styled consistently with the thread list.

## Sync Integration

- Add `"canvas"` to sync schema entity type enum alongside `"thread"`
- Allowlisted fields: `designer`, `designName`, `acquiredAt`, `imageKey`, `size`, `meshCount`, `notes`
- `SyncService` gets `processCanvasChange` mirroring `processThreadChange`
- iOS `SyncEngine` updated to gather unsynced `Canvas` records and process incoming canvas changes
- Only the `imageKey` string syncs — image bytes load on demand via `/images/*`

## Testing

### API tests (`apps/api/tests/`)

- `canvases/canvas-service.test.ts` — CRUD, soft delete, user isolation, image key management
- `canvases/canvas-routes.test.ts` — Route handlers, auth, validation errors, 404s
- `storage/storage-provider.test.ts` — LocalStorageProvider upload/get/delete, key generation
- `storage/image-routes.test.ts` — Image serving, auth, 404 for missing keys
- Sync tests updated — canvas entity added to existing sync suite

### iOS tests (`apps/ios/stitchuationTests/`)

- `CanvasTests.swift` — Model creation, defaults, optional fields
- `CanvasViewModelTests.swift` — List loading, filtering, add/edit/delete

TDD workflow: failing test first, implement, verify, commit.

## Known Limitations (v1)

- **Image orphaning:** Deleted canvases may leave orphaned images in storage. A cleanup job can be added later.
- **No offline images on new devices:** Canvas data syncs offline, but images require connectivity to load.
- **Image conflicts:** Last-write-wins can discard one image if uploaded on two devices before sync. Losing image becomes orphaned.
- **No upload queue:** Bulk offline canvas additions trigger many sequential image uploads on reconnect. Retry/queue logic can be added later.
