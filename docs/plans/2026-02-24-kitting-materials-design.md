# Kitting Materials List — Design

## Goal

Allow users to manage a materials list for pieces in kitting (and later) status. Materials can be entered manually or imported by scanning a photo of a stitch guide's "Fibers" section using on-device OCR.

## Architecture

A new `PieceMaterial` entity belongs to `StitchPiece`. Each material has a `materialType` discriminator (thread, bead, accessory, other) to future-proof for inventory linking. OCR uses Apple Vision's `VNRecognizeTextRequest` with brand-aware heuristic parsing to extract structured fields from stitch guide photos. Materials are standalone checklists now — no link to thread inventory yet.

## Data Model

### `PieceMaterial`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `pieceId` | UUID (FK) | Parent piece |
| `userId` | UUID (FK) | Owner (API only, for sync auth) |
| `materialType` | enum | `thread`, `bead`, `accessory`, `other` |
| `brand` | String? | e.g. "Splendor", "DMC", "Sundance Beads" |
| `name` | String | e.g. "Dark Green", "Beading Needle & Clear Thread" |
| `code` | String? | e.g. "S832", "F511", "#424" |
| `quantity` | Int | Default 1 |
| `unit` | String? | e.g. "Card", "Spool", "Tube", "Strands" |
| `notes` | String? | e.g. "for 18 ct", "Alternative: River Silks 4mm" |
| `acquired` | Bool | Checklist toggle, default false |
| `sortOrder` | Int | Display order, default 0 |
| `createdAt` | Date | |
| `updatedAt` | Date | |
| `deletedAt` | Date? | Soft delete |
| `syncedAt` | Date? | iOS only, local sync tracking |

### `MaterialType` enum

```
thread | bead | accessory | other
```

### Relationships

- `StitchPiece` → `[PieceMaterial]` (one-to-many, cascade delete)
- iOS: `@Relationship(deleteRule: .cascade, inverse: \PieceMaterial.piece)`

## OCR & Parsing Pipeline

### Flow

1. **Capture**: User takes photo or picks from library (reuse CameraView + PhotosPicker)
2. **OCR**: `VNRecognizeTextRequest` with `.accurate` recognition level
3. **Line extraction**: Group observations by Y-coordinate proximity. Filter headers ("Fibers:", "Stitches:") and blank lines.
4. **Structured parsing** per line using brand-aware heuristics
5. **Review UI**: Editable list of parsed results. User confirms/edits before saving.

### Parsing Strategy

**Known brand patterns** (expandable dictionary):

| Brand | Code Pattern | Material Type |
|-------|-------------|---------------|
| Splendor | `S\d+` | thread |
| Flair | `F\d+` | thread |
| Neon Rays | `N\d+` | thread |
| DMC | `\d{3,4}` | thread |
| Silk Lamé Braid | `SL\d+` | thread |
| Radiance | `J\d+` | thread |
| Petite Very Velvet | `V\d+` | thread |
| Sundance Beads | `#\d+` | bead |
| Kreinik | `\d+` | thread |
| Rainbow Gallery | varies | thread |

**Generic fallback parser**: Split on ` - ` delimiter.
- First segment → brand
- Middle segments → name/color (extract parenthesized code)
- Last segment → quantity + unit (pattern: `\d+\s+\w+`)

**Quantity extraction**: Match `(\d+)\s*(Card|Cards|Spool|Spools|Tube|Tubes|Strand|Strands|Skein|Skeins|Hank|Hanks)` (case-insensitive).

**Code extraction**: Match `\(([A-Z]*\d+[A-Z]*)\)` or `#(\d+)` within a line.

**Classification**: If brand matches known thread/bead brand → use that type. Keywords like "bead", "needle", "thread" (generic) → classify accordingly. Default: `other`.

## UI Design

### ProjectDetailView — Materials Section

Visible for all project statuses (kitting through finished). Hidden for stash.

```
┌─────────────────────────────────────────┐
│  Materials                    3/12 ✓    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░  25%  │
│                                         │
│  ☐ Splendor · Dark Green (S832)  1 Card │
│  ☑ Flair · Antique Mauve (F511)  1 Card │
│  ☐ Neon Rays · Emerald (N38)    1 Card  │
│  ...                                    │
│                                         │
│  [+ Add Material]  [📷 Scan Guide]      │
└─────────────────────────────────────────┘
```

- Progress bar: `sage` fill for acquired ratio on `parchment` track
- Rows: checkbox toggle for `acquired`, brand · name (code), quantity+unit
- Acquired rows: strike-through text in `clay` color
- Swipe-to-delete on rows
- Tap row → edit sheet

### New Views

1. **`MaterialsSection`** — Card in ProjectDetailView with progress bar, material list, and action buttons
2. **`MaterialRowView`** — Single row: checkbox + brand · name (code) + quantity/unit
3. **`AddMaterialView`** — Form sheet: materialType picker, brand, name, code, quantity, unit, notes
4. **`ScanMaterialsView`** — Camera/photo picker → processing indicator → results
5. **`ParsedMaterialsReviewView`** — Editable list of parsed OCR results with save/discard

### Empty State

```
┌─────────────────────────────────────────┐
│  Materials                              │
│                                         │
│  🧵 No materials yet                    │
│  Add supplies manually or scan          │
│  your stitch guide                      │
│                                         │
│  [+ Add Material]  [📷 Scan Guide]      │
└─────────────────────────────────────────┘
```

## API Endpoints

All under `/pieces/:id/materials`, requiring auth.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pieces/:id/materials` | List materials for a piece |
| `POST` | `/pieces/:id/materials` | Add a single material |
| `POST` | `/pieces/:id/materials/batch` | Add multiple materials (OCR import) |
| `PUT` | `/pieces/:id/materials/:materialId` | Update a material |
| `DELETE` | `/pieces/:id/materials/:materialId` | Soft delete a material |

### Validation Schemas

**createMaterialSchema**: `name` required (min 1, max 200). `brand`, `code`, `unit`, `notes` optional strings. `quantity` optional int (default 1). `materialType` optional enum (default `other`). `acquired` optional bool (default false).

**updateMaterialSchema**: All fields optional, at least one required.

**batchCreateMaterialsSchema**: Array of createMaterialSchema items, max 50.

## Sync

Add `pieceMaterial` as a new change type in sync service.

**Allowlisted fields for sync**: `materialType`, `brand`, `name`, `code`, `quantity`, `unit`, `notes`, `acquired`, `sortOrder`.

**Insert**: Requires valid `pieceId` (UUID, must belong to user). Same pattern as journal entries.

**Update**: `pieceId` stripped from updates (no re-parenting). Same pattern as journal entries.

**Delete**: Soft delete with `deletedAt`. Same last-write-wins pattern.

### Database

New `piece_materials` table. New `material_type` pgEnum with values `thread`, `bead`, `accessory`, `other`.

Indexes: `(userId, updatedAt)` for sync queries, `(pieceId)` for listing.

## Edge Cases

- **OCR garbage**: Review step lets users fix/delete before saving. No auto-save.
- **Rotated photos**: Vision handles rotation via image orientation metadata.
- **Duplicate materials**: Not enforced. Stitch guides sometimes list the same thread for different sections.
- **Soft-delete cascade**: Materials soft-deleted when parent piece is deleted (both CanvasDetailView and ProjectDetailView delete handlers).
- **Empty list**: Show encouraging empty state with both add methods.
- **Non-kitting pieces**: Materials section hidden for stash. Visible for kitting through finished.

## Future Enhancements (Out of Scope)

- **Inventory linking**: Match `materialType == .thread` materials against NeedleThread inventory. Show "Have" / "Need to buy" readiness.
- **Shopping list**: Aggregate un-acquired materials across all kitting projects.
- **Section grouping**: Group materials by section (e.g. "Background", "Border") matching the planned ProjectSection model.
- **Barcode scanning**: Scan thread labels to auto-fill brand/number/color.
