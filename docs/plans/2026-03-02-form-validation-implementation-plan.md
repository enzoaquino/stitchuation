# Form Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual "Required" indicators on empty required form fields after focus loss, so users understand why save is disabled.

**Architecture:** A reusable `ValidatedTextField` component in the design system that wraps `TextField` with `@FocusState` tracking. Each of the 5 data-entry forms swaps `TextField` for `ValidatedTextField` on its required fields. Save button disabled logic is unchanged.

**Tech Stack:** SwiftUI, Swift Testing framework (`import Testing`, `@Test`, `#expect()`)

---

### Task 1: Create ValidatedTextField component with tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ValidatedTextField.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/ValidatedTextFieldTests.swift`

**Context:** This is a design system component. Other components live in the same directory: `MeshCountPicker.swift`, `EmptyStateView.swift`, `CameraView.swift`. Tests use the Swift Testing framework (NOT XCTest). See `MeshCountPickerTests.swift` for the pattern.

**Step 1: Write the failing tests**

Create `apps/ios/stitchuation/stitchuationTests/ValidatedTextFieldTests.swift`:

```swift
import Testing
import SwiftUI
@testable import stitchuation

@Suite("ValidatedTextField Tests")
struct ValidatedTextFieldTests {
    @Test("showError is false before field has been touched")
    func initialState() {
        var text = ""
        let binding = Binding(get: { text }, set: { text = $0 })
        let field = ValidatedTextField("Name", text: binding)
        #expect(field.showError == false)
    }

    @Test("showError is true when required, touched, and empty")
    func emptyAfterTouch() {
        var text = ""
        let binding = Binding(get: { text }, set: { text = $0 })
        var field = ValidatedTextField("Name", text: binding)
        field.hasBeenTouched = true
        #expect(field.showError == true)
    }

    @Test("showError is false when required, touched, and non-empty")
    func filledAfterTouch() {
        var text = "hello"
        let binding = Binding(get: { text }, set: { text = $0 })
        var field = ValidatedTextField("Name", text: binding)
        field.hasBeenTouched = true
        #expect(field.showError == false)
    }

    @Test("showError is false when not required, touched, and empty")
    func notRequiredEmpty() {
        var text = ""
        let binding = Binding(get: { text }, set: { text = $0 })
        var field = ValidatedTextField("Name", text: binding, isRequired: false)
        field.hasBeenTouched = true
        #expect(field.showError == false)
    }

    @Test("showError treats whitespace-only as empty")
    func whitespaceOnly() {
        var text = "   "
        let binding = Binding(get: { text }, set: { text = $0 })
        var field = ValidatedTextField("Name", text: binding)
        field.hasBeenTouched = true
        #expect(field.showError == true)
    }
}
```

**Step 2: Run tests to verify they fail**

Run: Build in Xcode (`Cmd+U`) or `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: FAIL — `ValidatedTextField` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/ValidatedTextField.swift`:

```swift
import SwiftUI

struct ValidatedTextField: View {
    let placeholder: String
    @Binding var text: String
    let isRequired: Bool

    @FocusState private var isFocused: Bool
    // Tracks whether the field has ever received and lost focus.
    // Exposed as internal (not private) so tests can set it directly.
    var hasBeenTouched = false

    /// True when the field should display its error state.
    var showError: Bool {
        isRequired && hasBeenTouched && text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    init(_ placeholder: String, text: Binding<String>, isRequired: Bool = true) {
        self.placeholder = placeholder
        self._text = text
        self.isRequired = isRequired
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            TextField(placeholder, text: $text)
                .font(.typeStyle(.body))
                .focused($isFocused)
                .onChange(of: isFocused) { wasFocused, nowFocused in
                    if wasFocused && !nowFocused {
                        hasBeenTouched = true
                    }
                }
                .padding(.vertical, Spacing.md)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.subtle)
                        .stroke(showError ? Color.dustyRose : Color.clear, lineWidth: 1)
                )

            if showError {
                Text("Required")
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.dustyRose)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showError)
    }
}
```

**Step 4: Run tests to verify they pass**

Run: Build and test in Xcode (`Cmd+U`)
Expected: All 5 ValidatedTextField tests PASS.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/ValidatedTextField.swift \
       apps/ios/stitchuation/stitchuationTests/ValidatedTextFieldTests.swift
git commit -m "feat(ios): add ValidatedTextField component with focus-lost required indicator"
```

---

### Task 2: Update AddThreadView to use ValidatedTextField

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`

**Context:** AddThreadView uses SwiftUI `Form` (list-style). Two fields are required: Brand and Number. The save button is already disabled when `brand.isEmpty || number.isEmpty || !isValidHex`. We are only adding visual indicators — do NOT change the save button logic.

**Important:** In a `Form`, each row already has its own padding and background. The `ValidatedTextField` component applies `.padding(.vertical, Spacing.md)` internally. Inside a `Form`, you should NOT wrap it in additional padding. The `.listRowBackground(Color.parchment)` stays on the `Section`.

**Step 1: Replace the Brand and Number TextFields**

In `AddThreadView.swift`, in the first `Section` block, replace:

```swift
TextField("Brand (e.g. DMC)", text: $brand)
TextField("Number (e.g. 310)", text: $number)
```

with:

```swift
ValidatedTextField("Brand (e.g. DMC)", text: $brand)
ValidatedTextField("Number (e.g. 310)", text: $number)
```

Leave all other fields (colorName, colorHex, fiberType Picker) as plain `TextField`. Leave the hex validation block and save button `.disabled()` unchanged.

**Step 2: Build and test**

Run: Build in Xcode (`Cmd+B`)
Expected: Compiles with no errors. Visually test by opening Add Thread, tapping into Brand, tapping out — should see dusty rose border + "Required" label.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift
git commit -m "feat(ios): add required field indicators to AddThreadView"
```

---

### Task 3: Update AddCanvasView to use ValidatedTextField

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Context:** AddCanvasView uses `ScrollView` with custom card layouts (NOT `Form`). Two fields are required: Designer and Design Name. They sit inside a `VStack(spacing: 0)` with `Divider()` separators between them. The save button is disabled when `designer.isEmpty || designName.isEmpty || !isMeshCountValid`.

**Step 1: Replace the Designer and Design Name TextFields**

In `AddCanvasView.swift`, inside the "Canvas Info" card, replace:

```swift
VStack(spacing: 0) {
    TextField("Designer (e.g. Melissa Shirley)", text: $designer)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)

    Divider().background(Color.parchment)

    TextField("Design Name", text: $designName)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)
}
```

with:

```swift
VStack(spacing: 0) {
    ValidatedTextField("Designer (e.g. Melissa Shirley)", text: $designer)

    Divider().background(Color.parchment)

    ValidatedTextField("Design Name", text: $designName)
}
```

Note: `ValidatedTextField` already applies `.font(.typeStyle(.body))` and `.padding(.vertical, Spacing.md)` internally, so remove those modifiers from the replaced lines.

**Step 2: Build and test**

Run: Build in Xcode (`Cmd+B`)
Expected: Compiles. Visually test in Add Canvas screen.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): add required field indicators to AddCanvasView"
```

---

### Task 4: Update EditCanvasView to use ValidatedTextField

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`

**Context:** EditCanvasView mirrors AddCanvasView's layout — `ScrollView` with cards. Same two required fields: Designer, Design Name. Same card structure.

**Step 1: Replace the Designer and Design Name TextFields**

In `EditCanvasView.swift`, inside the "Canvas Info" card, replace:

```swift
VStack(spacing: 0) {
    TextField("Designer", text: $designer)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)

    Divider().background(Color.parchment)

    TextField("Design Name", text: $designName)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)
}
```

with:

```swift
VStack(spacing: 0) {
    ValidatedTextField("Designer", text: $designer)

    Divider().background(Color.parchment)

    ValidatedTextField("Design Name", text: $designName)
}
```

**Step 2: Build and test**

Run: Build in Xcode (`Cmd+B`)
Expected: Compiles. Visually test in Edit Canvas screen.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift
git commit -m "feat(ios): add required field indicators to EditCanvasView"
```

---

### Task 5: Update AddMaterialView to use ValidatedTextField

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift`

**Context:** AddMaterialView uses SwiftUI `Form` (list-style). Only one field is required: Name. It's in the "Details" section. The save button is disabled when `!canSave` (where `canSave = !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty`).

**Step 1: Replace the Name TextField**

In `AddMaterialView.swift`, in the "Details" section, replace:

```swift
TextField("Name (e.g. Dark Green)", text: $name)
    .font(.typeStyle(.body))
```

with:

```swift
ValidatedTextField("Name (e.g. Dark Green)", text: $name)
```

Leave Brand and Code as plain `TextField` — they are optional fields.

**Step 2: Build and test**

Run: Build in Xcode (`Cmd+B`)
Expected: Compiles. Visually test in Add Material screen.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift
git commit -m "feat(ios): add required field indicator to AddMaterialView"
```

---

### Task 6: Update EditProfileSheet to use ValidatedTextField

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift`

**Context:** EditProfileSheet uses `ScrollView` with cards. One required field: Display Name. It sits inside a `VStack(spacing: 0)` with a Divider between it and the Bio field. The save button is disabled when `draftName.isEmpty || isSaving`.

**Step 1: Replace the Display Name TextField**

In `EditProfileSheet.swift`, inside the "Profile" card, replace:

```swift
VStack(spacing: 0) {
    TextField("Display Name", text: $draftName)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)

    Divider().background(Color.parchment)

    TextField("Bio (e.g. Needlepoint lover from Austin)", text: $draftBio, axis: .vertical)
        .lineLimit(2...4)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)
}
```

with:

```swift
VStack(spacing: 0) {
    ValidatedTextField("Display Name", text: $draftName)

    Divider().background(Color.parchment)

    TextField("Bio (e.g. Needlepoint lover from Austin)", text: $draftBio, axis: .vertical)
        .lineLimit(2...4)
        .font(.typeStyle(.body))
        .padding(.vertical, Spacing.md)
}
```

Only the Display Name gets `ValidatedTextField`. Bio remains a plain `TextField` since it's optional.

**Step 2: Build and test**

Run: Build in Xcode (`Cmd+B`)
Expected: Compiles. Visually test in Edit Profile screen.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift
git commit -m "feat(ios): add required field indicator to EditProfileSheet"
```

---

### Task 7: Final verification

**Files:** None — read-only verification.

**Step 1: Run full iOS test suite**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: All tests pass, including the 5 new `ValidatedTextFieldTests`.

**Step 2: Manual smoke test**

Open the app in Simulator and verify each form:

1. **Add Thread** — Tap Brand, tap out → dusty rose border + "Required". Type something → border disappears. Same for Number.
2. **Add Canvas** — Tap Designer, tap out → indicator. Same for Design Name.
3. **Edit Canvas** — Open an existing canvas for editing. Clear Designer, tap out → indicator.
4. **Add Material** — Tap Name, tap out → indicator. Brand and Code should NOT show indicators.
5. **Edit Profile** — Clear Display Name, tap out → indicator. Bio should NOT show indicator.

**Step 3: Commit any adjustments, then push**

```bash
git push origin main
```
