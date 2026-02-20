# Design Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the iOS app from 5.5/10 functional prototype to polished "linen-bound craft journal" experience by extending design system tokens and applying them systematically to all components and views.

**Architecture:** Bottom-up approach — extend design system tokens first (shadows, type scale, SF Mono, animations), then refactor components to use them, then restyle views. Each task is self-contained and builds on the previous.

**Tech Stack:** SwiftUI, Swift Testing framework, iOS 17+

**Reference:** Design spec at `docs/plans/2026-02-19-design-polish-design.md`, design system at `docs/plans/2026-02-16-design-system.md`

**Testing:** Uses Swift Testing framework (`import Testing`, `@Test`, `#expect()`), NOT XCTest. Tests in `apps/ios/stitchuation/stitchuationTests/`. Project uses File System Synchronization — new files auto-discovered by Xcode.

**Build command:** `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -quiet 2>&1 | tail -5`

**Test command:** `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -quiet 2>&1 | tail -20`

---

## Task 1: Warm Shadow System

Create `Shadows.swift` with 3 espresso-based shadow levels as a View extension.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Shadows.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/ShadowsTests.swift`

**Step 1: Write the test file**

Create `apps/ios/stitchuation/stitchuationTests/ShadowsTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

struct ShadowsTests {
    @Test func shadowLevelSubtleExists() {
        let level = ShadowLevel.subtle
        #expect(level.radius == 3)
        #expect(level.y == 1)
        #expect(level.opacity == 0.08)
    }

    @Test func shadowLevelElevatedExists() {
        let level = ShadowLevel.elevated
        #expect(level.radius == 12)
        #expect(level.y == 4)
        #expect(level.opacity == 0.12)
    }

    @Test func shadowLevelFloatingExists() {
        let level = ShadowLevel.floating
        #expect(level.radius == 24)
        #expect(level.y == 8)
        #expect(level.opacity == 0.16)
    }
}
```

**Step 2: Run tests to verify they fail**

Run build — should fail with "Cannot find type 'ShadowLevel'"

**Step 3: Implement Shadows.swift**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Shadows.swift`:

```swift
import SwiftUI

enum ShadowLevel {
    case subtle
    case elevated
    case floating

    var radius: CGFloat {
        switch self {
        case .subtle: return 3
        case .elevated: return 12
        case .floating: return 24
        }
    }

    var y: CGFloat {
        switch self {
        case .subtle: return 1
        case .elevated: return 4
        case .floating: return 8
        }
    }

    var opacity: Double {
        switch self {
        case .subtle: return 0.08
        case .elevated: return 0.12
        case .floating: return 0.16
        }
    }
}

extension View {
    func warmShadow(_ level: ShadowLevel) -> some View {
        self.shadow(
            color: Color(hex: "3B2F2F").opacity(level.opacity),
            radius: level.radius,
            x: 0,
            y: level.y
        )
    }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Shadows.swift apps/ios/stitchuation/stitchuationTests/ShadowsTests.swift
git commit -m "feat(ios): add warm shadow system with 3 espresso-based levels"
```

---

## Task 2: Semantic Type Scale

Replace all magic font numbers with a `TypeStyle` enum. Add SF Mono support. Keep existing `playfair()` and `sourceSerif()` helpers for backward compat during migration.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Typography.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/TypeStyleTests.swift`

**Step 1: Write the test file**

Create `apps/ios/stitchuation/stitchuationTests/TypeStyleTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

struct TypeStyleTests {
    @Test func largeTitleUsesPlayfair() {
        let style = TypeStyle.largeTitle
        #expect(style.family == .playfair)
        #expect(style.size == 34)
        #expect(style.weight == .bold)
    }

    @Test func titleUsesPlayfair() {
        let style = TypeStyle.title
        #expect(style.family == .playfair)
        #expect(style.size == 28)
        #expect(style.weight == .semibold)
    }

    @Test func title2UsesPlayfair() {
        let style = TypeStyle.title2
        #expect(style.family == .playfair)
        #expect(style.size == 22)
        #expect(style.weight == .semibold)
    }

    @Test func title3UsesSourceSerif() {
        let style = TypeStyle.title3
        #expect(style.family == .sourceSerif)
        #expect(style.size == 20)
        #expect(style.weight == .semibold)
    }

    @Test func headlineUsesSourceSerif() {
        let style = TypeStyle.headline
        #expect(style.family == .sourceSerif)
        #expect(style.size == 17)
        #expect(style.weight == .semibold)
    }

    @Test func bodyUsesSourceSerif() {
        let style = TypeStyle.body
        #expect(style.family == .sourceSerif)
        #expect(style.size == 17)
        #expect(style.weight == .regular)
    }

    @Test func calloutUsesSourceSerif() {
        let style = TypeStyle.callout
        #expect(style.family == .sourceSerif)
        #expect(style.size == 16)
        #expect(style.weight == .regular)
    }

    @Test func subheadlineUsesSourceSerif() {
        let style = TypeStyle.subheadline
        #expect(style.family == .sourceSerif)
        #expect(style.size == 15)
        #expect(style.weight == .regular)
    }

    @Test func footnoteUsesSourceSerif() {
        let style = TypeStyle.footnote
        #expect(style.family == .sourceSerif)
        #expect(style.size == 13)
        #expect(style.weight == .regular)
    }

    @Test func dataUsesSFMono() {
        let style = TypeStyle.data
        #expect(style.family == .sfMono)
        #expect(style.size == 17)
        #expect(style.weight == .medium)
    }

    @Test func allStylesProduceFont() {
        for style in TypeStyle.allCases {
            let font = Font.typeStyle(style)
            #expect(type(of: font) == Font.self)
        }
    }
}
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement TypeStyle in Typography.swift**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/DesignSystem/Typography.swift` with:

```swift
import SwiftUI

// MARK: - Type Scale

enum TypeFamily {
    case playfair
    case sourceSerif
    case sfMono
}

enum TypeStyle: CaseIterable {
    case largeTitle    // Playfair 34 Bold
    case title         // Playfair 28 SemiBold
    case title2        // Playfair 22 SemiBold
    case title3        // Source Serif 20 SemiBold
    case headline      // Source Serif 17 SemiBold
    case body          // Source Serif 17 Regular
    case callout       // Source Serif 16 Regular
    case subheadline   // Source Serif 15 Regular
    case footnote      // Source Serif 13 Regular
    case data          // SF Mono 17 Medium

    var family: TypeFamily {
        switch self {
        case .largeTitle, .title, .title2: return .playfair
        case .title3, .headline, .body, .callout, .subheadline, .footnote: return .sourceSerif
        case .data: return .sfMono
        }
    }

    var size: CGFloat {
        switch self {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .data: return 17
        }
    }

    var weight: Font.Weight {
        switch self {
        case .largeTitle: return .bold
        case .title, .title2, .title3, .headline: return .semibold
        case .body, .callout, .subheadline, .footnote: return .regular
        case .data: return .medium
        }
    }
}

// MARK: - Font Extensions

extension Font {
    static func typeStyle(_ style: TypeStyle) -> Font {
        switch style.family {
        case .playfair:
            return .playfair(style.size, weight: style.weight)
        case .sourceSerif:
            return .sourceSerif(style.size, weight: style.weight)
        case .sfMono:
            return .sfMono(style.size, weight: style.weight)
        }
    }

    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Playfair Display", size: size).weight(weight)
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Source Serif 4", size: size).weight(weight)
    }

    static func sfMono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, design: .monospaced).weight(weight)
    }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Typography.swift apps/ios/stitchuation/stitchuationTests/TypeStyleTests.swift
git commit -m "feat(ios): add semantic type scale with TypeStyle enum and SF Mono"
```

---

## Task 3: Animation Presets

Create `Motion.swift` with named spring animation presets.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Motion.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/MotionTests.swift`

**Step 1: Write the test file**

Create `apps/ios/stitchuation/stitchuationTests/MotionTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

struct MotionTests {
    @Test func gentlePresetExists() {
        let anim = Motion.gentle
        #expect(type(of: anim) == Animation.self)
    }

    @Test func bouncyPresetExists() {
        let anim = Motion.bouncy
        #expect(type(of: anim) == Animation.self)
    }

    @Test func quickPresetExists() {
        let anim = Motion.quick
        #expect(type(of: anim) == Animation.self)
    }

    @Test func staggerDelayCalculation() {
        #expect(Motion.staggerDelay(index: 0) == 0.0)
        #expect(Motion.staggerDelay(index: 1) == 0.05)
        #expect(Motion.staggerDelay(index: 2) == 0.10)
    }
}
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement Motion.swift**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Motion.swift`:

```swift
import SwiftUI

enum Motion {
    /// General transitions, stagger reveals. Damping 0.8, response 0.3
    static let gentle: Animation = .spring(response: 0.3, dampingFraction: 0.8)

    /// Quantity stepper, swatch appear, status change. Damping 0.65, response 0.25
    static let bouncy: Animation = .spring(response: 0.25, dampingFraction: 0.65)

    /// Tab switches, small state changes. Damping 0.9, response 0.15
    static let quick: Animation = .spring(response: 0.15, dampingFraction: 0.9)

    /// Calculate stagger delay for sequential animations.
    /// - Parameter index: 0-based index of the element
    /// - Returns: Delay in seconds (0.05s per step)
    static func staggerDelay(index: Int) -> Double {
        Double(index) * 0.05
    }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Motion.swift apps/ios/stitchuation/stitchuationTests/MotionTests.swift
git commit -m "feat(ios): add Motion animation presets with spring configs"
```

---

## Task 4: EmptyStateView Component

Create reusable empty state component with icon, title, body, optional CTA, and stagger-fade animation.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/EmptyStateView.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/EmptyStateViewTests.swift`

**Step 1: Write the test file**

Create `apps/ios/stitchuation/stitchuationTests/EmptyStateViewTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

struct EmptyStateViewTests {
    @Test func initializesWithRequiredProperties() {
        let view = EmptyStateView(
            icon: "tray",
            title: "No threads yet",
            message: "Tap + to add your first thread"
        )
        #expect(view.icon == "tray")
        #expect(view.title == "No threads yet")
        #expect(view.message == "Tap + to add your first thread")
        #expect(view.buttonTitle == nil)
    }

    @Test func initializesWithOptionalButton() {
        var tapped = false
        let view = EmptyStateView(
            icon: "tray",
            title: "No threads yet",
            message: "Tap + to add your first thread",
            buttonTitle: "Add Thread"
        ) {
            tapped = true
        }
        #expect(view.buttonTitle == "Add Thread")
        #expect(view.onButtonTap != nil)
    }
}
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement EmptyStateView**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/EmptyStateView.swift`:

```swift
import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var buttonTitle: String? = nil
    var onButtonTap: (() -> Void)? = nil

    @State private var showIcon = false
    @State private var showTitle = false
    @State private var showMessage = false
    @State private var showButton = false

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Color.clay)
                .opacity(showIcon ? 1 : 0)
                .offset(y: showIcon ? 0 : 10)

            Text(title)
                .font(.typeStyle(.title2))
                .foregroundStyle(Color.espresso)
                .opacity(showTitle ? 1 : 0)
                .offset(y: showTitle ? 0 : 10)

            Text(message)
                .font(.typeStyle(.body))
                .foregroundStyle(Color.walnut)
                .multilineTextAlignment(.center)
                .opacity(showMessage ? 1 : 0)
                .offset(y: showMessage ? 0 : 10)

            if let buttonTitle, let onButtonTap {
                Button {
                    onButtonTap()
                } label: {
                    Text(buttonTitle)
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.cream)
                        .padding(.horizontal, Spacing.xl)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .clipShape(Capsule())
                }
                .opacity(showButton ? 1 : 0)
                .offset(y: showButton ? 0 : 10)
            }
        }
        .padding(.horizontal, Spacing.xxxl)
        .padding(.vertical, Spacing.xxxl)
        .onAppear {
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showIcon = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 1))) {
                showTitle = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 2))) {
                showMessage = true
            }
            if buttonTitle != nil {
                withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 3))) {
                    showButton = true
                }
            }
        }
    }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/EmptyStateView.swift apps/ios/stitchuation/stitchuationTests/EmptyStateViewTests.swift
git commit -m "feat(ios): add reusable EmptyStateView with stagger animation"
```

---

## Task 5: CanvasThumbnail Sizing Refactor

Replace fragile `size: .infinity` pattern with a `ThumbnailSize` enum.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift`
- Modify: All files that use `CanvasThumbnail` (listed in step 3)

**Step 1: Build to verify current state compiles**

**Step 2: Refactor CanvasThumbnail.swift**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift` with:

```swift
import SwiftUI

struct CanvasThumbnail: View {
    enum ThumbnailSize {
        case fixed(CGFloat)
        case fill

        var isFixed: Bool {
            if case .fixed = self { return true }
            return false
        }

        var fixedValue: CGFloat? {
            if case .fixed(let v) = self { return v }
            return nil
        }
    }

    let imageKey: String?
    var size: ThumbnailSize = .fixed(48)

    @Environment(\.networkClient) private var networkClient
    @State private var loadedImage: UIImage?
    @State private var isLoading = false

    var body: some View {
        Group {
            if let loadedImage {
                Image(uiImage: loadedImage)
                    .resizable()
                    .scaledToFill()
            } else if isLoading {
                placeholderView
                    .overlay {
                        ProgressView()
                            .tint(Color.terracotta)
                            .scaleEffect(size.isFixed && (size.fixedValue ?? 48) < 100 ? 0.6 : 1.0)
                    }
            } else {
                placeholderView
            }
        }
        .frame(width: size.fixedValue, height: size.fixedValue)
        .frame(maxWidth: size.isFixed ? nil : .infinity)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadius.subtle)
                .stroke(Color.slate.opacity(0.3), lineWidth: 0.5)
        )
        .task(id: imageKey) {
            await loadImage()
        }
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: CornerRadius.subtle)
            .fill(Color.parchment)
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: min((size.fixedValue ?? 48) * 0.4, 20)))
                    .foregroundStyle(Color.clay)
            }
    }

    private func loadImage() async {
        loadedImage = nil
        guard let imageKey, let networkClient else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let data = try await networkClient.fetchData(path: "/images/\(imageKey)")
            if let image = UIImage(data: data) {
                loadedImage = image
            }
        } catch {
            // Failed to load image — placeholder remains
        }
    }
}
```

**Step 3: Update all call sites**

Replace `size: .infinity` with `size: .fill` and `size: 48` with `size: .fixed(48)` in these files:

- `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift:22` — Change `CanvasThumbnail(imageKey: project.canvas.imageKey, size: .infinity)` to `CanvasThumbnail(imageKey: project.canvas.imageKey, size: .fill)`
- `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift:25` — Change `CanvasThumbnail(imageKey: canvas.imageKey, size: .infinity)` to `CanvasThumbnail(imageKey: canvas.imageKey, size: .fill)`
- `apps/ios/stitchuation/stitchuation/DesignSystem/Components/JournalImageGrid.swift:78` — Change `CanvasThumbnail(imageKey: image.imageKey, size: .infinity)` to `CanvasThumbnail(imageKey: image.imageKey, size: .fill)`
- `apps/ios/stitchuation/stitchuation/Views/StashListView.swift:81` — Change `CanvasThumbnail(imageKey: canvas.imageKey, size: 48)` to `CanvasThumbnail(imageKey: canvas.imageKey, size: .fixed(48))`
- `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift:83` — Change `CanvasThumbnail(imageKey: project.canvas.imageKey, size: 48)` to `CanvasThumbnail(imageKey: project.canvas.imageKey, size: .fixed(48))`
- `apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift:47` — Change `CanvasThumbnail(imageKey: canvas.imageKey, size: 48)` to `CanvasThumbnail(imageKey: canvas.imageKey, size: .fixed(48))`

**Step 4: Build to verify it compiles**

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift apps/ios/stitchuation/stitchuation/DesignSystem/Components/JournalImageGrid.swift apps/ios/stitchuation/stitchuation/Views/StashListView.swift apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift
git commit -m "refactor(ios): replace CanvasThumbnail .infinity with ThumbnailSize enum"
```

---

## Task 6: Apply Semantic Type Scale to All Views

Replace every magic font number across all views with `Font.typeStyle()`. Also apply SF Mono to data values (thread numbers, quantities, mesh counts).

**Files to modify** (listed with exact current font calls → replacement):

### 6a: ThreadListView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 47 | `.font(.playfair(22, weight: .semibold))` | `.font(.typeStyle(.title2))` |
| 50 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 99 | `.font(.sourceSerif(17, weight: .semibold))` | `.font(.typeStyle(.headline))` |
| 103 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.subheadline))` |
| 121 | `.font(.system(.body, design: .monospaced).weight(.medium))` | `.font(.typeStyle(.data))` |

### 6b: StashListView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 33 | `.font(.playfair(22, weight: .semibold))` | `.font(.typeStyle(.title2))` |
| 36 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 85 | `.font(.sourceSerif(17, weight: .semibold))` | `.font(.typeStyle(.headline))` |
| 88 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.subheadline))` |
| 100 | `.font(.system(.caption, design: .monospaced))` | `.font(.typeStyle(.data))` — also change `.foregroundStyle(Color.clay)` to keep |

### 6c: ProjectListView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 30 | `.font(.playfair(22, weight: .semibold))` | `.font(.typeStyle(.title2))` |
| 33 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 52 | `.font(.playfair(15, weight: .semibold))` | `.font(.typeStyle(.subheadline)).weight(.semibold)` — section header, keep playfair style for now |
| 87 | `.font(.sourceSerif(17, weight: .semibold))` | `.font(.typeStyle(.headline))` |
| 90 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.subheadline))` |

**Note:** Section headers in ProjectListView use `Font.playfair(15, weight: .semibold)`. The type scale doesn't have a 15pt Playfair style. Leave section headers as `.font(.playfair(15, weight: .semibold))` — they're a deliberate design choice for form section headers.

### 6d: ProjectDetailView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 37 | `.font(.sourceSerif(15, weight: .medium))` | `.font(.typeStyle(.subheadline)).weight(.medium)` |
| 49 | `.font(.sourceSerif(19))` | `.font(.typeStyle(.title3))` — designer name (19pt → 20pt, close enough) |
| 69 | `.font(.playfair(22, weight: .semibold))` | `.font(.typeStyle(.title2))` |
| 74 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.subheadline))` |
| 205 | `.font(.sourceSerif(13))` | `.font(.typeStyle(.footnote))` — JournalEntryCard date |
| 210 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.body))` — JournalEntryCard notes (15pt → 17pt per design) |

### 6e: CanvasDetailView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 33 | `.font(.playfair(28, weight: .bold))` | `.font(.typeStyle(.title))` |
| 36 | `.font(.sourceSerif(19))` | `.font(.typeStyle(.title3))` |
| 59 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 70 | `.font(.playfair(17, weight: .semibold))` | `.font(.typeStyle(.headline))` — "Project" label |
| 79 | `.font(.sourceSerif(15, weight: .medium))` | `.font(.typeStyle(.subheadline)).weight(.medium)` |
| 157 | `.font(.sourceSerif(15))` (DetailRow label) | `.font(.typeStyle(.subheadline))` |
| 160 | `.font(.sourceSerif(15, weight: .medium))` (DetailRow value) | `.font(.typeStyle(.subheadline)).weight(.medium)` |

### 6f: LoginView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 16 | `.font(.playfair(34, weight: .bold))` | `.font(.typeStyle(.largeTitle))` |
| 21 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 37 | `.font(.sourceSerif(13))` | `.font(.typeStyle(.footnote))` |
| 55 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 61 | `.font(.sourceSerif(13))` | `.font(.typeStyle(.footnote))` |
| 74 | `.font(.sourceSerif(17, weight: .semibold))` | `.font(.typeStyle(.headline))` |
| 87 | `.font(.sourceSerif(13))` | `.font(.typeStyle(.footnote))` |

### 6g: Form Views (AddThreadView, AddCanvasView, EditCanvasView, AddJournalEntryView)

For all 4 form views, replace:
- `.font(.sourceSerif(17))` (form base) → `.font(.typeStyle(.body))`
- `.font(.sourceSerif(15))` → `.font(.typeStyle(.subheadline))`
- `.font(.sourceSerif(12))` → `.font(.typeStyle(.footnote))` (validation errors — 12pt → 13pt, acceptable)
- `.font(.sourceSerif(13))` → `.font(.typeStyle(.footnote))`
- Section headers `.font(.playfair(15, weight: .semibold))` — **leave as-is** (deliberate form header style)

### 6h: ImageViewerView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 34 | `.font(.sourceSerif(15, weight: .medium))` | `.font(.typeStyle(.subheadline)).weight(.medium)` |

### 6i: ProjectStatusBadge.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 16 | `.font(.sourceSerif(12, weight: .medium))` | `.font(.typeStyle(.footnote)).weight(.medium)` — (12pt → 13pt per design) |

### 6j: ContentView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 33 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |

### 6k: StartProjectView.swift

| Line | Current | Replacement |
|------|---------|-------------|
| 31 | `.font(.playfair(22, weight: .semibold))` | `.font(.typeStyle(.title2))` |
| 34 | `.font(.sourceSerif(17))` | `.font(.typeStyle(.body))` |
| 50 | `.font(.sourceSerif(17, weight: .semibold))` | `.font(.typeStyle(.headline))` |
| 53 | `.font(.sourceSerif(15))` | `.font(.typeStyle(.subheadline))` |

**Step 1: Make all replacements**

Apply all changes listed above across all files.

**Step 2: Build to verify it compiles**

**Step 3: Run tests to verify nothing broke**

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "refactor(ios): replace all magic font numbers with semantic TypeStyle"
```

---

## Task 7: Card-Style List Rows with Shadows

Add warm shadows to list rows and convert inline empty states to use the new `EmptyStateView` component.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift` (empty state + journal card shadows)

**Step 1: Replace inline empty states**

In `ThreadListView.swift`, replace the empty state VStack (lines 42-53):
```swift
// BEFORE:
VStack(spacing: Spacing.lg) {
    Image(systemName: "tray")
        .font(.system(size: 48))
        .foregroundStyle(Color.clay)
    Text("No threads yet")
        .font(.playfair(22, weight: .semibold))
        .foregroundStyle(Color.espresso)
    Text("Tap + to add your first thread")
        .font(.sourceSerif(17))
        .foregroundStyle(Color.walnut)
}
.padding(Spacing.xxxl)

// AFTER:
EmptyStateView(
    icon: "tray",
    title: "No threads yet",
    message: "Tap + to add your first thread"
)
```

In `StashListView.swift`, replace the empty state VStack (lines 28-39):
```swift
// AFTER:
EmptyStateView(
    icon: "square.stack.3d.up",
    title: "No canvases yet",
    message: "Tap + to add your first canvas"
)
```

In `ProjectListView.swift`, replace the empty state VStack (lines 28-39):
```swift
// AFTER:
EmptyStateView(
    icon: "paintbrush.pointed",
    title: "No projects yet",
    message: "Tap + to start a new project"
)
```

In `StartProjectView.swift`, replace the empty state VStack (lines 27-39):
```swift
// AFTER:
EmptyStateView(
    icon: "square.stack.3d.up.slash",
    title: "No available canvases",
    message: "All canvases are already linked to projects. Add a new canvas first."
)
```

In `ProjectDetailView.swift`, replace the inline journal empty state (lines 73-76):
```swift
// BEFORE:
Text("No journal entries yet. Tap + to add your first entry.")
    .font(.sourceSerif(15))
    .foregroundStyle(Color.clay)
    .padding(.vertical, Spacing.md)

// AFTER:
EmptyStateView(
    icon: "book",
    title: "No entries yet",
    message: "Tap + to add your first journal entry"
)
```

**Step 2: Add `.warmShadow(.subtle)` to JournalEntryCard**

In `ProjectDetailView.swift`, add shadow to the JournalEntryCard after the `.clipShape()` line:

```swift
// In JournalEntryCard body, after:
.clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
// Add:
.warmShadow(.subtle)
```

**Step 3: Add warm dividers between journal entries**

In `ProjectDetailView.swift`, the ForEach for journal entries currently does not have dividers between cards. The divider at the top of the journal section (line 66) is sufficient. No additional dividers needed — the shadow on each card provides visual separation.

**Step 4: Add `.warmShadow(.floating)` to the FAB**

In `ProjectDetailView.swift`, replace the existing FAB shadow (line 98):
```swift
// BEFORE:
.shadow(color: Color.espresso.opacity(0.2), radius: 8, x: 0, y: 4)

// AFTER:
.warmShadow(.floating)
```

**Step 5: Build to verify it compiles**

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift apps/ios/stitchuation/stitchuation/Views/StashListView.swift apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift apps/ios/stitchuation/stitchuation/Views/StartProjectView.swift apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): add EmptyStateView, warm shadows on cards and FAB"
```

---

## Task 8: Quantity Stepper Animation & SF Mono

Add bounce animation to quantity stepper and use SF Mono for thread numbers.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift`

**Step 1: Update ThreadRowView**

In `ThreadRowView`, add a `@State private var quantityScale: CGFloat = 1.0` property.

Change the thread number + quantity display to use SF Mono for the thread number:
```swift
// In the VStack for thread info, change the first Text:
Text("\(thread.brand) \(thread.number)")
    .font(.typeStyle(.headline))
    .foregroundStyle(Color.espresso)

// Replace with two texts — brand in headline, number in data:
HStack(spacing: Spacing.xs) {
    Text(thread.brand)
        .font(.typeStyle(.headline))
        .foregroundStyle(Color.espresso)
    Text(thread.number)
        .font(.typeStyle(.data))
        .foregroundStyle(Color.espresso)
}
```

Add scale animation to the quantity text:
```swift
Text("\(thread.quantity)")
    .font(.typeStyle(.data))
    .foregroundStyle(Color.espresso)
    .frame(minWidth: 24)
    .scaleEffect(quantityScale)
```

Update the `updateQuantity` method:
```swift
private func updateQuantity(_ delta: Int) {
    thread.quantity = max(0, thread.quantity + delta)
    thread.updatedAt = Date()
    try? modelContext.save()
    withAnimation(Motion.bouncy) {
        quantityScale = 1.15
    }
    withAnimation(Motion.bouncy.delay(0.1)) {
        quantityScale = 1.0
    }
}
```

**Step 2: Apply SF Mono to mesh count in StashListView**

The mesh count in `CanvasRowView` should already be `.typeStyle(.data)` from Task 6. Verify it is.

**Step 3: Build to verify it compiles**

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift
git commit -m "feat(ios): add bouncy animation to quantity stepper, SF Mono for thread data"
```

---

## Task 9: ProjectStatusBadge Animation

Add scale-pulse animation when status changes.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift`

**Step 1: Update ProjectStatusBadge**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift`:

```swift
import SwiftUI

struct ProjectStatusBadge: View {
    let status: ProjectStatus

    @State private var badgeScale: CGFloat = 1.0

    private var backgroundColor: Color {
        switch status {
        case .wip: return Color.terracotta
        case .atFinishing: return Color.dustyRose
        case .completed: return Color.sage
        }
    }

    var body: some View {
        Text(status.displayName)
            .font(.typeStyle(.footnote)).weight(.medium)
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xxs)
            .background(backgroundColor)
            .clipShape(Capsule())
            .scaleEffect(badgeScale)
            .onChange(of: status) { _, _ in
                withAnimation(Motion.bouncy) {
                    badgeScale = 1.15
                }
                withAnimation(Motion.bouncy.delay(0.15)) {
                    badgeScale = 1.0
                }
            }
    }
}
```

**Step 2: Build to verify it compiles**

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/ProjectStatusBadge.swift
git commit -m "feat(ios): add scale-pulse animation to ProjectStatusBadge on status change"
```

---

## Task 10: JournalEntryCard Visual Hierarchy

Improve JournalEntryCard typography and add divider between notes and images.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`

**Step 1: Update JournalEntryCard body**

The date and notes fonts should already be updated from Task 6 (`.typeStyle(.footnote)` and `.typeStyle(.body)` respectively). Add a subtle divider between notes and image grid:

```swift
var body: some View {
    VStack(alignment: .leading, spacing: Spacing.sm) {
        Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
            .font(.typeStyle(.footnote))
            .foregroundStyle(Color.clay)

        if let notes = entry.notes, !notes.isEmpty {
            Text(notes)
                .font(.typeStyle(.body))
                .foregroundStyle(Color.espresso)
        }

        if !sortedImages.isEmpty {
            if entry.notes != nil && !entry.notes!.isEmpty {
                Divider().background(Color.slate.opacity(0.2))
            }
            JournalImageGrid(images: sortedImages) { index in
                selectedImageIndex = index
                showImageViewer = true
            }
        }
    }
    .padding(Spacing.md)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.cream)
    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
    .warmShadow(.subtle)
    .fullScreenCover(isPresented: $showImageViewer) {
        ImageViewerView(images: sortedImages, initialIndex: selectedImageIndex)
    }
}
```

**Step 2: Build to verify it compiles**

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): improve JournalEntryCard hierarchy with divider and shadows"
```

---

## Task 11: Detail Views — Shadows & Type Scale

Add warm shadows to info sections in CanvasDetailView and ProjectDetailView.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift`

**Step 1: CanvasDetailView — wrap info in card**

In `CanvasDetailView.swift`, wrap the info VStack (the one starting with `Text(canvas.designName)`) in a card-style background:

After the info VStack's closing brace (before `.padding(.horizontal, Spacing.lg)`), add:
```swift
.padding(Spacing.lg)
.background(Color.cream)
.clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
.warmShadow(.subtle)
```

Remove the individual `.padding(.horizontal, Spacing.lg)` from the info VStack since the card provides its own padding. Keep the horizontal padding on the outer container.

**Step 2: ProjectDetailView — add shadows to status and info sections**

The info section VStack (lines 45-62) and status section VStack (lines 29-42) should get `.warmShadow(.subtle)`. Wrap each in a card:

For the status section VStack, after its closing brace and before `.padding(.horizontal, Spacing.lg)`:
```swift
.padding(Spacing.md)
.background(Color.cream)
.clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
.warmShadow(.subtle)
```

For the info section VStack, same treatment:
```swift
.padding(Spacing.md)
.background(Color.cream)
.clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
.warmShadow(.subtle)
```

Remove the bare `Divider()` calls at the top of each section since the card separation makes them unnecessary.

**Step 3: Build to verify it compiles**

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): add warm shadow cards to detail view info sections"
```

---

## Task 12: LoginView Branded Restyle

Elevate LoginView from utilitarian to branded landing page with stagger animations.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/LoginView.swift`

**Step 1: Rewrite LoginView**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/Views/LoginView.swift`:

```swift
import SwiftUI
import AuthenticationServices

struct LoginView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var showTitle = false
    @State private var showTagline = false
    @State private var showForm = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Brand
                Text("Stitchuation")
                    .font(.typeStyle(.largeTitle))
                    .foregroundStyle(Color.espresso)
                    .opacity(showTitle ? 1 : 0)
                    .offset(y: showTitle ? 0 : 15)

                Text("Your craft companion")
                    .font(.sourceSerif(17, weight: .regular))
                    .italic()
                    .foregroundStyle(Color.walnut)
                    .opacity(showTagline ? 1 : 0)
                    .offset(y: showTagline ? 0 : 10)

                Spacer().frame(height: Spacing.lg)

                // Form
                VStack(spacing: Spacing.xl) {
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { _ in
                        // TODO: Wire up Apple sign-in with backend
                    }
                    .signInWithAppleButtonStyle(.whiteOutline)
                    .frame(height: 50)
                    .cornerRadius(CornerRadius.subtle)

                    HStack {
                        Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                        Text("or")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.clay)
                        Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                    }

                    VStack(spacing: Spacing.md) {
                        if authViewModel.isRegistering {
                            TextField("Display Name", text: $authViewModel.displayName)
                        }
                        TextField("Email", text: $authViewModel.email)
                            .textContentType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        SecureField("Password", text: $authViewModel.password)
                            .textContentType(authViewModel.isRegistering ? .newPassword : .password)
                    }
                    .textFieldStyle(.plain)
                    .font(.typeStyle(.body))
                    .padding(Spacing.md)
                    .background(Color.parchment)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))

                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .foregroundStyle(Color.terracotta)
                            .font(.typeStyle(.footnote))
                    }

                    Button {
                        Task {
                            if authViewModel.isRegistering {
                                await authViewModel.register()
                            } else {
                                await authViewModel.login()
                            }
                        }
                    } label: {
                        Text(authViewModel.isRegistering ? "Create Account" : "Sign In")
                            .font(.typeStyle(.headline))
                            .foregroundStyle(Color.cream)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                            .background(Color.terracotta)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .warmShadow(.elevated)
                    }
                    .disabled(authViewModel.isLoading)

                    Button(authViewModel.isRegistering ? "Already have an account? Sign in" : "Create an account") {
                        authViewModel.isRegistering.toggle()
                    }
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.terracotta)
                }
                .padding(.horizontal, Spacing.xl)
                .opacity(showForm ? 1 : 0)
                .offset(y: showForm ? 0 : 15)

                Spacer()
            }
        }
        .onAppear {
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showTitle = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 1))) {
                showTagline = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 3))) {
                showForm = true
            }
        }
    }
}
```

**Step 2: Build to verify it compiles**

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/LoginView.swift
git commit -m "feat(ios): restyle LoginView as branded landing page with stagger animation"
```

---

## Task 13: Form Views — Parchment Backgrounds

Apply parchment section backgrounds and semantic type styles to all form views.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift`

**Step 1: Add `.listRowBackground(Color.parchment)` to form sections**

In each form view, add `.listRowBackground(Color.parchment)` to each `Section { ... }` block. This gives form fields a parchment background instead of the default white.

For `AddThreadView.swift`, add after each Section's closing brace:
```swift
Section {
    // ... fields ...
} header: {
    // ... header ...
}
.listRowBackground(Color.parchment)
```

Apply the same pattern to all Section blocks in:
- `AddCanvasView.swift` (3 sections — but the photo section already has `.listRowBackground(Color.clear)`, leave that one)
- `EditCanvasView.swift` (2 sections)
- `AddJournalEntryView.swift` (2 sections)

**Step 2: Verify `.font(.typeStyle(.body))` replaces base form font**

The base form font `.font(.sourceSerif(17))` should already be replaced with `.font(.typeStyle(.body))` from Task 6. Verify this is applied.

**Step 3: Build to verify it compiles**

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): add parchment backgrounds to form sections"
```

---

## Task 14: ImageViewerView — Pinch-to-Zoom

Add `MagnifyGesture` for pinch-to-zoom and double-tap to toggle zoom. Enlarge dismiss button.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ImageViewerView.swift`

**Step 1: Update imagePageView with zoom state**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/Views/ImageViewerView.swift`:

```swift
import SwiftUI

struct ImageViewerView: View {
    let images: [JournalImage]
    let initialIndex: Int

    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient
    @State private var currentIndex: Int
    @State private var loadedImages: [UUID: UIImage] = [:]

    init(images: [JournalImage], initialIndex: Int) {
        self.images = images
        self.initialIndex = initialIndex
        self._currentIndex = State(initialValue: initialIndex)
    }

    var body: some View {
        ZStack {
            Color.espresso.ignoresSafeArea()

            TabView(selection: $currentIndex) {
                ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                    ZoomableImagePage(image: loadedImages[image.id])
                        .tag(index)
                        .task {
                            await loadImage(image)
                        }
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack {
                HStack {
                    if images.count > 1 {
                        Text("\(currentIndex + 1) of \(images.count)")
                            .font(.typeStyle(.subheadline)).weight(.medium)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 40, height: 40)
                            .background(.white.opacity(0.15))
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)

                Spacer()

                if images.count > 1 {
                    HStack(spacing: Spacing.sm) {
                        ForEach(0..<images.count, id: \.self) { index in
                            Circle()
                                .fill(index == currentIndex ? Color.terracotta : .white.opacity(0.35))
                                .frame(width: 7, height: 7)
                                .animation(.easeInOut(duration: 0.2), value: currentIndex)
                        }
                    }
                    .padding(.bottom, Spacing.xl)
                }
            }
        }
        .statusBarHidden(true)
    }

    private func loadImage(_ journalImage: JournalImage) async {
        guard loadedImages[journalImage.id] == nil,
              let networkClient else { return }
        do {
            let data = try await networkClient.fetchData(path: "/images/\(journalImage.imageKey)")
            if let image = UIImage(data: data) {
                loadedImages[journalImage.id] = image
            }
        } catch {
            // Failed to load — stays as spinner
        }
    }
}

// MARK: - Zoomable Image Page

private struct ZoomableImagePage: View {
    let image: UIImage?

    @State private var currentZoom: CGFloat = 0
    @State private var totalZoom: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private var effectiveZoom: CGFloat {
        max(1, totalZoom + currentZoom)
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .scaleEffect(effectiveZoom)
                    .offset(offset)
                    .gesture(
                        MagnifyGesture()
                            .onChanged { value in
                                currentZoom = value.magnification - 1
                            }
                            .onEnded { value in
                                totalZoom = max(1, totalZoom + currentZoom)
                                currentZoom = 0
                                if totalZoom <= 1 {
                                    withAnimation(Motion.gentle) {
                                        offset = .zero
                                        lastOffset = .zero
                                    }
                                }
                            }
                            .simultaneously(with:
                                DragGesture()
                                    .onChanged { value in
                                        if effectiveZoom > 1 {
                                            offset = CGSize(
                                                width: lastOffset.width + value.translation.width,
                                                height: lastOffset.height + value.translation.height
                                            )
                                        }
                                    }
                                    .onEnded { _ in
                                        lastOffset = offset
                                    }
                            )
                    )
                    .onTapGesture(count: 2) {
                        withAnimation(Motion.gentle) {
                            if totalZoom > 1 {
                                totalZoom = 1
                                offset = .zero
                                lastOffset = .zero
                            } else {
                                totalZoom = 2
                            }
                        }
                    }
            } else {
                ProgressView()
                    .tint(Color.terracotta)
                    .scaleEffect(1.2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
```

**Step 2: Build to verify it compiles**

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ImageViewerView.swift
git commit -m "feat(ios): add pinch-to-zoom and double-tap zoom to ImageViewerView"
```

---

## Task 15: Final Build & Test Verification

Run full build and test suite to verify everything works together.

**Step 1: Build the project**

```bash
xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -quiet 2>&1 | tail -10
```

Expected: BUILD SUCCEEDED

**Step 2: Run all tests**

```bash
xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -quiet 2>&1 | tail -20
```

Expected: All tests pass

**Step 3: Fix any issues found**

If build or test failures occur, fix them and re-run.

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(ios): address build/test issues from design polish"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Warm shadow system | Shadows.swift (new) |
| 2 | Semantic type scale + SF Mono | Typography.swift |
| 3 | Animation presets | Motion.swift (new) |
| 4 | EmptyStateView component | EmptyStateView.swift (new) |
| 5 | CanvasThumbnail sizing refactor | CanvasThumbnail.swift + 6 call sites |
| 6 | Apply type scale to all views | 14 files |
| 7 | Card shadows + EmptyStateView adoption | 5 list/detail views |
| 8 | Quantity stepper animation + SF Mono | ThreadListView.swift |
| 9 | StatusBadge animation | ProjectStatusBadge.swift |
| 10 | JournalEntryCard hierarchy | ProjectDetailView.swift |
| 11 | Detail view shadows | CanvasDetailView + ProjectDetailView |
| 12 | LoginView branded restyle | LoginView.swift |
| 13 | Form parchment backgrounds | 4 form views |
| 14 | Image viewer pinch-to-zoom | ImageViewerView.swift |
| 15 | Final build & test verification | — |
