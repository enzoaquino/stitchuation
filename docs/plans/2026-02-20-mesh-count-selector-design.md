# Mesh Count Chip Selector Design

**Goal:** Replace the plain TextField mesh count input with a chip-row selector for fast one-tap selection of standard needlepoint mesh counts, with a custom fallback.

**Problem:** Mesh count is almost always one of 6 standard values (10, 12, 13, 14, 18, 24), with 13 and 18 being the most common. The current TextField requires keyboard input every time — slow and error-prone for a predictable set of values.

## Design

### Component: `MeshCountPicker`

A reusable SwiftUI view that takes a `Binding<String>` for the mesh count value. Used in both `AddCanvasView` and `EditCanvasView`.

### Layout

Replaces the current `HStack { TextField("Mesh Count") ... }` form row with:

1. **Label**: "Mesh Count" in `.typeStyle(.subheadline)` / `Color.walnut`
2. **Chip row**: Horizontal row of capsule-shaped chips showing standard sizes plus a custom option:
   - `10` `12` `13` `14` `18` `24` `Other`
3. **Custom input**: When "Other" is tapped, a TextField slides in below with `Motion.gentle`, pre-focused with `.numberPad` keyboard and "mesh" suffix

### Chip Visual Design

**Unselected:**
- Background: `Color.linen`
- Border: `Color.clay.opacity(0.3)`, 0.5pt stroke capsule
- Text: number only (e.g., "13"), `.typeStyle(.subheadline)`, `Color.walnut`
- Padding: `Spacing.sm` horizontal, `Spacing.xs` vertical

**Selected:**
- Background: `Color.terracotta`
- Text: `.typeStyle(.subheadline).weight(.medium)`, `Color.cream`
- Animation: `Motion.bouncy` scale 1.0 → 1.05 → 1.0 on tap

**"Other" chip:**
- Same style as number chips but text says "Other"
- When selected: terracotta fill, custom TextField visible below

### State Logic

- Tapping a preset chip → sets meshCount to that value, hides custom TextField
- Tapping "Other" → clears meshCount, shows custom TextField
- Typing in custom field → updates meshCount
- On init (edit mode): if current value matches a preset, that chip is pre-selected; otherwise "Other" is selected with the value in the TextField

### Validation

- Same as current: meshCount must be empty or a positive integer
- Error text shown below custom TextField when invalid (same `.typeStyle(.footnote)` / `Color.terracotta` pattern)

### What stays the same

- `StashCanvas.meshCount: Int?` — model unchanged
- `meshCountValue` / `isMeshCountValid` computed properties — logic unchanged
- `CanvasRowView` display ("18m") — unchanged
- Lives inside the existing "Details" form section

### Files affected

- Create: `DesignSystem/Components/MeshCountPicker.swift`
- Create: `stitchuationTests/MeshCountPickerTests.swift`
- Modify: `Views/AddCanvasView.swift` — replace mesh count HStack with `MeshCountPicker`
- Modify: `Views/EditCanvasView.swift` — replace mesh count HStack with `MeshCountPicker`
