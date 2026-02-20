# Design Polish — From "Warm Colors" to "Craft Journal"

**Goal:** Address the 10 issues identified in the comprehensive design review, bringing the app from a 5.5/10 functional prototype to a polished experience that matches the design system spec's vision of "a linen-bound craft journal with gilt-edged pages."

**Approach:** Bottom-up — extend design system tokens first, then apply systematically to components and views.

**Scope:** Full sweep of all issues. Shadows + layering for depth (no texture overlays). Pinch-to-zoom for image viewer (no drag-to-dismiss). Settings tab out of scope.

---

## Section 1: Design System Token Extensions

### 1.1 Warm Shadow System

Add `Shadows.swift` with 3 warm-toned levels using espresso-based RGBA:

| Token | Radius | Y-Offset | Opacity | Usage |
|-------|--------|----------|---------|-------|
| `subtle` | 3pt | 1pt | 0.08 | Cards at rest |
| `elevated` | 12pt | 4pt | 0.12 | Pressed cards, sheets |
| `floating` | 24pt | 8pt | 0.16 | Modals, FAB |

Implement as a `View` extension: `.warmShadow(.subtle)`. Color base: espresso `#3B2F2F`.

### 1.2 Semantic Type Scale

Replace all magic font numbers with a `TypeStyle` enum mapping the spec's 10 named styles:

| Style | Font | Size | Weight |
|-------|------|------|--------|
| `largeTitle` | Playfair Display | 34pt | Bold |
| `title` | Playfair Display | 28pt | SemiBold |
| `title2` | Playfair Display | 22pt | SemiBold |
| `title3` | Source Serif 4 | 20pt | SemiBold |
| `headline` | Source Serif 4 | 17pt | SemiBold |
| `body` | Source Serif 4 | 17pt | Regular |
| `callout` | Source Serif 4 | 16pt | Regular |
| `subheadline` | Source Serif 4 | 15pt | Regular |
| `footnote` | Source Serif 4 | 13pt | Regular |
| `data` | SF Mono | 17pt | Medium |

Views call `.font(.typeStyle(.headline))` instead of `.font(.sourceSerif(17, weight: .semibold))`.

### 1.3 SF Mono for Data

Add `.sfMono(_ size: CGFloat, weight:)` to Typography.swift using `.system(size:design:.monospaced)`. Apply to: thread numbers, quantities, mesh counts, barcodes.

### 1.4 Font Registration Fix

Change Typography.swift to map weight variants to specific font file names (`PlayfairDisplay-SemiBold`, `SourceSerif4-Medium`, etc.) instead of relying on `.custom("Family Name").weight()`.

### 1.5 Animation Presets

Add `Motion.swift` with named spring presets:

| Preset | Damping | Response | Usage |
|--------|---------|----------|-------|
| `.gentle` | 0.8 | 0.3 | General transitions, stagger reveals |
| `.bouncy` | 0.65 | 0.25 | Quantity stepper, swatch appear, status change |
| `.quick` | 0.9 | 0.15 | Tab switches, small state changes |

---

## Section 2: Component Polish

### 2.1 List Rows (ThreadRowView, CanvasRowView, ProjectRowView)

Transform from default List cells to card-style rows:
- Cream background with `.warmShadow(.subtle)` and card corner radius
- Quantity stepper buttons become compact terracotta circles
- Number animates with `.bouncy` spring on +/- (scale 1.15x then settle)
- Thread numbers and quantities use SF Mono `.data` style
- Swipe-to-delete behavior unchanged

### 2.2 Empty State Component

Create reusable `EmptyStateView` in DesignSystem/Components:
- 48pt SF Symbol icon in clay color
- Title in Playfair `.title2` (22pt semibold)
- Body text in Source Serif `.body`, walnut color
- Generous vertical padding (xxxl top and bottom)
- Optional terracotta CTA button
- Stagger-fade animation on appear (icon, title, body sequentially with `.gentle`)

Replace all existing bare `Text()` empty states across ThreadListView, StashListView, ProjectListView, and ProjectDetailView journal section.

### 2.3 JournalEntryCard

Add visual hierarchy:
- Date in `.footnote` style (clay, 13pt) — keep current
- Notes in `.body` style (espresso, 17pt) — up from 15pt
- Subtle divider between notes and image grid
- Card gets `.warmShadow(.subtle)`

### 2.4 ProjectStatusBadge

Bump font from 12pt to 13pt. Scale-pulse animation with `.bouncy` on status advance.

### 2.5 CanvasThumbnail Sizing Refactor

Replace fragile `size: .infinity` with a `CanvasThumbnail.Size` enum:
- `.fixed(CGFloat)` — explicit dimension (existing 48pt default)
- `.fill` — fills available space (replaces `.infinity`)

Internal implementation handles frame/clip behavior per case.

---

## Section 3: View Restyling

### 3.1 LoginView

Elevate from utilitarian to branded:
- Large Playfair `.largeTitle` (34pt bold) for "Stitchuation"
- Tagline in Source Serif italic, walnut
- Form fields on parchment backgrounds with subtle corner radius
- Full-width terracotta "Sign In" / "Create Account" button with cream text
- Login/register toggle as terracotta text link (not a Toggle)
- Sign in with Apple button with espresso background
- Stagger-fade animation on load: title, tagline, form fields (`.gentle` with delay)

### 3.2 Form Views (AddThreadView, AddCanvasView, AddJournalEntryView, EditCanvasView)

- Replace default form section backgrounds with parchment
- Apply semantic `.typeStyle()` to all text (replace magic numbers)
- Section headers already Playfair — keep
- Save/Cancel already terracotta — keep

### 3.3 Detail Views (CanvasDetailView, ProjectDetailView)

- Add `.warmShadow(.subtle)` to info sections and cards
- Apply semantic type scale throughout
- ProjectDetailView: warm dividers between journal entry cards

### 3.4 ImageViewerView

- Add `MagnifyGesture` for pinch-to-zoom on each image page
- Double-tap to toggle between fit and 2x zoom
- Enlarge dismiss button from 36pt to 40pt circle
- Keep existing TabView paging and terracotta page indicators

### 3.5 ContentView Tab Bar

- `.tint(Color.terracotta)` already handles active state — keep as-is
- No major restyling (SwiftUI tab customization is limited)

### 3.6 Settings Tab

Out of scope — placeholder that needs its own feature design pass.

---

## Section 4: Motion & Micro-interactions

Applied as the final layer across the app:

| Interaction | Animation | Preset |
|---|---|---|
| Quantity stepper +/- | Number scales 1.15x then settles | `.bouncy` |
| List row appear | Fade + slight upward slide, staggered by index | `.gentle` |
| Empty state appear | Sequential stagger: icon, title, body | `.gentle` |
| Login form load | Sequential stagger: title, tagline, fields | `.gentle` |
| Sheet presentation | Default SwiftUI spring | System |
| Tab switch | Default SwiftUI cross-fade | System |
| Status badge change | Scale pulse on advance | `.bouncy` |
| Journal image grid | Fade-in as images load | Keep existing |

Implementation: `Motion` presets as `Animation` extensions. Most use `.animation()` or `withAnimation()` with named presets. Stagger uses incremental delays per element.

---

## Success Criteria

- Every font size in the codebase uses `TypeStyle` semantic names (zero magic numbers)
- Every card and elevated surface has a warm shadow
- Thread numbers and quantities render in SF Mono
- Quantity stepper animates on tap
- Empty states use the reusable component with icon + stagger animation
- LoginView feels like a branded landing page, not a form
- ImageViewer supports pinch-to-zoom
- `CanvasThumbnail` uses the `.fill` enum case, not `.infinity`
