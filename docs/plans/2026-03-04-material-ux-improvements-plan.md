# Material UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three small iOS UX improvements: show quantity on scan import, swipe-to-delete materials, mark all acquired.

**Architecture:** All changes are iOS-only SwiftUI view modifications. No API or model changes needed.

**Tech Stack:** SwiftUI, SwiftData

---

### Task 1: Fix quantity display on scan import preview

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift:37-41`

**Step 1: Update the quantity conditional**

Replace the existing block (lines 37-41):

```swift
                                    if materials[index].quantity > 0, let unit = materials[index].unit {
                                        Text("\(materials[index].quantity) \(unit)")
                                            .font(.typeStyle(.data))
                                            .foregroundStyle(Color.walnut)
                                    }
```

With:

```swift
                                    if materials[index].quantity > 0 {
                                        Text(materials[index].unit.map { "\(materials[index].quantity) \($0)" } ?? "\(materials[index].quantity)")
                                            .font(.typeStyle(.data))
                                            .foregroundStyle(Color.walnut)
                                    }
```

**Step 2: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift
git commit -m "fix(ios): show quantity on scan import even without unit"
```

---

### Task 2: Add swipe-to-delete on materials list

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift:131-141`

**Step 1: Convert VStack to List and add swipe actions**

Replace the materials VStack block (lines 131-141):

```swift
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
```

With:

```swift
                List {
                    ForEach(activeMaterials) { material in
                        MaterialRowView(material: material)
                            .onTapGesture { onEditMaterial(material) }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    withAnimation(Motion.gentle) {
                                        material.deletedAt = Date()
                                        material.updatedAt = Date()
                                    }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .listRowBackground(Color.cream)
                            .listRowSeparatorTint(Color.parchment)
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .scrollDisabled(true)
                .frame(minHeight: CGFloat(activeMaterials.count) * 60)
```

**Notes:**
- `List` is needed because `.swipeActions` only works on List rows, not plain VStack/ForEach.
- `.scrollDisabled(true)` and `.frame(minHeight:)` keep the list from scrolling independently — the outer ScrollView handles scrolling.
- `.listRowInsets` zeroed out to match the existing edge-to-edge layout.
- Manual dividers removed since List provides its own separators (tinted with `.listRowSeparatorTint`).

**Step 2: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift
git commit -m "feat(ios): add swipe-to-delete on materials list"
```

---

### Task 3: Add "Mark All Acquired" button

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift:144-162`

**Step 1: Add the button to the footer HStack**

The footer HStack is at lines 144-162. Add a "Mark All" button after the "Scan Guide" button, conditionally shown when there are un-acquired materials.

Replace the footer HStack (lines 144-162):

```swift
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
```

With:

```swift
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

                if acquiredCount < activeMaterials.count {
                    Button {
                        withAnimation(Motion.gentle) {
                            for material in activeMaterials where !material.acquired {
                                material.acquired = true
                                material.updatedAt = Date()
                            }
                        }
                    } label: {
                        Label("Mark All", systemImage: "checkmark.circle")
                            .font(.typeStyle(.subheadline))
                            .fontWeight(.medium)
                            .foregroundStyle(Color.terracotta)
                    }
                }
            }
```

**Step 2: Commit**

```
git add apps/ios/stitchuation/stitchuation/Views/MaterialsSection.swift
git commit -m "feat(ios): add mark all acquired button to materials"
```
