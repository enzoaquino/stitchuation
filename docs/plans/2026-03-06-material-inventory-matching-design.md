# Material-to-Inventory Matching Design

Automatically link stitch piece materials to threads in the user's inventory. When a material's brand+code matches a thread's brand+number, auto-set acquired and create a foreign key link.

## Problem

Inventory (NeedleThread) and stitch piece materials (PieceMaterial) are separate systems. Users manually track what they have. When scanning a stitch guide, they get a list of materials but have no way to know which ones they already own without cross-referencing manually.

## Solution

Bidirectional matching between PieceMaterial and NeedleThread:

1. **On material add** (scan or manual): Check inventory for matching threads
2. **On thread add** (to inventory): Check all existing piece materials for matches

## Matching Logic

Fuzzy normalization with single-match-only auto-linking:

- **Fields compared**: `PieceMaterial(brand, code)` ↔ `NeedleThread(brand, number)`
- **Normalization**: Case-insensitive, trim whitespace, strip leading/trailing punctuation
- **Auto-link rule**: Only when exactly one thread matches. If zero or multiple matches, skip (no user prompt — they can manually link later).
- **Only thread-type materials**: Skip matching for beads, accessories, ribbon, other

## On Match

- Set `PieceMaterial.threadId` → matched `NeedleThread.id`
- Set `PieceMaterial.acquired = true`
- Thread stays unchanged in inventory (no quantity deduction, no status change)

## Why No Quantity Deduction

Stitch guides say "1 card of Splendor S1132" — they don't specify how much of the card is consumed. Deducting quantity would be misleading. Users manage their own stock levels.

## Schema Change

Add nullable `threadId` FK to `piece_materials`:

**API** (`apps/api/src/db/schema.ts`):
```typescript
threadId: uuid("thread_id").references(() => threads.id),
```

**iOS** (`PieceMaterial.swift`):
```swift
var threadId: UUID?
```

## Where Matching Runs

**iOS-side only.** Both NeedleThread and PieceMaterial are synced to the device via SwiftData. Matching is a local query — no API involvement needed.

A `MaterialMatcher` utility handles all matching logic:
- `matchMaterials(_:in:)` — given an array of PieceMaterial, find and link inventory matches
- `matchThread(_:in:)` — given a new NeedleThread, find and link unlinked materials across all pieces
- `normalize(_:)` — shared string normalization (lowercase, trim, strip punctuation)

## UI Changes

### Material row (PieceMaterialRow)
- When `threadId != nil`: Show "In your stash" badge/indicator
- Tap could navigate to thread detail (future enhancement)

### Thread detail
- When thread is referenced by any PieceMaterial: Show "Used in: [Piece Name]" section

### Parsed materials review (after stitch guide scan)
- Run matching before display
- Highlight materials that match inventory with a checkmark or "In stash" label

## Bidirectional Flow

```
User scans stitch guide
  → Materials parsed
  → MaterialMatcher.matchMaterials() runs against inventory
  → Matching materials get threadId + acquired=true
  → User sees which ones they already have

User adds thread to inventory
  → MaterialMatcher.matchThread() runs against all unlinked materials
  → Any matching materials get threadId + acquired=true
```

## Manual Unlinking

If a user manually sets `acquired = false` on a linked material, clear the `threadId` as well. This respects user override.
