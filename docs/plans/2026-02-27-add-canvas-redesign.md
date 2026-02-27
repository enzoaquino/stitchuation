# Add Canvas View Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign AddCanvasView, EditCanvasView, and MeshCountPicker from generic Form layout to a craft-journal-inspired card layout with square mesh swatch tiles, dashed-border photo zone, and styled "Add Another" banner.

**Architecture:** Pure SwiftUI view refactoring across 3 files. No model/sync/test changes needed (MeshCountPicker tests are logic-only and won't break from visual changes). Replace Form with ScrollView + VStack of cream cards. MeshCountPicker switches from capsule chips to square swatch tiles.

**Tech Stack:** SwiftUI, design system tokens (Colors, Spacing, CornerRadius, Motion, warmShadow)

**Reference files:**
- Design system: `docs/plans/2026-02-16-design-system.md`
- Shadows: `apps/ios/stitchuation/stitchuation/DesignSystem/Shadows.swift` — `warmShadow(.subtle)`, `.elevated`, `.floating`
- Motion: `apps/ios/stitchuation/stitchuation/DesignSystem/Motion.swift` — `Motion.bouncy`, `.gentle`, `.quick`, `Motion.staggerDelay(index:)`
- Spacing: `apps/ios/stitchuation/stitchuation/DesignSystem/Spacing.swift` — `Spacing.xxs` (2), `.xs` (4), `.sm` (8), `.md` (12), `.lg` (16), `.xl` (24), `.xxl` (32), `.xxxl` (48)
- CornerRadius: same file — `CornerRadius.subtle` (6), `.card` (12), `.modal` (16)
- Colors: `apps/ios/stitchuation/stitchuation/DesignSystem/Colors.swift` — `Color.linen`, `.parchment`, `.cream`, `.espresso`, `.walnut`, `.clay`, `.terracotta`, `.terracottaMuted`, `.sage`, `.slate`
- Font: `.playfair(15, weight: .semibold)` for section headers, `.typeStyle(.body)` for body text, `.typeStyle(.subheadline)` for captions

---

### Task 1: Redesign MeshCountPicker — Square Swatch Tiles

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/MeshCountPicker.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/MeshCountPickerTests.swift` (existing — should still pass without changes)

**Step 1: Replace chipButton and otherChipButton with square swatch tile style**

Replace the `chipRow`, `chipButton(for:)`, and `otherChipButton` computed properties (lines 72-143) with:

```swift
    private var chipRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(Self.standardCounts, id: \.self) { count in
                tileButton(for: count)
            }
            otherTileButton
        }
    }

    private func tileButton(for count: Int) -> some View {
        let isSelected = selectedPreset == count
        return Button {
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
                .font(isSelected
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(isSelected ? .white : Color.walnut)
                .frame(width: 44, height: 44)
                .background(isSelected ? Color.terracotta : Color.linen)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.subtle)
                        .stroke(
                            isSelected ? Color.clear : Color.slate.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .warmShadow(isSelected ? .subtle : .subtle)
                .opacity(isSelected ? 1.0 : 0.85)
        }
        .buttonStyle(.plain)
        .scaleEffect(chipScale[count] ?? 1.0)
    }

    private var otherTileButton: some View {
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
                .foregroundStyle(isCustomMode ? .white : Color.walnut)
                .frame(height: 44)
                .padding(.horizontal, Spacing.md)
                .background(isCustomMode ? Color.terracotta : Color.linen)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.subtle)
                        .stroke(
                            isCustomMode ? Color.clear : Color.slate.opacity(0.3),
                            lineWidth: 1
                        )
                )
                .warmShadow(isCustomMode ? .subtle : .subtle)
                .opacity(isCustomMode ? 1.0 : 0.85)
        }
        .buttonStyle(.plain)
        .scaleEffect(otherChipScale)
    }
```

Key changes from old capsule chips:
- `Capsule()` → `RoundedRectangle(cornerRadius: CornerRadius.subtle)` (6pt radius = square-ish)
- Fixed 44x44pt frame for number tiles (larger touch targets)
- "Other" tile: same 44pt height, wider with horizontal padding
- Border: 1pt `slate.opacity(0.3)` (was 0.5pt `clay.opacity(0.3)`)
- Selected color: `.white` for text (was `Color.cream`)
- Unselected opacity: 0.85 for subtle depth
- Added `warmShadow(.subtle)` on all tiles

**Step 2: Verify existing tests still pass**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/MeshCountPickerTests 2>&1 | tail -20`

Expected: All 4 tests PASS (they test `initialSelection` logic which is unchanged).

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/MeshCountPicker.swift
git commit -m "feat(ios): redesign MeshCountPicker with square swatch tiles"
```

---

### Task 2: Rewrite AddCanvasView — ScrollView + Cards + Photo Zone

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Step 1: Replace the body computed property (lines 36-158)**

Keep all state variables (lines 1-35) and the `saveCanvas()` function (lines 161-241) untouched. Replace only the `body` (lines 36-158) with:

```swift
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Photo zone
                    photoSection

                    // Canvas Info card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Canvas Info")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            TextField("Designer (e.g. Melissa Shirley)", text: $designer)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            TextField("Design Name", text: $designName)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Details card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Details")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            Toggle("Date Acquired", isOn: $showDatePicker)
                                .font(.typeStyle(.body))
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)

                            if showDatePicker {
                                DatePicker(
                                    "Acquired",
                                    selection: Binding(
                                        get: { acquiredAt ?? Date() },
                                        set: { acquiredAt = $0 }
                                    ),
                                    displayedComponents: .date
                                )
                                .datePickerStyle(.graphical)
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)
                            }

                            Divider().background(Color.parchment)

                            TextField("Size (e.g. 13x18, 10\" round)", text: $size)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            MeshCountPicker(meshCount: $meshCount)
                                .padding(.vertical, Spacing.md)

                            if !isMeshCountValid {
                                Text("Enter a positive number")
                                    .font(.typeStyle(.footnote))
                                    .foregroundStyle(Color.terracotta)
                            }

                            Divider().background(Color.parchment)

                            TextField("Notes", text: $notes, axis: .vertical)
                                .lineLimit(3...6)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Add Another banner
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .foregroundStyle(Color.clay)
                        Text("Add Another")
                            .font(.typeStyle(.body))
                            .foregroundStyle(Color.walnut)
                        Spacer()
                        Toggle("", isOn: $addAnother)
                            .labelsHidden()
                            .tint(Color.terracotta)
                    }
                    .padding(Spacing.lg)
                    .background(Color.terracottaMuted.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.xxl)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle("Add Canvas")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveCanvas() }
                        .disabled(designer.isEmpty || designName.isEmpty || !isMeshCountValid)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                Button("Take Photo") { showCamera = true }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImageData = data
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhoto, matching: .images)
            .onChange(of: selectedPhoto) { _, newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self) {
                        selectedImageData = data
                    }
                }
            }
        }
    }
```

**Step 2: Add the photoSection computed property**

Add this after the `isMeshCountValid` property (after line 34), before `body`:

```swift
    @ViewBuilder
    private var photoSection: some View {
        Button {
            if CameraView.isCameraAvailable {
                showPhotoOptions = true
            } else {
                showLibraryPicker = true
            }
        } label: {
            if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
            } else {
                VStack(spacing: Spacing.md) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.terracotta)
                    Text("Add Photo")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.walnut)
                }
                .frame(height: 180)
                .frame(maxWidth: .infinity)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.card)
                        .strokeBorder(
                            Color.clay.opacity(0.4),
                            style: StrokeStyle(lineWidth: 1.5, dash: [8, 6])
                        )
                )
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.lg)
    }
```

Key differences from old photo section:
- Dashed border instead of solid parchment fill (craft journal feel)
- Icon bumped from 32pt to 40pt
- Height bumped from 140pt to 180pt
- With photo: warm shadow added
- No longer inside a Form Section — standalone on linen background

**Step 3: Build and verify in simulator**

Navigate to Add Canvas. Confirm:
- Dashed-border photo zone at top
- Two cream cards (Canvas Info, Details) with Playfair headers inside
- Square mesh swatch tiles
- "Add Another" in warm terracotta-tinted banner
- All inputs functional

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): redesign AddCanvasView with card layout and dashed photo zone"
```

---

### Task 3: Rewrite EditCanvasView — ScrollView + Cards

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`

**Step 1: Replace the body computed property (lines 36-100)**

Keep all state variables (lines 1-34) and `saveChanges()` (lines 102-112) untouched. Replace `body` with:

```swift
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Canvas Info card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Canvas Info")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            TextField("Designer", text: $designer)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            TextField("Design Name", text: $designName)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Details card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Details")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            Toggle("Date Acquired", isOn: $showDatePicker)
                                .font(.typeStyle(.body))
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)

                            if showDatePicker {
                                DatePicker(
                                    "Acquired",
                                    selection: Binding(
                                        get: { acquiredAt ?? Date() },
                                        set: { acquiredAt = $0 }
                                    ),
                                    displayedComponents: .date
                                )
                                .datePickerStyle(.graphical)
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)
                            }

                            Divider().background(Color.parchment)

                            TextField("Size (e.g. 13x18)", text: $size)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            MeshCountPicker(meshCount: $meshCount)
                                .padding(.vertical, Spacing.md)

                            if !isMeshCountValid {
                                Text("Enter a positive number")
                                    .font(.typeStyle(.footnote))
                                    .foregroundStyle(Color.terracotta)
                            }

                            Divider().background(Color.parchment)

                            TextField("Notes", text: $notes, axis: .vertical)
                                .lineLimit(3...6)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.xxl)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle("Edit Canvas")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveChanges() }
                        .disabled(designer.isEmpty || designName.isEmpty || !isMeshCountValid)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }
```

This is identical to AddCanvasView's card structure minus the photo section and "Add Another" banner.

**Step 2: Build and verify in simulator**

Open Edit Canvas on an existing piece. Confirm:
- Two cream cards match AddCanvasView's style
- All fields populate with existing data
- Save works correctly

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift
git commit -m "feat(ios): redesign EditCanvasView with card layout"
```

---

### Task 4: Run MeshCountPicker Tests + Visual QA

**Step 1: Run MeshCountPicker tests**

Run: `cd apps/ios && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/MeshCountPickerTests 2>&1 | tail -20`

Expected: All 4 tests PASS.

**Step 2: Full flow visual QA in simulator**

Test AddCanvasView:
1. Open Add Canvas — verify dashed-border photo zone, cream cards, square mesh tiles
2. Tap a mesh tile — verify terracotta fill, scale animation
3. Tap "Other" — verify custom field appears
4. Tap "Add Photo" — verify camera/library dialog
5. Select a photo — verify it fills the zone with rounded corners and shadow
6. Fill all fields, toggle "Add Another", save — verify form resets correctly
7. Save without "Add Another" — verify sheet dismisses

Test EditCanvasView:
1. Open Edit Canvas on existing piece — verify card layout matches AddCanvasView
2. Verify existing mesh count is pre-selected on the correct tile
3. Save edits — verify they persist

**Step 3: Commit any fixups**

```bash
git add -A
git commit -m "fix(ios): add canvas redesign polish and fixups"
```
