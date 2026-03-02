# Quick-Start Project Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Add New Canvas" button to StartProjectSheet so users can create and start a project in one flow, without visiting the Stash tab first.

**Architecture:** Modify `AddCanvasView` to accept an optional callback for "start as project" mode. Modify `StartProjectSheet` to show an "Add New Canvas" button that opens AddCanvasView in this mode. When saved in project mode, the piece goes directly to kitting status and ProjectDetailView opens.

**Tech Stack:** SwiftUI, SwiftData, Swift Testing

---

### Task 1: Add `onProjectStarted` callback to AddCanvasView

Modify `AddCanvasView` to support a "start as project" mode. When a callback is provided, the saved canvas goes directly to kitting instead of stash, and the "Add Another" toggle is hidden.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Step 1: Add the callback property**

Add a new optional property at the top of `AddCanvasView`, after the environment properties:

```swift
/// When provided, the saved canvas is set to kitting and this callback fires instead of dismissing.
var onProjectStarted: ((StitchPiece) -> Void)? = nil
```

**Step 2: Hide "Add Another" when in project mode**

Wrap the "Add Another" banner (the `HStack` with `arrow.triangle.2.circlepath`) in a conditional:

```swift
if onProjectStarted == nil {
    HStack {
        // ... existing Add Another content ...
    }
    // ... existing modifiers ...
}
```

**Step 3: Modify `saveCanvas()` to handle project mode**

In the `saveCanvas()` function, after `modelContext.insert(piece)` and after the image upload block, replace the `if addAnother { ... } else { dismiss() }` block with:

```swift
if let onProjectStarted {
    piece.status = .kitting
    piece.startedAt = Date()
    piece.updatedAt = Date()
    dismiss()
    onProjectStarted(piece)
} else if addAnother {
    // Intentionally keep designer — users often add multiple canvases from the same designer
    designName = ""
    acquiredAt = nil
    showDatePicker = false
    size = ""
    meshCount = ""
    notes = ""
    selectedPhoto = nil
    selectedImageData = nil
} else {
    dismiss()
}
```

**Step 4: Update nav title when in project mode**

Change the `.navigationTitle` to be dynamic:

```swift
.navigationTitle(onProjectStarted != nil ? "New Project" : "Add Canvas")
```

**Step 5: Build to verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): add onProjectStarted callback to AddCanvasView for quick-start mode"
```

---

### Task 2: Add "Add New Canvas" button to StartProjectSheet

Modify `StartProjectSheet` to show an "Add New Canvas" button that opens AddCanvasView in project mode. The button is always visible — prominently when stash is empty, at the top of the list when stash has items.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift` (StartProjectSheet is defined here)

**Step 1: Add state for showing AddCanvasView**

Add to `StartProjectSheet`:

```swift
@State private var showAddCanvas = false
```

**Step 2: Update the empty state**

Replace the existing `EmptyStateView` block (the `if stashPieces.isEmpty` branch) with:

```swift
if stashPieces.isEmpty {
    VStack(spacing: Spacing.xl) {
        EmptyStateView(
            icon: "square.stack.3d.up.slash",
            title: "No canvases in your stash",
            message: "Create a new canvas to get started"
        )

        Button {
            showAddCanvas = true
        } label: {
            Label("Add New Canvas", systemImage: "plus")
                .font(.typeStyle(.headline))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(Color.terracotta)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                .warmShadow(.elevated)
        }
        .padding(.horizontal, Spacing.xxxl)
    }
}
```

**Step 3: Add the button above the stash list when items exist**

Replace the existing `else` branch (the `List` with `ForEach(stashPieces)`) with:

```swift
else {
    List {
        Section {
            Button {
                showAddCanvas = true
            } label: {
                HStack(spacing: Spacing.md) {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.terracotta)

                    Text("Add New Canvas")
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.terracotta)

                    Spacer()
                }
                .padding(.vertical, Spacing.sm)
            }
            .listRowBackground(Color.cream)
        }

        Section {
            ForEach(stashPieces, id: \.id) { piece in
                Button {
                    startProject(piece)
                } label: {
                    HStack(spacing: Spacing.md) {
                        CanvasThumbnail(imageKey: piece.imageKey, size: .fixed(48))

                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                            Text(piece.designName)
                                .font(.typeStyle(.headline))
                                .foregroundStyle(Color.espresso)
                            Text(piece.designer)
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.walnut)
                        }

                        Spacer()
                    }
                    .padding(.vertical, Spacing.sm)
                }
                .listRowBackground(Color.cream)
            }
        } header: {
            Text("From Stash")
                .font(.playfair(15, weight: .semibold))
                .foregroundStyle(Color.walnut)
                .textCase(nil)
        }
    }
    .scrollContentBackground(.hidden)
}
```

**Step 4: Add the sheet presentation for AddCanvasView**

Add after the existing `.toolbar` modifier on the `NavigationStack`:

```swift
.sheet(isPresented: $showAddCanvas) {
    AddCanvasView { piece in
        let pieceId = piece.id
        navigationCoordinator.presentedProjectId = PieceIdentifier(id: pieceId)
    }
}
```

Wait — the `onProjectStarted` callback fires after `dismiss()` in AddCanvasView, which dismisses the AddCanvasView sheet. But we also need to dismiss the StartProjectSheet. Since AddCanvasView calls `dismiss()` itself, and then fires the callback, the StartProjectSheet needs to also dismiss.

Update the sheet to:

```swift
.sheet(isPresented: $showAddCanvas) {
    AddCanvasView(onProjectStarted: { piece in
        let pieceId = piece.id
        dismiss()
        navigationCoordinator.presentedProjectId = PieceIdentifier(id: pieceId)
    })
}
```

The flow: AddCanvasView saves → dismisses itself → fires callback → callback dismisses StartProjectSheet → navigates to ProjectDetailView.

**Step 5: Build to verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift
git commit -m "feat(ios): add 'Add New Canvas' quick-start button to StartProjectSheet"
```

---

### Task 3: Run Full Test Suite

Verify everything compiles and all existing tests pass.

**Step 1: Build**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 2: Run all tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | grep -E '(Executed|passed|failed|error:)' | tail -20`
Expected: All 148 tests pass, no regressions

**Step 3: Fix any failures if needed**

Existing callers of `AddCanvasView()` (in `StashListView`) use it without the callback, which defaults to `nil` — so those should still work. But verify.
