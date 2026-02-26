# Kitting UI Redesign

## Problem

The ProjectDetailView has several visual issues during the kitting phase:

1. **Disconnected cards** — Status badge and info (designer/dates) are in separate cards, breaking visual flow
2. **Embedded List in ScrollView** — Materials section uses `List` inside `ScrollView`, causing height estimation bugs (rows cut off, `minHeight: count * 44` hack)
3. **Redundant progress indicators** — Both "0/3" count and "0%" text shown; percentage adds no new information
4. **No card background on materials** — Materials section bleeds into the linen background, unlike every other section
5. **Cut-off rows** — The fixed height calculation underestimates row heights, truncating material rows

## Design

### Merged Status + Info Card

Combine the status badge card and the info card into a single cream card:

- Top row: `PieceStatusBadge` (left) + advance status button (right)
- Designer name as subtitle
- Date rows (Started, Stitched, etc.) below

### Materials Card

Wrap the materials section in a `Color.cream` card with rounded corners and warm shadow:

- **Replace `List` with `VStack`** — rows size naturally to content, no height hacks
- **Drop "X%" text** — the progress bar + "2/3" count is sufficient
- **Dividers between rows** — `Divider().background(Color.parchment)` between material rows
- **Action buttons inside card** — "Add Material" and "Scan Guide" stay at the bottom of the card

### Delete UX

With `List` removed, swipe-to-delete is replaced by a delete button in the existing edit sheet (`AddMaterialView` when editing a material).

### Files Changed

| File | Change |
|------|--------|
| `ProjectDetailView.swift` | Merge status + info into one card section |
| `MaterialsSection.swift` | Replace `List` with `VStack`, add card wrapper, remove percentage text, remove `.onDelete` |
| `MaterialRowView.swift` | Adjust padding for card context |
| `AddMaterialView.swift` | Add "Delete Material" button when editing |
