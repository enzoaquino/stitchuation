# Project States Rework Design

**Goal:** Merge Canvas and Project into a single `StitchPiece` entity with a 6-state lifecycle, keeping separate Stash and Projects views.

**Problem:** Canvas and Project are currently separate entities with an awkward handoff. The real needlepoint lifecycle is a continuous progression from acquisition through finishing, not two disconnected concepts.

## Data Model: `StitchPiece`

Replaces both `StashCanvas` (iOS) / `canvases` (API) and `StitchProject` / `projects`. One entity, one table.

### Fields

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| designer | String | Required |
| designName | String | Required |
| status | PieceStatus | Default: `.stash` |
| imageKey | String? | S3/upload key |
| size | String? | e.g. "13x18" |
| meshCount | Int? | e.g. 13, 18 |
| notes | String? | |
| acquiredAt | Date? | When canvas was acquired |
| startedAt | Date? | Set when status → kitting |
| stitchedAt | Date? | Set when status → stitched |
| finishingAt | Date? | Set when status → atFinishing |
| completedAt | Date? | Set when status → finished |
| createdAt | Date | Auto |
| updatedAt | Date | Auto |
| deletedAt | Date? | Soft delete |
| syncedAt | Date? | iOS only, local sync tracking |

### Relationships

- `entries: [JournalEntry]` — cascade delete (journal belongs to piece)

### `PieceStatus` Enum

```
stash → kitting → wip → stitched → atFinishing → finished
```

| Value | Raw (API) | Display Name |
|-------|-----------|-------------|
| .stash | stash | Stash |
| .kitting | kitting | Kitting |
| .wip | wip | WIP |
| .stitched | stitched | Stitched |
| .atFinishing | at_finishing | At Finishing |
| .finished | finished | Finished |

### Status Badge Colors

| Status | Color |
|--------|-------|
| Stash | walnut |
| Kitting | dustyRose |
| WIP | terracotta |
| Stitched | sage |
| At Finishing | dustyRose |
| Finished | sage |

## Navigation & Tabs

4 tabs (unchanged count), room for 1-2 future additions:

| Tab | View | Content |
|-----|------|---------|
| Inventory | ThreadListView | Thread list (unchanged) |
| Stitch Stash | StashListView | Default: `stash` only. Toggle: all pieces |
| Projects | ProjectListView | Segmented: Active / Finished |
| Settings | SettingsView | (unchanged) |

## Stash Tab

- Default filter shows only `.stash` items
- Toggle (filter chip or toolbar button) to show "All Canvases" — displays pieces in any state, with status badges on non-stash items
- "Add Canvas" creates a `StitchPiece` with `.stash` status
- Each row: thumbnail, design name, designer, mesh count (+ status badge when showing all)
- Detail view: full canvas info + **"Start Project"** button → moves to `.kitting`

## Projects Tab

- **Segmented control** at top: `Active` | `Finished`
- **Active segment** shows pieces grouped by status sections: Kitting → WIP → Stitched → At Finishing
- **Finished segment** shows completed pieces (gallery/trophy case)
- **"+" button** opens a picker to select a stash canvas → moves it to `.kitting`
- Each row: thumbnail, design name, designer, status badge

## Project Detail View

- Canvas image, info section, journal entries (same as today)
- **Primary action button** advances one step forward:
  - Kitting → "Start Stitching"
  - WIP → "Mark Stitched" (sets `stitchedAt`)
  - Stitched → "Send to Finishing" (sets `finishingAt`)
  - At Finishing → "Mark Finished" (sets `completedAt`)
  - Finished → no primary button
- **Status badge is tappable** → opens Change Status sheet with all 6 states (for correcting mistakes)
- **"Return to Stash"** action in `···` menu — distinct from status correction:
  - Resets status to `.stash`
  - Clears project timestamps (startedAt, stitchedAt, finishingAt, completedAt)
  - Journal entries are preserved (work done is still tracked)

## Starting a Project (Stash → Kitting)

Two entry points:

1. **From Stash detail:** "Start Project" button on canvas detail view
2. **From Projects tab:** "+" button opens picker to select a stash canvas

Both set status to `.kitting` and `startedAt = now`.

## API Changes

### Database

- **Drop and recreate database** (no users, no data to preserve)
- **Compact all migrations** into a fresh schema
- New `piece_status` PostgreSQL enum: `stash`, `kitting`, `wip`, `stitched`, `at_finishing`, `finished`
- New `stitch_pieces` table replaces both `canvases` and `projects`
- `journal_entries.project_id` → `journal_entries.piece_id` (references `stitch_pieces`)
- `journal_images` unchanged (still references `journal_entries`)

### Routes

- `POST /pieces` — create piece (replaces canvas + project creation)
- `PUT /pieces/:id` — update piece fields
- `PUT /pieces/:id/status` — advance status (primary forward action)
- `PUT /pieces/:id/status/set` — set arbitrary status (for corrections)
- `PUT /pieces/:id/shelve` — return to stash (clears timestamps)
- `DELETE /pieces/:id` — soft delete
- `POST /pieces/:id/image` — upload piece image
- Journal entry routes: change `project_id` references to `piece_id`

### Sync

- Sync payload includes `stitch_pieces` instead of separate `canvases` + `projects`
- Same last-write-wins protocol, just fewer entity types

## What Stays the Same

- Thread inventory (completely unchanged)
- Journal entries and images (re-parented from project to piece)
- Image upload, caching, PendingUpload mechanism
- Sync protocol (field changes, last-write-wins)
- Settings tab
- Design system tokens and components (updated, not replaced)

## Files Affected

### iOS — Delete
- `Models/StashCanvas.swift`
- `Models/StitchProject.swift`
- `Models/ProjectStatus.swift`
- `Views/StartProjectView.swift`
- `ViewModels/StashListViewModel.swift` (merge into unified VM or rewrite)
- `ViewModels/ProjectListViewModel.swift` (merge into unified VM or rewrite)

### iOS — Create
- `Models/StitchPiece.swift`
- `Models/PieceStatus.swift`

### iOS — Modify
- `Views/ContentView.swift` — update navigation destinations
- `Views/StashListView.swift` — query StitchPiece, add "show all" toggle
- `Views/ProjectListView.swift` — query StitchPiece, add segmented control
- `Views/ProjectDetailView.swift` — use StitchPiece, new status actions
- `Views/CanvasDetailView.swift` — use StitchPiece, add "Start Project" button
- `Views/AddCanvasView.swift` — create StitchPiece instead of StashCanvas
- `Views/EditCanvasView.swift` — edit StitchPiece
- `Views/AddJournalEntryView.swift` — reference StitchPiece
- `DesignSystem/Components/ProjectStatusBadge.swift` — PieceStatus enum, 6 states
- `DesignSystem/Components/CanvasThumbnail.swift` — no change (uses imageKey)
- `stitchuationApp.swift` — update ModelContainer
- `Services/SyncEngine.swift` — sync StitchPiece instead of canvas + project
- Tests — update all model/view tests

### API — Modify
- `src/db/schema.ts` — new enum + stitch_pieces table, drop canvases + projects
- `src/projects/` → `src/pieces/` — rename and rewrite service + routes
- `src/canvases/` — delete (merged into pieces)
- `src/sync/` — update sync handler for new entity
- `tests/` — update all tests
- Drizzle migrations — drop all, regenerate fresh
