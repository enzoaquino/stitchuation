# Kitting UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the ProjectDetailView kitting UI — merge disconnected cards, replace buggy embedded List with VStack, add card wrapper to materials, simplify progress, and add delete to the edit sheet.

**Architecture:** Pure SwiftUI view refactoring across 4 files. No model/sync changes. The status card and info card merge into one. MaterialsSection switches from List to VStack with a card wrapper. AddMaterialView gets a delete button when editing.

**Tech Stack:** SwiftUI, SwiftData, design system tokens (Colors, Spacing, CornerRadius, Typography)

---

### Task 1: Merge Status + Info Cards in ProjectDetailView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift:34-82`

**Step 1: Replace the two separate card sections with one merged card**

Replace lines 34-82 (the "Status section" and "Info section" blocks) with a single combined card:

```swift
                        // Status + Info section (merged card)
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                Button {
                                    showChangeStatus = true
                                } label: {
                                    PieceStatusBadge(status: piece.status)
                                }
                                Spacer()
                                if let button = advanceStatusButton(for: piece) {
                                    Button(button.label) {
                                        advanceStatus()
                                    }
                                    .font(.typeStyle(.subheadline))
                                    .fontWeight(.medium)
                                    .foregroundStyle(Color.terracotta)
                                }
                            }

                            Text(piece.designer)
                                .font(.typeStyle(.title3))
                                .foregroundStyle(Color.walnut)

                            if let startedAt = piece.startedAt {
                                DetailRow(label: "Started", value: startedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let stitchedAt = piece.stitchedAt {
                                DetailRow(label: "Stitched", value: stitchedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let finishingAt = piece.finishingAt {
                                DetailRow(label: "Finishing", value: finishingAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let completedAt = piece.completedAt {
                                DetailRow(label: "Completed", value: completedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                        }
                        .padding(Spacing.lg)
                        .background(Color.cream)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.subtle)
                        .padding(.horizontal, Spacing.lg)
```

**Step 2: Build and verify in simulator**

Run in Xcode. Navigate to a project detail. Confirm:
- Status badge and advance button on top row
- Designer name below
- Date rows below that
- All in one cream card with rounded corners

**Step 3: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift
git commit -m "feat(ios): merge status and info cards in ProjectDetailView"
```

---

### Task 2: Replace List with VStack in MaterialsSection

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift` (full rewrite of body)

**Step 1: Rewrite the MaterialsSection body**

Replace the entire `body` computed property (lines 24-113) with:

```swift
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header with progress
            HStack {
                Text("Materials")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)

                Spacer()

                if !activeMaterials.isEmpty {
                    Text("\(acquiredCount)/\(activeMaterials.count) \u{2713}")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
            }

            // Progress bar (no percentage text)
            if !activeMaterials.isEmpty {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.parchment)
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.sage)
                            .frame(width: geo.size.width * progress, height: 6)
                            .animation(.easeInOut(duration: 0.3), value: progress)
                    }
                }
                .frame(height: 6)
            }

            // Material rows or empty state
            if activeMaterials.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: "No materials yet",
                    message: "Add supplies manually or scan your stitch guide"
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(activeMaterials.enumerated()), id: \.element.id) { index, material in
                        MaterialRowView(material: material)
                            .onTapGesture { onEditMaterial(material) }

                        if index < activeMaterials.count - 1 {
                            Divider()
                                .background(Color.parchment)
                        }
                    }
                }
            }

            // Action buttons
            HStack(spacing: Spacing.md) {
                Button {
                    onAddMaterial()
                } label: {
                    Label("Add Material", systemImage: "plus")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }

                Button {
                    onScanGuide()
                } label: {
                    Label("Scan Guide", systemImage: "camera.viewfinder")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .padding(.top, Spacing.sm)
        }
        .padding(Spacing.lg)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
        .padding(.horizontal, Spacing.lg)
    }
```

Key changes from the original:
- Removed the `List` wrapper — now a plain `VStack(spacing: 0)` with manual `Divider()` between rows
- Removed `.onDelete` modifier (delete moves to edit sheet in Task 4)
- Removed the `Text("\(Int(progress * 100))%")` line
- Removed the `frame(minHeight:)` hack
- Added card background (`Color.cream`), corner radius, and shadow
- Changed outer padding from `.padding(.horizontal, Spacing.lg)` to `.padding(Spacing.lg)` + horizontal padding on the card wrapper

**Step 2: Build and verify in simulator**

Navigate to a project with materials. Confirm:
- Materials section has cream card background with rounded corners
- All material rows visible (no cut-off)
- No percentage text, only "X/Y" count + progress bar
- Dividers between rows
- Add/Scan buttons at bottom inside the card

**Step 3: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift
git commit -m "feat(ios): replace List with VStack in MaterialsSection, add card wrapper"
```

---

### Task 3: Adjust MaterialRowView Padding

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift:42`

**Step 1: Keep vertical padding as-is**

The existing `.padding(.vertical, Spacing.sm)` on line 42 is fine inside the new VStack layout. No change needed here unless visual testing shows otherwise.

Actually — the `contentShape(Rectangle())` on line 43 should stay since `onTapGesture` is applied from the parent. No code changes needed for this file.

**Step 2: Visual verification**

In the simulator, confirm material rows have comfortable vertical spacing inside the card and tapping a row still opens the edit sheet.

---

### Task 4: Add Delete Button to AddMaterialView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift:69-70`

**Step 1: Add a delete section after the Notes section**

After the Notes `Section` block (line 69, after `.listRowBackground(Color.parchment)`), add a delete section that only appears when editing:

```swift
                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            deleteMaterial()
                        } label: {
                            HStack {
                                Spacer()
                                Text("Delete Material")
                                    .font(.typeStyle(.body))
                                    .fontWeight(.medium)
                                Spacer()
                            }
                        }
                        .listRowBackground(Color.parchment)
                    }
                }
```

**Step 2: Add the deleteMaterial function**

After the `save()` function (after line 147), add:

```swift
    private func deleteMaterial() {
        guard let editing else { return }
        let now = Date()
        editing.deletedAt = now
        editing.updatedAt = now
        dismiss()
    }
```

**Step 3: Build and verify in simulator**

- Tap a material row to open the edit sheet
- Confirm "Delete Material" button appears at the bottom in red
- Tap it — material should disappear from the list
- Confirm the button does NOT appear when adding a new material

**Step 4: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift
git commit -m "feat(ios): add delete button to AddMaterialView when editing"
```

---

### Task 5: Final Visual QA and Commit

**Step 1: Full flow test in simulator**

Test the complete kitting flow:
1. Create a new piece from stash
2. Start kitting (advance status)
3. Verify merged status+info card shows badge, designer, "Started" date
4. Add 3+ materials via "Add Material"
5. Verify all rows visible, no cut-off, progress bar shows correctly
6. Tap a material → edit sheet opens with delete button
7. Delete one material → list updates, progress updates
8. Toggle acquired on remaining materials → progress bar animates
9. Scan guide flow still works
10. Advance to WIP → verify status badge updates in the merged card

**Step 2: Commit if any fixups needed**

```
git add -A
git commit -m "fix(ios): kitting UI polish and fixups"
```
