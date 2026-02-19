# Project Journal Design

**Date:** 2026-02-18
**Status:** Approved
**Feature:** Project Journal — track stitching progress with notes and images

## Overview

Project Journal lets users track their stitching progress on canvases they own. A project is always tied to a canvas from Stitch Stash. Users advance through a linear status flow (WIP → At Finishing → Completed) and add timestamped journal entries with notes and multiple images along the way. A new Projects tab shows active work, while Stitch Stash displays status badges on canvases that have projects.

## Data Model

### `project_status` enum

Values: `wip`, `at_finishing`, `completed`

### `projects` table (PostgreSQL/Drizzle)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | UUID | yes | Primary key, client-generated |
| `canvasId` | UUID | yes | FK to `canvases`, unique (1:1 relationship) |
| `userId` | UUID | yes | FK to `users` |
| `status` | project_status | yes | Default: `wip` |
| `startedAt` | timestamp | no | Set when project created (defaults to now) |
| `finishingAt` | timestamp | no | Set when status advances to `at_finishing` |
| `completedAt` | timestamp | no | Set when status advances to `completed` |
| `createdAt` | timestamp | yes | Auto-set |
| `updatedAt` | timestamp | yes | Auto-set, updated on change |
| `deletedAt` | timestamp | no | Soft delete for sync |

### `journal_entries` table

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | UUID | yes | Primary key, client-generated |
| `projectId` | UUID | yes | FK to `projects` |
| `userId` | UUID | yes | FK to `users` |
| `notes` | text | no | Free text |
| `createdAt` | timestamp | yes | Auto-set |
| `updatedAt` | timestamp | yes | Auto-set, updated on change |
| `deletedAt` | timestamp | no | Soft delete for sync |

### `journal_images` table

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | UUID | yes | Primary key, client-generated |
| `entryId` | UUID | yes | FK to `journal_entries` |
| `imageKey` | text | yes | Storage key (same pattern as canvas images) |
| `sortOrder` | integer | yes | Display ordering within entry |
| `createdAt` | timestamp | yes | Auto-set |
| `updatedAt` | timestamp | yes | Auto-set, updated on change |
| `deletedAt` | timestamp | no | Soft delete for sync |

### iOS — SwiftData Models

**`StitchProject`** (avoids Swift's `Project` name collision):
- Same fields as API table, plus `syncedAt` (local-only)
- `@Relationship var canvas: StashCanvas`
- Inverse on `StashCanvas`: `@Relationship var project: StitchProject?`

**`JournalEntry`**:
- Same fields, plus `syncedAt`
- `@Relationship var project: StitchProject`

**`JournalImage`**:
- Same fields, plus `syncedAt`
- `@Relationship var entry: JournalEntry`

## Status Flow

Linear, forward-only: `wip` → `at_finishing` → `completed`

- **WIP**: Canvas is being stitched. Default when project is created.
- **At Finishing**: Stitching complete, canvas is at the finisher for mounting/framing.
- **Completed**: Finished and back from the finisher.

Transition timestamps (`startedAt`, `finishingAt`, `completedAt`) are set automatically when status advances. Users cannot move backwards.

## API Routes

### Project CRUD — `/projects`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects` | List user's projects (joins canvas for display data) |
| `POST` | `/projects` | Create project from canvas (status=wip, startedAt=now) |
| `GET` | `/projects/:id` | Get project with canvas info |
| `PUT` | `/projects/:id` | Update project fields |
| `PUT` | `/projects/:id/status` | Advance status to next step |
| `DELETE` | `/projects/:id` | Soft delete |

### Journal Entry Routes — `/projects/:projectId/entries`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/projects/:id/entries` | List entries with images (createdAt desc) |
| `POST` | `/projects/:id/entries` | Create entry (notes + optional images) |
| `GET` | `/projects/:id/entries/:entryId` | Get single entry |
| `PUT` | `/projects/:id/entries/:entryId` | Update entry notes |
| `DELETE` | `/projects/:id/entries/:entryId` | Soft delete entry |
| `POST` | `/projects/:id/entries/:entryId/images` | Upload image(s) to entry (multipart, 1-4 images) |
| `DELETE` | `/projects/:id/entries/:entryId/images/:imageId` | Remove image from entry |

All routes require JWT auth via `authMiddleware`.

### Validation (Zod)

- `createProjectSchema`: `canvasId` (required UUID)
- Status advancement: no body — server reads current status and advances to next. Returns 400 if already completed.
- `createJournalEntrySchema`: `notes` (optional string)
- `updateJournalEntrySchema`: `notes` (required string, non-empty)
- Image upload: multipart, 10MB limit, JPEG/PNG/HEIC, magic bytes validation

## iOS UI

### Tab Bar

4 tabs: **Inventory** | **Stitch Stash** | **Projects** | **Settings**

Projects tab uses a craft-themed SF Symbol. Label: "Projects".

### ProjectListView

- List of projects, grouped by status (WIP at top, At Finishing, Completed)
- Each row: canvas thumbnail, design name, designer, status badge, last journal entry date
- Tap → `ProjectDetailView`
- "Start Project" button → picker to select an unlinked canvas from Stitch Stash
- Empty state: "No projects yet — start one from your Stitch Stash"

### ProjectDetailView

- Large canvas image at top (reuses `CanvasThumbnail` pattern)
- Status badge with "Advance" button (e.g., "Move to Finishing", "Mark Complete")
- Timeline section: chronological journal entries
- Each entry: date header, notes, horizontal image gallery (tap to view full)
- Floating "+" to add new journal entry
- Status transition timestamps in info section

### AddJournalEntryView

- Modal sheet
- Multi-line text field for notes
- Photo picker for 1-4 images (horizontal row with "+" to add, tap to remove)
- Save button

### Stitch Stash Updates

- `CanvasRowView`: small status badge pill (WIP/Finishing/Completed) if canvas has a project
- `CanvasDetailView`: project status section if project exists, with "View Journal" link

### Design System

All views use Warm & Refined tokens. Status badges:
- WIP: `terracotta` background
- At Finishing: `dustyRose` background
- Completed: `sage` background

## Image Handling

- Same `StorageProvider` abstraction as canvas images
- Storage key pattern: `journals/{userId}/{entryId}/{imageId}.jpg`
- Upload via `POST /projects/:id/entries/:entryId/images` (multipart/form-data)
- Served via existing `GET /images/*` endpoint (same auth, same resolution)
- Client compresses to JPEG before upload (reuse `compressImage` utility)
- Each entry supports 1-4 images

## Sync Integration

Three new entity types in the sync protocol:
- `"project"` — syncs status, startedAt, finishingAt, completedAt, canvasId
- `"journalEntry"` — syncs projectId, notes
- `"journalImage"` — syncs entryId, imageKey, sortOrder

Same patterns as `thread` and `canvas`: last-write-wins, soft deletes, `syncedAt` tracking. Image bytes load on demand via `/images/*`.

## Testing

### API tests (`apps/api/tests/`)

- `projects/project-service.test.ts` — CRUD, status advancement, canvas linkage, user isolation
- `projects/project-routes.test.ts` — Route handlers, auth, validation, status flow enforcement
- `projects/journal-service.test.ts` — Entry CRUD, image management
- `projects/journal-routes.test.ts` — Entry routes, image upload/delete
- Sync tests updated for project/journalEntry/journalImage entities

### iOS tests (`apps/ios/stitchuation/stitchuationTests/`)

- `StitchProjectTests.swift` — Model creation, status transitions
- `JournalEntryTests.swift` — Model creation, image relationships
- `ProjectListViewModelTests.swift` — Filtering, grouping by status

TDD workflow: failing test first, implement, verify, commit.

## Known Limitations (v1)

- **No entry reordering:** Journal entries are always chronological by creation date.
- **No image reordering:** Images within an entry are ordered by `sortOrder` set at upload time.
- **No offline image queue:** Multiple image uploads happen sequentially on reconnect, same as canvas images.
- **No backward status:** Users cannot revert from Completed → At Finishing. They'd need to delete and recreate the project.
- **Image orphaning on entry delete:** Same as canvas — a cleanup job can handle this later.
