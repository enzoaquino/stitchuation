# Mesh Count Chip Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the plain TextField mesh count input with a chip-row selector for one-tap selection of standard needlepoint mesh counts (10, 12, 13, 14, 18, 24) plus a custom "Other" fallback.

**Architecture:** Single reusable `MeshCountPicker` component that takes a `Binding<String>` for the mesh count value. Chips for standard sizes, "Other" chip reveals a TextField. Integrates into both AddCanvasView and EditCanvasView by replacing the existing HStack mesh count row. Validation logic (`meshCountValue` / `isMeshCountValid`) stays in the parent views unchanged.

**Tech Stack:** SwiftUI, Swift Testing framework (`import Testing`, `@Test`, `#expect()`)

**Build command:** `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -5`

**Test command:** `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

**Design doc:** `docs/plans/2026-02-20-mesh-count-selector-design.md`

**Design system tokens:** `apps/ios/stitchuation/stitchuation/DesignSystem/` — Colors, Spacing, Typography, Motion, Shadows, CornerRadius

---

## Task 1: MeshCountPicker Component + Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/MeshCountPicker.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/MeshCountPickerTests.swift`

**Step 1: Write the failing tests**

Create `apps/ios/stitchuation/stitchuationTests/MeshCountPickerTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

@Suite("MeshCountPicker Tests")
struct MeshCountPickerTests {
    @Test("standard presets are 10, 12, 13, 14, 18, 24")
    func standardPresets() {
        #expect(MeshCountPicker.standardCounts == [10, 12, 13, 14, 18, 24])
    }

    @Test("selecting a preset sets meshCount to that value")
    func selectPreset() {
        var meshCount = ""
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        var picker = MeshCountPicker(meshCount: binding)
        picker.selectPreset(18)
        #expect(meshCount == "18")
    }

    @Test("selecting Other clears meshCount")
    func selectOther() {
        var meshCount = "18"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        var picker = MeshCountPicker(meshCount: binding)
        picker.selectOther()
        #expect(meshCount == "")
        #expect(picker.isCustomMode)
    }

    @Test("initializes with preset selected when value matches")
    func initWithPresetValue() {
        var meshCount = "13"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.selectedPreset == 13)
        #expect(!picker.isCustomMode)
    }

    @Test("initializes with Other selected when value is non-standard")
    func initWithCustomValue() {
        var meshCount = "16"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.selectedPreset == nil)
        #expect(picker.isCustomMode)
    }

    @Test("initializes with nothing selected when value is empty")
    func initEmpty() {
        var meshCount = ""
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.selectedPreset == nil)
        #expect(!picker.isCustomMode)
    }

    @Test("switching from preset to Other clears value")
    func presetToOther() {
        var meshCount = "18"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        var picker = MeshCountPicker(meshCount: binding)
        picker.selectPreset(18)
        #expect(meshCount == "18")
        picker.selectOther()
        #expect(meshCount == "")
        #expect(picker.isCustomMode)
    }

    @Test("switching from Other back to preset hides custom mode")
    func otherToPreset() {
        var meshCount = ""
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        var picker = MeshCountPicker(meshCount: binding)
        picker.selectOther()
        #expect(picker.isCustomMode)
        picker.selectPreset(14)
        #expect(meshCount == "14")
        #expect(!picker.isCustomMode)
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

Expected: FAIL — `MeshCountPicker` type not found.

**Step 3: Implement MeshCountPicker**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/MeshCountPicker.swift`:

```swift
import SwiftUI

struct MeshCountPicker: View {
    @Binding var meshCount: String

    static let standardCounts = [10, 12, 13, 14, 18, 24]

    // Internal state — exposed as read-only for testing
    private(set) var selectedPreset: Int?
    private(set) var isCustomMode: Bool

    @State private var chipScale: [Int: CGFloat] = [:]
    @State private var otherChipScale: CGFloat = 1.0
    @FocusState private var isCustomFieldFocused: Bool

    init(meshCount: Binding<String>) {
        self._meshCount = meshCount
        let value = Int(meshCount.wrappedValue)
        if let value, Self.standardCounts.contains(value) {
            self.selectedPreset = value
            self.isCustomMode = false
        } else if !meshCount.wrappedValue.isEmpty {
            self.selectedPreset = nil
            self.isCustomMode = true
        } else {
            self.selectedPreset = nil
            self.isCustomMode = false
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Mesh Count")
                .font(.typeStyle(.subheadline))
                .foregroundStyle(Color.walnut)

            chipRow

            if isCustomMode {
                HStack {
                    TextField("Enter mesh count", text: $meshCount)
                        .keyboardType(.numberPad)
                        .focused($isCustomFieldFocused)
                    Text("mesh")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    isCustomFieldFocused = true
                }
            }
        }
        .animation(Motion.gentle, value: isCustomMode)
    }

    private var chipRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(Self.standardCounts, id: \.self) { count in
                chipButton(for: count)
            }
            otherChipButton
        }
    }

    private func chipButton(for count: Int) -> some View {
        Button {
            selectPreset(count)
        } label: {
            Text("\(count)")
                .font(selectedPreset == count
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(selectedPreset == count ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(selectedPreset == count ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            selectedPreset == count ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(chipScale[count] ?? 1.0)
    }

    private var otherChipButton: some View {
        Button {
            selectOther()
        } label: {
            Text("Other")
                .font(isCustomMode
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(isCustomMode ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(isCustomMode ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isCustomMode ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(otherChipScale)
    }

    // MARK: - Actions (internal for testing)

    mutating func selectPreset(_ count: Int) {
        selectedPreset = count
        isCustomMode = false
        meshCount = "\(count)"
        animateChip(count)
    }

    mutating func selectOther() {
        selectedPreset = nil
        isCustomMode = true
        meshCount = ""
    }

    private func animateChip(_ count: Int) {
        withAnimation(Motion.bouncy) {
            chipScale[count] = 1.05
        }
        withAnimation(Motion.bouncy.delay(0.1)) {
            chipScale[count] = 1.0
        }
    }
}
```

**Important note for the implementer:** The `mutating func` pattern on a View struct works for testing purposes where we create a `var picker` and call the method directly. In the actual SwiftUI body, the button actions call these same methods but SwiftUI handles the state updates through `@State`/`@Binding`. However, since `selectedPreset` and `isCustomMode` need to be both `@State` (for SwiftUI reactivity) and testable, the implementer should use `@State` for these properties. For the tests to work, expose the init logic (what preset is selected, whether custom mode is on) as testable computed properties that derive from `meshCount` rather than internal state. Here is the adjusted approach:

**Revised implementation strategy:** Make `selectedPreset` and `isCustomMode` computed from a `@State private var selection: Selection` enum, and expose read-only getters. For tests, just test the init logic by checking the exposed properties. The `selectPreset`/`selectOther` methods won't be called directly from tests — instead, test the init behavior and trust the button wiring.

**Revised test file** (replace Step 1):

```swift
import Testing
import SwiftUI
@testable import stitchuation

@Suite("MeshCountPicker Tests")
struct MeshCountPickerTests {
    @Test("standard presets are 10, 12, 13, 14, 18, 24")
    func standardPresets() {
        #expect(MeshCountPicker.standardCounts == [10, 12, 13, 14, 18, 24])
    }

    @Test("initializes with preset selected when value matches standard")
    func initWithPresetValue() {
        var meshCount = "13"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .preset(13))
    }

    @Test("initializes with custom mode when value is non-standard")
    func initWithCustomValue() {
        var meshCount = "16"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .custom)
    }

    @Test("initializes with no selection when value is empty")
    func initEmpty() {
        var meshCount = ""
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .none)
    }

    @Test("initializes with preset for each standard count")
    func initWithEachPreset() {
        for count in MeshCountPicker.standardCounts {
            var meshCount = "\(count)"
            let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
            let picker = MeshCountPicker(meshCount: binding)
            #expect(picker.initialSelection == .preset(count))
        }
    }
}
```

**Revised implementation** (replace Step 3):

```swift
import SwiftUI

struct MeshCountPicker: View {
    @Binding var meshCount: String

    static let standardCounts = [10, 12, 13, 14, 18, 24]

    enum Selection: Equatable {
        case none
        case preset(Int)
        case custom
    }

    /// Exposed for testing — the selection derived from the initial meshCount value.
    let initialSelection: Selection

    @State private var selection: Selection
    @State private var chipScale: [Int: CGFloat] = [:]
    @State private var otherChipScale: CGFloat = 1.0
    @FocusState private var isCustomFieldFocused: Bool

    init(meshCount: Binding<String>) {
        self._meshCount = meshCount
        let value = Int(meshCount.wrappedValue)
        if let value, Self.standardCounts.contains(value) {
            self.initialSelection = .preset(value)
            self._selection = State(initialValue: .preset(value))
        } else if !meshCount.wrappedValue.isEmpty {
            self.initialSelection = .custom
            self._selection = State(initialValue: .custom)
        } else {
            self.initialSelection = .none
            self._selection = State(initialValue: .none)
        }
    }

    private var isCustomMode: Bool {
        selection == .custom
    }

    private var selectedPreset: Int? {
        if case .preset(let count) = selection { return count }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Mesh Count")
                .font(.typeStyle(.subheadline))
                .foregroundStyle(Color.walnut)

            chipRow

            if isCustomMode {
                HStack {
                    TextField("Enter mesh count", text: $meshCount)
                        .keyboardType(.numberPad)
                        .focused($isCustomFieldFocused)
                    Text("mesh")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    isCustomFieldFocused = true
                }
            }
        }
        .animation(Motion.gentle, value: isCustomMode)
    }

    private var chipRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(Self.standardCounts, id: \.self) { count in
                chipButton(for: count)
            }
            otherChipButton
        }
    }

    private func chipButton(for count: Int) -> some View {
        Button {
            selection = .preset(count)
            meshCount = "\(count)"
            withAnimation(Motion.bouncy) {
                chipScale[count] = 1.05
            }
            withAnimation(Motion.bouncy.delay(0.1)) {
                chipScale[count] = 1.0
            }
        } label: {
            Text("\(count)")
                .font(selectedPreset == count
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(selectedPreset == count ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(selectedPreset == count ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            selectedPreset == count ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(chipScale[count] ?? 1.0)
    }

    private var otherChipButton: some View {
        Button {
            selection = .custom
            meshCount = ""
            withAnimation(Motion.bouncy) {
                otherChipScale = 1.05
            }
            withAnimation(Motion.bouncy.delay(0.1)) {
                otherChipScale = 1.0
            }
        } label: {
            Text("Other")
                .font(isCustomMode
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(isCustomMode ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(isCustomMode ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isCustomMode ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(otherChipScale)
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

Expected: All MeshCountPicker tests PASS

**Step 5: Build to verify UI compiles**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -5`

Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/MeshCountPicker.swift apps/ios/stitchuation/stitchuationTests/MeshCountPickerTests.swift
git commit -m "feat(ios): add MeshCountPicker chip selector component with tests"
```

---

## Task 2: Integrate MeshCountPicker into AddCanvasView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift:100-113`

**Step 1: Replace the mesh count HStack**

In `AddCanvasView.swift`, replace lines 100-113 (the `HStack` containing the mesh count TextField and the validation error):

```swift
// REMOVE (lines 100-113):
                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.terracotta)
                    }

// REPLACE WITH:
                    MeshCountPicker(meshCount: $meshCount)
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.terracotta)
                    }
```

The validation error stays — it still applies when "Other" is selected and the user types an invalid value.

**Step 2: Update the "Add Another" reset**

In `saveCanvas()`, the reset block at line 215 already sets `meshCount = ""`. This is correct — `MeshCountPicker` will see an empty string and show no selection (`.none` state). No change needed.

**Step 3: Build to verify it compiles**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -5`

Expected: BUILD SUCCEEDED

**Step 4: Run tests to verify nothing broke**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

Expected: All tests pass

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): replace AddCanvasView mesh count TextField with MeshCountPicker"
```

---

## Task 3: Integrate MeshCountPicker into EditCanvasView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift:67-80`

**Step 1: Replace the mesh count HStack**

In `EditCanvasView.swift`, replace lines 67-80 (the `HStack` containing the mesh count TextField and validation error):

```swift
// REMOVE (lines 67-80):
                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.terracotta)
                    }

// REPLACE WITH:
                    MeshCountPicker(meshCount: $meshCount)
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.terracotta)
                    }
```

**Important:** EditCanvasView initializes `meshCount` from `canvas.meshCount.map { String($0) } ?? ""` (line 23). This means if the canvas has meshCount 18, the picker will see `"18"` and correctly pre-select the 18 chip. If the canvas has a non-standard value like 16, the picker will correctly show "Other" with "16" in the text field. No init changes needed.

**Step 2: Build to verify it compiles**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -5`

Expected: BUILD SUCCEEDED

**Step 3: Run tests to verify nothing broke**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

Expected: All tests pass

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift
git commit -m "feat(ios): replace EditCanvasView mesh count TextField with MeshCountPicker"
```

---

## Task 4: Final Build & Test Verification

**Step 1: Build the project**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -5`

Expected: BUILD SUCCEEDED

**Step 2: Run all tests**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -quiet 2>&1 | tail -20`

Expected: All tests pass (note: 2 pre-existing KeychainHelperTests failures in simulator are expected)

**Step 3: Fix any issues found**

If build or test failures occur, fix them and re-run.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | MeshCountPicker component + tests | MeshCountPicker.swift (new), MeshCountPickerTests.swift (new) |
| 2 | Integrate into AddCanvasView | AddCanvasView.swift |
| 3 | Integrate into EditCanvasView | EditCanvasView.swift |
| 4 | Final build & test verification | — |
