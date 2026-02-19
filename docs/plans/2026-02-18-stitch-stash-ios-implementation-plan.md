# Stitch Stash iOS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the iOS side of the Stitch Stash feature — a new "Stitch Stash" tab where users can browse, add, view, and edit their canvas collection with image support.

**Architecture:** SwiftData `Canvas` model following the `NeedleThread` pattern. MVVM with `@Observable` view models. Three views (list, add, detail). PHPicker for image selection. SyncEngine extended to handle `"canvas"` entity type alongside `"thread"`. NetworkClient gains a multipart upload method for images.

**Tech Stack:** SwiftUI, SwiftData, PhotosUI (PHPicker), Swift Testing

**Design doc:** `docs/plans/2026-02-18-stitch-stash-design.md`

**API (already complete):** Canvas CRUD at `/canvases`, image upload at `/canvases/:id/image`, image serving at `/images/*`, sync supports `"canvas"` entity type.

---

### Task 1: Canvas SwiftData Model

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/Canvas.swift`

**Step 1: Create the Canvas model**

Create `apps/ios/stitchuation/stitchuation/Models/Canvas.swift`:

```swift
import Foundation
import SwiftData

@Model
final class Canvas {
    @Attribute(.unique) var id: UUID
    var designer: String
    var designName: String
    var acquiredAt: Date?
    var imageKey: String?
    var size: String?
    var meshCount: Int?
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        designer: String,
        designName: String,
        acquiredAt: Date? = nil,
        imageKey: String? = nil,
        size: String? = nil,
        meshCount: Int? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.designer = designer
        self.designName = designName
        self.acquiredAt = acquiredAt
        self.imageKey = imageKey
        self.size = size
        self.meshCount = meshCount
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
```

**Step 2: Register Canvas in ModelContainer**

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, update the `ModelContainer` init:

Change:
```swift
modelContainer = try ModelContainer(for: NeedleThread.self)
```
To:
```swift
modelContainer = try ModelContainer(for: NeedleThread.self, Canvas.self)
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/Canvas.swift apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): add Canvas SwiftData model

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Canvas Model Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuationTests/CanvasTests.swift`

**Step 1: Write the tests**

Create `apps/ios/stitchuation/stitchuationTests/CanvasTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

struct CanvasTests {
    @Test func initSetsRequiredFields() {
        let canvas = Canvas(designer: "Melissa Shirley", designName: "Nutcracker")

        #expect(canvas.designer == "Melissa Shirley")
        #expect(canvas.designName == "Nutcracker")
        #expect(canvas.id != UUID(uuidString: "00000000-0000-0000-0000-000000000000"))
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = Canvas(designer: "Test", designName: "Test")
        let after = Date()

        #expect(canvas.createdAt >= before)
        #expect(canvas.createdAt <= after)
        #expect(canvas.updatedAt >= before)
        #expect(canvas.updatedAt <= after)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let canvas = Canvas(designer: "Test", designName: "Test")

        #expect(canvas.acquiredAt == nil)
        #expect(canvas.imageKey == nil)
        #expect(canvas.size == nil)
        #expect(canvas.meshCount == nil)
        #expect(canvas.notes == nil)
        #expect(canvas.deletedAt == nil)
        #expect(canvas.syncedAt == nil)
    }

    @Test func initWithAllFields() {
        let date = Date()
        let canvas = Canvas(
            designer: "Kirk & Bradley",
            designName: "Gingerbread",
            acquiredAt: date,
            imageKey: "canvases/user1/canvas1.jpg",
            size: "14x18",
            meshCount: 18,
            notes: "Gift from Mom"
        )

        #expect(canvas.designer == "Kirk & Bradley")
        #expect(canvas.designName == "Gingerbread")
        #expect(canvas.acquiredAt == date)
        #expect(canvas.imageKey == "canvases/user1/canvas1.jpg")
        #expect(canvas.size == "14x18")
        #expect(canvas.meshCount == 18)
        #expect(canvas.notes == "Gift from Mom")
    }

    @Test func initWithClientProvidedUUID() {
        let customId = UUID()
        let canvas = Canvas(id: customId, designer: "Test", designName: "Test")

        #expect(canvas.id == customId)
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuationTests/CanvasTests.swift
git commit -m "test(ios): add Canvas model tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: StashListViewModel

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/ViewModels/StashListViewModel.swift`

**Step 1: Create the view model**

Create `apps/ios/stitchuation/stitchuation/ViewModels/StashListViewModel.swift`:

```swift
import Foundation

@MainActor
@Observable
final class StashListViewModel {
    var searchText = ""
}
```

Follows the same minimal pattern as `ThreadListViewModel` — just state for the search filter.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ViewModels/StashListViewModel.swift
git commit -m "feat(ios): add StashListViewModel

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: StashListView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift`

**Step 1: Create the stash list view**

Create `apps/ios/stitchuation/stitchuation/Views/StashListView.swift`:

```swift
import SwiftUI
import SwiftData

struct StashListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: StashListView.notDeletedPredicate,
        sort: \Canvas.createdAt,
        order: .reverse
    )
    private var canvases: [Canvas]

    private static let notDeletedPredicate = #Predicate<Canvas> {
        $0.deletedAt == nil
    }

    @State private var viewModel = StashListViewModel()
    @State private var showAddCanvas = false

    var filteredCanvases: [Canvas] {
        guard !viewModel.searchText.isEmpty else { return canvases }
        let search = viewModel.searchText.lowercased()
        return canvases.filter { canvas in
            canvas.designer.lowercased().contains(search)
                || canvas.designName.lowercased().contains(search)
        }
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredCanvases.isEmpty && viewModel.searchText.isEmpty {
                VStack(spacing: Spacing.lg) {
                    Image(systemName: "square.stack.3d.up")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.clay)
                    Text("No canvases yet")
                        .font(.playfair(22, weight: .semibold))
                        .foregroundStyle(Color.espresso)
                    Text("Tap + to add your first canvas")
                        .font(.sourceSerif(17))
                        .foregroundStyle(Color.walnut)
                }
                .padding(Spacing.xxxl)
            } else {
                List {
                    ForEach(filteredCanvases, id: \.id) { canvas in
                        NavigationLink(value: canvas.id) {
                            CanvasRowView(canvas: canvas)
                        }
                        .listRowBackground(Color.cream)
                    }
                    .onDelete { offsets in
                        deleteCanvases(at: offsets)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search canvases")
        .navigationTitle("Stitch Stash")
        .navigationDestination(for: UUID.self) { canvasId in
            CanvasDetailView(canvasId: canvasId)
        }
        .toolbar {
            Button("Add", systemImage: "plus") {
                showAddCanvas = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showAddCanvas) {
            AddCanvasView()
        }
    }

    private func deleteCanvases(at offsets: IndexSet) {
        for index in offsets {
            let canvas = filteredCanvases[index]
            canvas.deletedAt = Date()
            canvas.updatedAt = Date()
        }
    }
}

struct CanvasRowView: View {
    let canvas: Canvas

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: canvas.imageKey, size: 48)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(canvas.designName)
                    .font(.sourceSerif(17, weight: .semibold))
                    .foregroundStyle(Color.espresso)
                Text(canvas.designer)
                    .font(.sourceSerif(15))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()

            if let meshCount = canvas.meshCount {
                Text("\(meshCount)m")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(Color.clay)
            }
        }
        .padding(.vertical, Spacing.sm)
    }
}
```

**Note:** `CanvasThumbnail` and `CanvasDetailView` will be created in subsequent tasks. For now, just create placeholder stubs so this compiles:

Create a temporary `CanvasThumbnail` in the same file (will be moved to DesignSystem in Task 6):

```swift
struct CanvasThumbnail: View {
    let imageKey: String?
    var size: CGFloat = 48

    var body: some View {
        RoundedRectangle(cornerRadius: CornerRadius.subtle)
            .fill(Color.parchment)
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(Color.clay)
            }
            .frame(width: size, height: size)
    }
}
```

Also create a temporary `CanvasDetailView` stub:

Create `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`:

```swift
import SwiftUI
import SwiftData

struct CanvasDetailView: View {
    let canvasId: UUID

    var body: some View {
        Text("Canvas Detail — coming next")
            .font(.sourceSerif(17))
            .foregroundStyle(Color.walnut)
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/StashListView.swift apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): add StashListView with canvas row and search

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Add Stitch Stash Tab

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift`

**Step 1: Replace the Projects placeholder tab with the Stitch Stash tab**

In `ContentView.swift`, replace the second tab (Projects placeholder) with the Stitch Stash tab:

Change:
```swift
NavigationStack {
    Text("Projects coming soon")
        .font(.sourceSerif(17))
        .foregroundStyle(Color.walnut)
        .navigationTitle("Projects")
}
.tabItem {
    Label("Projects", systemImage: "folder")
}
```

To:
```swift
NavigationStack {
    StashListView()
}
.tabItem {
    Label("Stitch Stash", systemImage: "square.stack.3d.up")
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): add Stitch Stash tab to tab bar

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: CanvasThumbnail Design System Component

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift` (remove inline CanvasThumbnail stub)

**Step 1: Create the proper CanvasThumbnail component**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift`:

```swift
import SwiftUI

struct CanvasThumbnail: View {
    let imageKey: String?
    var size: CGFloat = 48

    var body: some View {
        if let imageKey {
            // TODO: Load from API via /images/* endpoint with auth
            // For now, show placeholder since image loading requires NetworkClient
            placeholderView
        } else {
            placeholderView
        }
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: CornerRadius.subtle)
            .fill(Color.parchment)
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(Color.clay)
            }
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.subtle)
                    .stroke(Color.slate.opacity(0.3), lineWidth: 0.5)
            )
            .frame(width: size, height: size)
    }
}
```

**Step 2: Remove the inline CanvasThumbnail stub from StashListView.swift**

Delete the `CanvasThumbnail` struct at the bottom of `StashListView.swift` (it's now in its own file).

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift apps/ios/stitchuation/stitchuation/Views/StashListView.swift
git commit -m "feat(ios): add CanvasThumbnail design system component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: AddCanvasView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Step 1: Create the add canvas form**

Create `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`:

```swift
import SwiftUI
import PhotosUI

struct AddCanvasView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var designer = ""
    @State private var designName = ""
    @State private var acquiredAt: Date?
    @State private var showDatePicker = false
    @State private var size = ""
    @State private var meshCount = ""
    @State private var notes = ""

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImageData: Data?

    @State private var addAnother = false

    private var meshCountValue: Int? {
        guard !meshCount.isEmpty else { return nil }
        return Int(meshCount)
    }

    private var isMeshCountValid: Bool {
        meshCount.isEmpty || (meshCountValue != nil && meshCountValue! > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 200)
                                .frame(maxWidth: .infinity)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        } else {
                            VStack(spacing: Spacing.md) {
                                Image(systemName: "photo.badge.plus")
                                    .font(.system(size: 32))
                                    .foregroundStyle(Color.terracotta)
                                Text("Add Photo")
                                    .font(.sourceSerif(15))
                                    .foregroundStyle(Color.walnut)
                            }
                            .frame(height: 140)
                            .frame(maxWidth: .infinity)
                            .background(Color.parchment)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        }
                    }
                    .onChange(of: selectedPhoto) { _, newItem in
                        Task {
                            if let data = try? await newItem?.loadTransferable(type: Data.self) {
                                selectedImageData = data
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                }

                Section {
                    TextField("Designer (e.g. Melissa Shirley)", text: $designer)
                    TextField("Design Name", text: $designName)
                } header: {
                    Text("Canvas Info")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    Toggle("Date Acquired", isOn: $showDatePicker)
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
                    }

                    TextField("Size (e.g. 13x18, 10\" round)", text: $size)

                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.sourceSerif(15))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.sourceSerif(12))
                            .foregroundStyle(Color.terracotta)
                    }

                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Details")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Toggle("Add Another", isOn: $addAnother)
            }
            .font(.sourceSerif(17))
            .scrollContentBackground(.hidden)
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
        }
    }

    private func saveCanvas() {
        let canvas = Canvas(
            designer: designer,
            designName: designName,
            acquiredAt: showDatePicker ? acquiredAt : nil,
            size: size.isEmpty ? nil : size,
            meshCount: meshCountValue,
            notes: notes.isEmpty ? nil : notes
        )
        modelContext.insert(canvas)

        // TODO: Upload selectedImageData to API when image upload is wired
        // For now, image is selected but not uploaded (needs NetworkClient)

        if addAnother {
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
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): add AddCanvasView with photo picker and form

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: CanvasDetailView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`

**Step 1: Replace the stub with the full detail view**

Replace the content of `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`:

```swift
import SwiftUI
import SwiftData

struct CanvasDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let canvasId: UUID

    @State private var canvas: Canvas?
    @State private var showEditSheet = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            if let canvas {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Hero image
                        CanvasThumbnail(imageKey: canvas.imageKey, size: .infinity)
                            .frame(height: 260)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .padding(.horizontal, Spacing.lg)

                        // Info section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text(canvas.designName)
                                .font(.playfair(28, weight: .bold))
                                .foregroundStyle(Color.espresso)

                            Text(canvas.designer)
                                .font(.sourceSerif(19))
                                .foregroundStyle(Color.walnut)

                            if canvas.acquiredAt != nil || canvas.size != nil || canvas.meshCount != nil {
                                Divider().background(Color.slate.opacity(0.3))

                                VStack(alignment: .leading, spacing: Spacing.sm) {
                                    if let acquiredAt = canvas.acquiredAt {
                                        DetailRow(label: "Acquired", value: acquiredAt.formatted(date: .abbreviated, time: .omitted))
                                    }
                                    if let size = canvas.size {
                                        DetailRow(label: "Size", value: size)
                                    }
                                    if let meshCount = canvas.meshCount {
                                        DetailRow(label: "Mesh", value: "\(meshCount) count")
                                    }
                                }
                            }

                            if let notes = canvas.notes, !notes.isEmpty {
                                Divider().background(Color.slate.opacity(0.3))

                                Text(notes)
                                    .font(.sourceSerif(17))
                                    .foregroundStyle(Color.walnut)
                            }
                        }
                        .padding(.horizontal, Spacing.lg)
                    }
                    .padding(.vertical, Spacing.lg)
                }
            } else {
                ProgressView()
                    .tint(Color.terracotta)
            }
        }
        .navigationTitle(canvas?.designName ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canvas != nil {
                Menu {
                    Button("Edit", systemImage: "pencil") {
                        showEditSheet = true
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let canvas {
                EditCanvasView(canvas: canvas)
            }
        }
        .confirmationDialog("Delete Canvas", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let canvas {
                    canvas.deletedAt = Date()
                    canvas.updatedAt = Date()
                    dismiss()
                }
            }
        } message: {
            Text("Are you sure you want to delete this canvas?")
        }
        .task {
            loadCanvas()
        }
    }

    private func loadCanvas() {
        let id = canvasId
        let descriptor = FetchDescriptor<Canvas>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        canvas = try? modelContext.fetch(descriptor).first
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.sourceSerif(15))
                .foregroundStyle(Color.clay)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.sourceSerif(15, weight: .medium))
                .foregroundStyle(Color.espresso)
        }
    }
}
```

**Note:** `EditCanvasView` is created in the next task.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): add CanvasDetailView with hero image and details

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: EditCanvasView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`

**Step 1: Create the edit canvas view**

Create `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift`:

```swift
import SwiftUI
import PhotosUI

struct EditCanvasView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @Bindable var canvas: Canvas

    @State private var designer: String
    @State private var designName: String
    @State private var acquiredAt: Date?
    @State private var showDatePicker: Bool
    @State private var size: String
    @State private var meshCount: String
    @State private var notes: String

    init(canvas: Canvas) {
        self.canvas = canvas
        _designer = State(initialValue: canvas.designer)
        _designName = State(initialValue: canvas.designName)
        _acquiredAt = State(initialValue: canvas.acquiredAt)
        _showDatePicker = State(initialValue: canvas.acquiredAt != nil)
        _size = State(initialValue: canvas.size ?? "")
        _meshCount = State(initialValue: canvas.meshCount.map { String($0) } ?? "")
        _notes = State(initialValue: canvas.notes ?? "")
    }

    private var meshCountValue: Int? {
        guard !meshCount.isEmpty else { return nil }
        return Int(meshCount)
    }

    private var isMeshCountValid: Bool {
        meshCount.isEmpty || (meshCountValue != nil && meshCountValue! > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Designer", text: $designer)
                    TextField("Design Name", text: $designName)
                } header: {
                    Text("Canvas Info")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    Toggle("Date Acquired", isOn: $showDatePicker)
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
                    }

                    TextField("Size (e.g. 13x18)", text: $size)

                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.sourceSerif(15))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.sourceSerif(12))
                            .foregroundStyle(Color.terracotta)
                    }

                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Details")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
            }
            .font(.sourceSerif(17))
            .scrollContentBackground(.hidden)
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

    private func saveChanges() {
        canvas.designer = designer
        canvas.designName = designName
        canvas.acquiredAt = showDatePicker ? acquiredAt : nil
        canvas.size = size.isEmpty ? nil : size
        canvas.meshCount = meshCountValue
        canvas.notes = notes.isEmpty ? nil : notes
        canvas.updatedAt = Date()
        dismiss()
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift
git commit -m "feat(ios): add EditCanvasView for editing canvas details

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: SyncEngine — Canvas Support

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Add canvas gathering to the sync push phase**

In the `sync()` method, after gathering unsynced threads, add canvas gathering:

```swift
// Gather unsynced canvases
let allCanvasDescriptor = FetchDescriptor<Canvas>()
let allCanvases = try context.fetch(allCanvasDescriptor)
let unsyncedCanvases = allCanvases.filter { canvas in
    canvas.syncedAt == nil || canvas.updatedAt > (canvas.syncedAt ?? .distantPast)
}

// Build canvas sync changes
let canvasChanges: [SyncChange] = unsyncedCanvases.map { canvas in
    let isDeleted = canvas.deletedAt != nil
    var data: [String: AnyCodable]?
    if !isDeleted {
        data = [
            "designer": AnyCodable(canvas.designer),
            "designName": AnyCodable(canvas.designName),
            "acquiredAt": AnyCodable(canvas.acquiredAt.map { formatter.string(from: $0) } ?? NSNull()),
            "imageKey": AnyCodable(canvas.imageKey ?? NSNull()),
            "size": AnyCodable(canvas.size ?? NSNull()),
            "meshCount": AnyCodable(canvas.meshCount ?? NSNull()),
            "notes": AnyCodable(canvas.notes ?? NSNull()),
        ]
    }
    return SyncChange(
        type: "canvas",
        action: isDeleted ? "delete" : "upsert",
        id: canvas.id.uuidString,
        data: data,
        updatedAt: formatter.string(from: canvas.updatedAt),
        deletedAt: canvas.deletedAt.map { formatter.string(from: $0) }
    )
}
```

Merge changes arrays:
```swift
let allChanges = changes + canvasChanges
let request = SyncRequest(lastSync: lastSyncTimestamp, changes: allChanges)
```

**Step 2: Add canvas processing to the sync pull phase**

In the response processing loop, add a case for `"canvas"`:

```swift
for change in response.changes {
    if change.type == "thread" {
        // ... existing thread logic ...
    } else if change.type == "canvas" {
        guard let uuid = UUID(uuidString: change.id) else { continue }

        let fetchDescriptor = FetchDescriptor<Canvas>(
            predicate: #Predicate { $0.id == uuid }
        )
        let existing = try context.fetch(fetchDescriptor).first
        let serverUpdatedAt = formatter.date(from: change.updatedAt) ?? Date()

        if change.action == "delete" {
            if let canvas = existing {
                guard serverUpdatedAt >= canvas.updatedAt else { continue }
                canvas.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                canvas.updatedAt = serverUpdatedAt
                canvas.syncedAt = Date()
            }
        } else if change.action == "upsert" {
            if let canvas = existing {
                guard serverUpdatedAt >= canvas.updatedAt else { continue }
                applyCanvasData(change.data, to: canvas)
                canvas.updatedAt = serverUpdatedAt
                canvas.syncedAt = Date()
            } else {
                let canvas = Canvas(
                    id: uuid,
                    designer: stringValue(change.data, key: "designer") ?? "",
                    designName: stringValue(change.data, key: "designName") ?? ""
                )
                applyCanvasData(change.data, to: canvas)
                canvas.updatedAt = serverUpdatedAt
                canvas.syncedAt = Date()
                context.insert(canvas)
            }
        }
    }
}
```

**Step 3: Mark pushed canvases as synced**

After the existing thread sync marking:
```swift
for canvas in unsyncedCanvases {
    canvas.syncedAt = Date()
}
```

**Step 4: Add the applyCanvasData helper method**

Add alongside the existing `applyData` method:

```swift
private func applyCanvasData(_ data: [String: AnyCodable]?, to canvas: Canvas) {
    guard let data else { return }
    if let designer = data["designer"]?.value as? String { canvas.designer = designer }
    if let designName = data["designName"]?.value as? String { canvas.designName = designName }
    if let v = data["acquiredAt"] {
        if v.value is NSNull {
            canvas.acquiredAt = nil
        } else if let str = v.value as? String {
            canvas.acquiredAt = Self.dateFormatter.date(from: str)
        }
    }
    if let v = data["imageKey"] {
        canvas.imageKey = v.value is NSNull ? nil : v.value as? String
    }
    if let v = data["size"] {
        canvas.size = v.value is NSNull ? nil : v.value as? String
    }
    if let v = data["meshCount"] {
        if v.value is NSNull {
            canvas.meshCount = nil
        } else if let num = v.value as? Int {
            canvas.meshCount = num
        }
    }
    if let v = data["notes"] {
        canvas.notes = v.value is NSNull ? nil : v.value as? String
    }
}
```

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): add canvas entity support to SyncEngine

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: NetworkClient — Multipart Upload

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift`

**Step 1: Add a multipart upload method to NetworkClient**

Add this method to the `NetworkClient` actor:

```swift
func uploadImage(path: String, imageData: Data, filename: String) async throws -> Data {
    let boundary = UUID().uuidString
    var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    if let token = accessToken {
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    var body = Data()
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"image\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
    body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    body.append(imageData)
    body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

    urlRequest.httpBody = body

    let (data, response) = try await URLSession.shared.data(for: urlRequest)

    guard let httpResponse = response as? HTTPURLResponse else {
        throw APIError.serverError(0)
    }

    switch httpResponse.statusCode {
    case 200...299:
        return data
    case 401:
        throw APIError.unauthorized
    case 400...499:
        throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
    default:
        throw APIError.serverError(httpResponse.statusCode)
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift
git commit -m "feat(ios): add multipart image upload to NetworkClient

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: Wire Image Upload into AddCanvasView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`

**Step 1: Pass NetworkClient through the environment**

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, we need to make the `networkClient` available to views. Add an environment key.

Create `apps/ios/stitchuation/stitchuation/Sync/NetworkClientKey.swift`:

```swift
import SwiftUI

private struct NetworkClientKey: EnvironmentKey {
    static let defaultValue: NetworkClient? = nil
}

extension EnvironmentValues {
    var networkClient: NetworkClient? {
        get { self[NetworkClientKey.self] }
        set { self[NetworkClientKey.self] = newValue }
    }
}
```

In `stitchuationApp.swift`, add the environment modifier to the content view:

```swift
contentView
    .environment(\.networkClient, networkClient)
    .task { ... }
```

**Step 2: Use NetworkClient in AddCanvasView for image upload**

In `AddCanvasView.swift`, add to the top of the struct:

```swift
@Environment(\.networkClient) private var networkClient
```

Update the `saveCanvas()` function to upload the image after inserting the canvas:

```swift
private func saveCanvas() {
    let canvas = Canvas(
        designer: designer,
        designName: designName,
        acquiredAt: showDatePicker ? acquiredAt : nil,
        size: size.isEmpty ? nil : size,
        meshCount: meshCountValue,
        notes: notes.isEmpty ? nil : notes
    )
    modelContext.insert(canvas)

    if let imageData = selectedImageData, let networkClient {
        let canvasId = canvas.id
        Task {
            do {
                let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
                _ = try await networkClient.uploadImage(
                    path: "/canvases/\(canvasId.uuidString)/image",
                    imageData: compressed,
                    filename: "\(canvasId.uuidString).jpg"
                )
            } catch {
                // Image upload failed — canvas still saved locally
                // Image will need manual re-upload later
            }
        }
    }

    if addAnother {
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
}

private func compressImage(_ data: Data, maxBytes: Int) -> Data {
    guard let uiImage = UIImage(data: data) else { return data }
    var quality: CGFloat = 0.8
    var compressed = uiImage.jpegData(compressionQuality: quality) ?? data
    while compressed.count > maxBytes && quality > 0.1 {
        quality -= 0.1
        compressed = uiImage.jpegData(compressionQuality: quality) ?? data
    }
    return compressed
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/NetworkClientKey.swift apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): wire image upload into AddCanvasView

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 13: Build Verification

**Step 1: Verify the project builds**

Run from the command line:
```bash
cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -quiet 2>&1 | tail -5
```

Expected: `** BUILD SUCCEEDED **`

If build errors occur, fix them and commit.

**Step 2: Run tests**

```bash
cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -quiet 2>&1 | tail -10
```

Expected: All tests pass, including the new `CanvasTests`.

**Step 3: Final commit if any fixes were needed**

```bash
git commit -m "fix(ios): address build issues from stitch stash implementation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary of Files

**New files:**
- `apps/ios/stitchuation/stitchuation/Models/Canvas.swift` — SwiftData model
- `apps/ios/stitchuation/stitchuation/ViewModels/StashListViewModel.swift` — Search state
- `apps/ios/stitchuation/stitchuation/Views/StashListView.swift` — List + row + search
- `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift` — Form + photo picker
- `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift` — Full canvas view
- `apps/ios/stitchuation/stitchuation/Views/EditCanvasView.swift` — Edit form
- `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift` — Thumbnail component
- `apps/ios/stitchuation/stitchuation/Sync/NetworkClientKey.swift` — Environment key
- `apps/ios/stitchuation/stitchuationTests/CanvasTests.swift` — Model tests

**Modified files:**
- `apps/ios/stitchuation/stitchuation/stitchuationApp.swift` — Register Canvas in ModelContainer, add NetworkClient environment
- `apps/ios/stitchuation/stitchuation/ContentView.swift` — Replace Projects tab with Stitch Stash tab
- `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift` — Add canvas gathering, processing, and applyCanvasData
- `apps/ios/stitchuation/stitchuation/Sync/NetworkClient.swift` — Add multipart upload method
