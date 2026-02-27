# Add Canvas View Redesign

## Problem

The Add Canvas view uses a standard iOS Form that feels generic and doesn't match the app's "warm craft journal" personality. Specific issues:
- Mesh count chips are small capsule pills that look like Material Design filter chips
- Photo placeholder is a lifeless parchment box
- Form layout makes every section look the same weight
- "Add Another" toggle floats without visual context

## Design: Craft Journal Page

### Overall Layout

Replace `Form` with `ScrollView` + `VStack(spacing: Spacing.xl)` containing distinct cream cards for each section. Same visual pattern as ProjectDetailView and MaterialsSection.

### Photo Zone

Empty state: dashed-border rectangle on the linen background (not inside a card).
- Dashed border: `Color.clay.opacity(0.4)`, 8pt dash pattern
- Inside: `photo.badge.plus` icon (40pt) in terracotta + "Add Photo" text in walnut
- Height: 180pt

With photo: fills the zone edge-to-edge, `scaledToFill`, clipped to `CornerRadius.card`, warm shadow.

### Mesh Count Tiles

Replace capsule chips with square swatch tiles (44x44pt, `CornerRadius.subtle`) to evoke picking a fabric sample:
- Unselected: `Color.linen` fill, 1pt `Color.slate.opacity(0.3)` border, walnut text
- Selected: `Color.terracotta` fill, white text, `warmShadow(.subtle)`, 1.05x scale spring
- "Other": wider rectangle, same height, same style treatment
- Numbers on first row, "Other" can flow naturally

### Input Cards

Each section wrapped in a cream card:
- `Color.cream` background, `CornerRadius.card`, `warmShadow(.subtle)`
- Section header as first element inside card (Playfair 15pt semibold, walnut)
- Text fields separated by parchment dividers
- Toggle tinted terracotta

### "Add Another" Banner

Styled card with `terracottaMuted.opacity(0.3)` background:
- HStack: repeat icon in clay + "Add Another" text in walnut + terracotta-tinted toggle
- Gives visual presence as a distinct action zone

### EditCanvasView

Apply same card layout treatment for consistency (minus photo section and Add Another).

## Files Changed

| File | Change |
|------|--------|
| `AddCanvasView.swift` | Full rewrite: Form to ScrollView + cards, new photo zone, styled banner |
| `MeshCountPicker.swift` | Capsule chips to square swatch tiles (44x44pt), larger touch targets |
| `EditCanvasView.swift` | Form to ScrollView + cards (same treatment, minus photo/Add Another) |
