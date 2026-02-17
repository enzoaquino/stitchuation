# Needlepoint Design System

**Aesthetic direction:** Warm & Refined — like a beautiful craft book or high-end stationery. The app should feel considered, tactile, and elevated. It reflects the artistry of needlepoint itself.

**Guiding metaphor:** A linen-bound craft journal with gilt-edged pages. Warm, not cold. Textured, not flat. Intentional, not generic.

---

## Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `linen` | `#F5F0E8` | Primary background — warm off-white like linen canvas |
| `parchment` | `#EDE6D8` | Secondary background — cards, grouped sections |
| `cream` | `#FAF7F2` | Elevated surfaces — sheets, modals |
| `espresso` | `#3B2F2F` | Primary text — warm dark brown, not harsh black |
| `walnut` | `#5C4A3D` | Secondary text — muted brown |
| `clay` | `#8B7355` | Tertiary text — captions, timestamps |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `terracotta` | `#C4704B` | Primary accent — buttons, active states, links |
| `terracottaLight` | `#D4896A` | Hover/pressed states |
| `terracottaMuted` | `#E8C4B0` | Subtle accent backgrounds, badges |
| `sage` | `#7A8B6F` | Success states, "ready" indicators, quantity available |
| `dustyRose` | `#C4919B` | Warnings, "partial" indicators |
| `slate` | `#8B8589` | Neutral accents, borders |

### Semantic Colors

| Token | Usage |
|-------|-------|
| `readyGreen` → `sage` | Section has all threads — ready to stitch |
| `partialAmber` → `dustyRose` | Section has some threads — partially ready |
| `needsRed` → `terracotta` | Section missing threads — needs shopping |

### Dark Mode

Dark mode inverts warmly — not pure black, but deep warm tones:

| Token | Light | Dark |
|-------|-------|------|
| `background` | `#F5F0E8` (linen) | `#2A2320` (dark walnut) |
| `surface` | `#EDE6D8` (parchment) | `#362F29` (warm charcoal) |
| `elevated` | `#FAF7F2` (cream) | `#403733` (medium walnut) |
| `textPrimary` | `#3B2F2F` (espresso) | `#F0E8DC` (warm cream) |
| `textSecondary` | `#5C4A3D` (walnut) | `#C4B8A8` (light clay) |
| `accent` | `#C4704B` (terracotta) | `#D4896A` (terracotta light) |

---

## Typography

### Font Choices

**Display / Headers:** `Playfair Display` (serif)
- Elegant, high-contrast serif with a literary quality
- Used for screen titles, section headers, the app name
- Available via Google Fonts, can be bundled with the app
- Weights: Regular (400), SemiBold (600), Bold (700)

**Body / UI:** `Source Serif 4` (serif)
- Highly legible serif designed for reading
- Warmer and more refined than system sans-serif
- Used for all body text, form labels, list items
- Weights: Regular (400), Medium (500), SemiBold (600)

**Monospace / Data:** `SF Mono` (system)
- For thread numbers, quantities, barcodes — data that benefits from monospace
- Uses the native iOS system monospace for performance

### Type Scale

| Style | Font | Size | Weight | Tracking | Usage |
|-------|------|------|--------|----------|-------|
| `largeTitle` | Playfair Display | 34pt | Bold | -0.5 | Screen titles |
| `title` | Playfair Display | 28pt | SemiBold | -0.3 | Section headers |
| `title2` | Playfair Display | 22pt | SemiBold | -0.2 | Sub-section headers |
| `title3` | Source Serif 4 | 20pt | SemiBold | 0 | Card titles |
| `headline` | Source Serif 4 | 17pt | SemiBold | 0 | List item primary text |
| `body` | Source Serif 4 | 17pt | Regular | 0 | Body text, descriptions |
| `callout` | Source Serif 4 | 16pt | Regular | 0 | Secondary descriptions |
| `subheadline` | Source Serif 4 | 15pt | Regular | 0 | Metadata, captions |
| `footnote` | Source Serif 4 | 13pt | Regular | 0 | Timestamps, fine print |
| `data` | SF Mono | 17pt | Medium | 0.5 | Thread numbers, quantities |

---

## Spacing & Layout

### Spacing Scale

Based on a 4pt grid:

| Token | Value | Usage |
|-------|-------|-------|
| `xxs` | 2pt | Tight spacing between related elements |
| `xs` | 4pt | Icon-to-text gaps |
| `sm` | 8pt | Compact padding, inline spacing |
| `md` | 12pt | Standard list item padding |
| `lg` | 16pt | Section padding, card padding |
| `xl` | 24pt | Section gaps |
| `xxl` | 32pt | Screen-level vertical rhythm |
| `xxxl` | 48pt | Major section breaks |

### Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `subtle` | 6pt | Buttons, text fields |
| `card` | 12pt | Cards, sheets |
| `modal` | 16pt | Modals, popovers |
| `circle` | 9999pt | Color swatches, avatars |

### Shadows

Warm-toned shadows, not cool gray:

| Token | Value | Usage |
|-------|-------|-------|
| `subtle` | `0 1pt 3pt rgba(59, 47, 47, 0.08)` | Cards at rest |
| `elevated` | `0 4pt 12pt rgba(59, 47, 47, 0.12)` | Cards on hover/press, sheets |
| `floating` | `0 8pt 24pt rgba(59, 47, 47, 0.16)` | Modals, popovers |

---

## Component Patterns

### Thread Color Swatch

The most distinctive UI element — a small circle showing the thread color.

```
┌──────────────────────────────────────────┐
│  ●  DMC 310                         3 ▼ │
│     Black · Cotton                       │
└──────────────────────────────────────────┘
```

- Circle: 24pt diameter, `circle` corner radius
- Fill: the thread's `colorHex` value
- Border: 1pt `slate` border (so white threads are visible)
- When no `colorHex`: show a subtle `?` icon or crosshatch pattern

### Thread List Row

```
┌──────────────────────────────────────────────┐
│                                              │
│  ●  DMC 310                        [-] 3 [+]│
│     Black · Cotton                           │
│                                              │
└──────────────────────────────────────────────┘
```

- Left: color swatch (24pt circle)
- Center: brand + number (headline), color name + fiber type (subheadline, walnut color)
- Right: quantity stepper — number in `data` style (SF Mono, monospaced digit)
- Row background: `cream` on `linen` background
- Divider: 0.5pt `parchment` line, inset from left edge
- Tap target: entire row navigates to detail
- Stepper: `-` and `+` buttons in `terracotta`, compact circular buttons

### Add Thread Form

- Grouped form sections on `parchment` background
- Section headers in `title3` (Playfair Display)
- Text fields with `subtle` corner radius, `cream` background, `espresso` text
- Brand field shows recent entries as suggestion chips below the field
- "Save" button: full-width, `terracotta` background, `cream` text, `subtle` radius
- "Add Another" toggle uses `terracotta` accent color

### Project Readiness Card

```
┌──────────────────────────────────────┐
│  Christmas Stocking                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░  75%│
│                                      │
│  ● Border           Ready            │
│  ● Center Motif     Need 3 threads   │
│  ● Background       Ready            │
└──────────────────────────────────────┘
```

- Card background: `cream` with `subtle` shadow
- Progress bar: `sage` fill on `parchment` track, `subtle` radius
- Section indicators: `sage` dot = ready, `dustyRose` dot = partial, `terracotta` dot = needs threads
- Section text: `headline` weight for name, `callout` for status in semantic color

### Navigation

**iPhone — Tab Bar:**
- Background: `cream` with `subtle` shadow on top edge
- Active icon + label: `terracotta`
- Inactive icon + label: `clay`
- Icons: SF Symbols with `.regular` weight

**iPad — Sidebar:**
- Background: `parchment`
- Selected row: `terracottaMuted` background, `terracotta` text
- Unselected row: `walnut` text
- Section headers: `title3` in `clay`

### Empty States

When a list is empty, show a warm, encouraging illustration area:
- Centered layout with generous vertical padding (`xxxl`)
- A subtle illustration or SF Symbol in `clay` color, 48pt
- Title in `title2`: "No threads yet"
- Body text in `body`, `walnut`: "Tap + to add your first thread"
- Optional: a warm CTA button in `terracotta`

---

## Iconography

Use SF Symbols throughout for native iOS feel:
- `tray.full` — Inventory tab
- `folder` — Projects tab
- `gear` — Settings tab
- `plus` — Add actions
- `minus` — Decrease quantity
- `barcode.viewfinder` — Scan barcode (future)
- `checkmark.circle.fill` — Section complete
- `cart` — Shopping list / need to buy
- `arrow.triangle.2.circlepath` — Sync status

Symbol weight: `.regular` for tab bar, `.medium` for inline actions.
Symbol rendering: `.hierarchical` with `terracotta` as primary color.

---

## Motion & Micro-interactions

### Principles
- Motion should feel **organic and unhurried** — like pulling thread through canvas
- Use spring animations with moderate damping (0.7-0.8) for natural feel
- Avoid harsh linear animations

### Specific Animations

| Interaction | Animation |
|-------------|-----------|
| Quantity stepper +/- | Number scales up briefly (1.15x) then settles, 0.2s spring |
| Add thread (save) | Row slides in from bottom with fade, 0.3s spring |
| Delete thread (swipe) | Row slides out left, 0.25s ease-out |
| Tab switch | Cross-fade content, 0.2s ease |
| Sheet presentation | Slide up with spring (damping 0.8), backdrop fades to 50% |
| Pull to refresh | Custom spinner — a simple needle-and-thread animation |
| Sync indicator | Subtle pulsing dot near settings, `terracotta` to `terracottaMuted` |
| Color swatch appear | Scale from 0 to 1 with bounce, 0.3s spring, staggered in lists |

---

## SwiftUI Implementation Notes

### Color Extension

```swift
extension Color {
    static let linen = Color(hex: "#F5F0E8")
    static let parchment = Color(hex: "#EDE6D8")
    static let cream = Color(hex: "#FAF7F2")
    static let espresso = Color(hex: "#3B2F2F")
    static let walnut = Color(hex: "#5C4A3D")
    static let clay = Color(hex: "#8B7355")
    static let terracotta = Color(hex: "#C4704B")
    static let terracottaLight = Color(hex: "#D4896A")
    static let terracottaMuted = Color(hex: "#E8C4B0")
    static let sage = Color(hex: "#7A8B6F")
    static let dustyRose = Color(hex: "#C4919B")
    static let slate = Color(hex: "#8B8589")
}
```

### Custom Font Registration

Bundle `PlayfairDisplay` and `SourceSerif4` font files in the app. Register in `Info.plist` under `UIAppFonts`. Create font helpers:

```swift
extension Font {
    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold: return .custom("PlayfairDisplay-Bold", size: size)
        case .semibold: return .custom("PlayfairDisplay-SemiBold", size: size)
        default: return .custom("PlayfairDisplay-Regular", size: size)
        }
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .semibold: return .custom("SourceSerif4-SemiBold", size: size)
        case .medium: return .custom("SourceSerif4-Medium", size: size)
        default: return .custom("SourceSerif4-Regular", size: size)
        }
    }
}
```

### Adaptive Layout

Use SwiftUI's `@Environment(\.horizontalSizeClass)` to adapt between:
- **Compact** (iPhone): Tab bar, full-width lists, stacked layouts
- **Regular** (iPad): Sidebar, split view, wider cards with more horizontal space

---

## Accessibility

- All colors meet WCAG AA contrast ratios against their intended backgrounds
- `espresso` on `linen`: 8.5:1 (AAA)
- `terracotta` on `cream`: 4.6:1 (AA)
- `walnut` on `linen`: 5.2:1 (AA)
- Color swatches always paired with text labels (never color-only information)
- Support Dynamic Type — all custom fonts scale with user's text size preference
- VoiceOver labels on all interactive elements
- Reduce Motion: disable spring animations, use simple opacity fades
