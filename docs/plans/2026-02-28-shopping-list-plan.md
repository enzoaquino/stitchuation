# Shopping List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 5th "Shopping" tab that aggregates un-acquired materials from all active projects, with "By Project" and "By Material" grouping modes.

**Architecture:** A `ShoppingListViewModel` queries `PieceMaterial` records (via passed-in `[StitchPiece]` from `@Query`) to build grouped views. The view has a segmented control toggling between project-grouped and material-grouped display. Checking off an item sets `PieceMaterial.acquired = true` and animates the row out.

**Tech Stack:** SwiftUI, SwiftData, Swift Testing

---

### Task 1: ShoppingListViewModel

The view model takes an array of `StitchPiece` and produces two grouping modes. No SwiftData queries inside the VM — data is passed in from the view's `@Query`.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/ViewModels/ShoppingListViewModel.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/ShoppingListViewModelTests.swift`

**Step 1: Write the failing tests**

Create `apps/ios/stitchuation/stitchuationTests/ShoppingListViewModelTests.swift`:

```swift
import Testing
@testable import stitchuation

@Suite("ShoppingListViewModel Tests")
@MainActor
struct ShoppingListViewModelTests {

    // MARK: - Helpers

    private func makePiece(
        designer: String,
        designName: String,
        status: PieceStatus = .kitting
    ) -> StitchPiece {
        StitchPiece(designer: designer, designName: designName, status: status)
    }

    private func addMaterial(
        to piece: StitchPiece,
        brand: String? = nil,
        name: String = "Thread",
        code: String? = nil,
        quantity: Int = 1,
        materialType: MaterialType = .thread,
        acquired: Bool = false
    ) -> PieceMaterial {
        let m = PieceMaterial(
            piece: piece,
            materialType: materialType,
            brand: brand,
            name: name,
            code: code,
            quantity: quantity,
            acquired: acquired
        )
        piece.materials.append(m)
        return m
    }

    // MARK: - shoppingItems(from:)

    @Test func shoppingItemsExcludesStashAndFinished() {
        let vm = ShoppingListViewModel()
        let stash = makePiece(designer: "A", designName: "D1", status: .stash)
        let kitting = makePiece(designer: "B", designName: "D2", status: .kitting)
        let finished = makePiece(designer: "C", designName: "D3", status: .finished)
        addMaterial(to: stash, name: "Thread 1")
        addMaterial(to: kitting, name: "Thread 2")
        addMaterial(to: finished, name: "Thread 3")
        let items = vm.shoppingItems(from: [stash, kitting, finished])
        #expect(items.count == 1)
        #expect(items[0].material.name == "Thread 2")
    }

    @Test func shoppingItemsExcludesAcquired() {
        let vm = ShoppingListViewModel()
        let piece = makePiece(designer: "A", designName: "D1")
        addMaterial(to: piece, name: "Needed", acquired: false)
        addMaterial(to: piece, name: "Got It", acquired: true)
        let items = vm.shoppingItems(from: [piece])
        #expect(items.count == 1)
        #expect(items[0].material.name == "Needed")
    }

    @Test func shoppingItemsExcludesDeleted() {
        let vm = ShoppingListViewModel()
        let piece = makePiece(designer: "A", designName: "D1")
        let m = addMaterial(to: piece, name: "Deleted")
        m.deletedAt = Date()
        addMaterial(to: piece, name: "Active")
        let items = vm.shoppingItems(from: [piece])
        #expect(items.count == 1)
        #expect(items[0].material.name == "Active")
    }

    @Test func shoppingItemsIncludesAllActiveStatuses() {
        let vm = ShoppingListViewModel()
        let kitting = makePiece(designer: "A", designName: "D1", status: .kitting)
        let wip = makePiece(designer: "B", designName: "D2", status: .wip)
        let stitched = makePiece(designer: "C", designName: "D3", status: .stitched)
        let atFinishing = makePiece(designer: "D", designName: "D4", status: .atFinishing)
        addMaterial(to: kitting, name: "T1")
        addMaterial(to: wip, name: "T2")
        addMaterial(to: stitched, name: "T3")
        addMaterial(to: atFinishing, name: "T4")
        let items = vm.shoppingItems(from: [kitting, wip, stitched, atFinishing])
        #expect(items.count == 4)
    }

    // MARK: - groupedByProject(from:)

    @Test func groupedByProjectGroupsCorrectly() {
        let vm = ShoppingListViewModel()
        let p1 = makePiece(designer: "Alice", designName: "Flowers")
        let p2 = makePiece(designer: "Bob", designName: "Trees")
        addMaterial(to: p1, name: "T1")
        addMaterial(to: p1, name: "T2")
        addMaterial(to: p2, name: "T3")
        let items = vm.shoppingItems(from: [p1, p2])
        let groups = vm.groupedByProject(from: items)
        #expect(groups.count == 2)
        let flowerGroup = groups.first { $0.piece.designName == "Flowers" }
        #expect(flowerGroup?.items.count == 2)
    }

    @Test func groupedByProjectOmitsProjectsWithNoItems() {
        let vm = ShoppingListViewModel()
        let p1 = makePiece(designer: "A", designName: "D1")
        let p2 = makePiece(designer: "B", designName: "D2")
        addMaterial(to: p1, name: "T1")
        // p2 has no un-acquired materials
        addMaterial(to: p2, name: "T2", acquired: true)
        let items = vm.shoppingItems(from: [p1, p2])
        let groups = vm.groupedByProject(from: items)
        #expect(groups.count == 1)
        #expect(groups[0].piece.designName == "D1")
    }

    // MARK: - groupedByMaterial(from:)

    @Test func groupedByMaterialCombinesSameBrandAndCode() {
        let vm = ShoppingListViewModel()
        let p1 = makePiece(designer: "A", designName: "D1")
        let p2 = makePiece(designer: "B", designName: "D2")
        addMaterial(to: p1, brand: "DMC", name: "Stranded Cotton", code: "310", quantity: 2)
        addMaterial(to: p2, brand: "DMC", name: "Stranded Cotton", code: "310", quantity: 1)
        addMaterial(to: p1, brand: "DMC", name: "Stranded Cotton", code: "666", quantity: 1)
        let items = vm.shoppingItems(from: [p1, p2])
        let groups = vm.groupedByMaterial(from: items)
        #expect(groups.count == 2)
        let dmc310 = groups.first { $0.groupKey == "DMC\u{001F}310" }
        #expect(dmc310 != nil)
        #expect(dmc310?.totalQuantity == 3)
        #expect(dmc310?.items.count == 2)
    }

    @Test func groupedByMaterialFallsBackToNameWhenNoCode() {
        let vm = ShoppingListViewModel()
        let p1 = makePiece(designer: "A", designName: "D1")
        let p2 = makePiece(designer: "B", designName: "D2")
        addMaterial(to: p1, brand: "Kreinik", name: "Braid #4", quantity: 1)
        addMaterial(to: p2, brand: "Kreinik", name: "Braid #4", quantity: 2)
        let items = vm.shoppingItems(from: [p1, p2])
        let groups = vm.groupedByMaterial(from: items)
        #expect(groups.count == 1)
        #expect(groups[0].totalQuantity == 3)
    }

    @Test func groupedByMaterialDoesNotCombineDifferentTypes() {
        let vm = ShoppingListViewModel()
        let p1 = makePiece(designer: "A", designName: "D1")
        addMaterial(to: p1, brand: "DMC", name: "Gold", code: "5282", materialType: .thread)
        addMaterial(to: p1, brand: "DMC", name: "Gold", code: "5282", materialType: .bead)
        let items = vm.shoppingItems(from: [p1])
        let groups = vm.groupedByMaterial(from: items)
        #expect(groups.count == 2)
    }
}
```

**Step 2: Build to verify tests fail**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/ShoppingListViewModelTests 2>&1 | tail -20`

Expected: BUILD FAILED — `ShoppingListViewModel` not found.

**Step 3: Write the implementation**

Create `apps/ios/stitchuation/stitchuation/ViewModels/ShoppingListViewModel.swift`:

```swift
import Foundation

/// A single un-acquired material with its parent piece context.
struct ShoppingItem: Identifiable {
    let id: UUID
    let material: PieceMaterial
    let piece: StitchPiece

    init(material: PieceMaterial, piece: StitchPiece) {
        self.id = material.id
        self.material = material
        self.piece = piece
    }
}

/// Materials grouped by project.
struct ProjectGroup: Identifiable {
    let id: UUID
    let piece: StitchPiece
    let items: [ShoppingItem]

    init(piece: StitchPiece, items: [ShoppingItem]) {
        self.id = piece.id
        self.piece = piece
        self.items = items
    }
}

/// Materials grouped by brand+code (or brand+name).
struct MaterialGroup: Identifiable {
    let id: String
    let groupKey: String
    let displayName: String
    let brand: String?
    let materialType: MaterialType
    let totalQuantity: Int
    let items: [ShoppingItem]

    init(groupKey: String, displayName: String, brand: String?, materialType: MaterialType, items: [ShoppingItem]) {
        self.id = groupKey
        self.groupKey = groupKey
        self.displayName = displayName
        self.brand = brand
        self.materialType = materialType
        self.items = items
        self.totalQuantity = items.reduce(0) { $0 + $1.material.quantity }
    }
}

enum ShoppingGroupMode: String, CaseIterable {
    case byProject = "By Project"
    case byMaterial = "By Material"
}

@MainActor
@Observable
final class ShoppingListViewModel {
    var groupMode: ShoppingGroupMode = .byProject
    var searchText = ""

    /// Flatten all un-acquired, non-deleted materials from active projects.
    func shoppingItems(from pieces: [StitchPiece]) -> [ShoppingItem] {
        pieces
            .filter { $0.status.isActive && $0.deletedAt == nil }
            .flatMap { piece in
                piece.materials
                    .filter { $0.deletedAt == nil && !$0.acquired }
                    .map { ShoppingItem(material: $0, piece: piece) }
            }
    }

    /// Group items by their parent project.
    func groupedByProject(from items: [ShoppingItem]) -> [ProjectGroup] {
        let grouped = Dictionary(grouping: items) { $0.piece.id }
        return grouped.compactMap { (_, groupItems) in
            guard let piece = groupItems.first?.piece else { return nil }
            return ProjectGroup(piece: piece, items: groupItems.sorted { $0.material.sortOrder < $1.material.sortOrder })
        }
        .sorted { $0.piece.designName.localizedCompare($1.piece.designName) == .orderedAscending }
    }

    /// Group items by brand+code (or brand+name), separated by material type.
    func groupedByMaterial(from items: [ShoppingItem]) -> [MaterialGroup] {
        let grouped = Dictionary(grouping: items) { item -> String in
            materialGroupKey(for: item.material)
        }
        return grouped.map { (key, groupItems) in
            let first = groupItems[0].material
            let display = first.code ?? first.name
            return MaterialGroup(
                groupKey: key,
                displayName: display,
                brand: first.brand,
                materialType: first.materialType,
                items: groupItems.sorted { $0.piece.designName.localizedCompare($1.piece.designName) == .orderedAscending }
            )
        }
        .sorted { $0.displayName.localizedCompare($1.displayName) == .orderedAscending }
    }

    private func materialGroupKey(for material: PieceMaterial) -> String {
        let brand = material.brand ?? ""
        let identifier = material.code ?? material.name
        let type = material.materialType.rawValue
        return "\(brand)\u{001F}\(identifier)\u{001F}\(type)"
    }
}
```

**Step 4: Build and run tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/ShoppingListViewModelTests 2>&1 | tail -30`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ViewModels/ShoppingListViewModel.swift apps/ios/stitchuation/stitchuationTests/ShoppingListViewModelTests.swift
git commit -m "feat(ios): add ShoppingListViewModel with project and material grouping"
```

---

### Task 2: ShoppingListView — By Project Mode

The main view with segmented control, project-grouped list with checkboxes, and empty state. Only the "By Project" mode in this task.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/ShoppingListView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Navigation/NavigationCoordinator.swift`

**Step 1: Add `.shopping` to `AppTab`**

In `apps/ios/stitchuation/stitchuation/ContentView.swift`, add the new tab case to the `AppTab` enum:

```swift
enum AppTab: Hashable {
    case journal
    case stash
    case shopping    // <-- ADD THIS
    case threads
    case settings
}
```

**Step 2: Create ShoppingListView**

Create `apps/ios/stitchuation/stitchuation/Views/ShoppingListView.swift`:

```swift
import SwiftUI
import SwiftData

struct ShoppingListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: ShoppingListView.notDeletedPredicate,
        sort: \StitchPiece.createdAt,
        order: .reverse
    )
    private var pieces: [StitchPiece]

    private static let notDeletedPredicate = #Predicate<StitchPiece> {
        $0.deletedAt == nil
    }

    @State private var viewModel = ShoppingListViewModel()

    private var items: [ShoppingItem] {
        viewModel.shoppingItems(from: pieces)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: 0) {
                Picker("Group By", selection: $viewModel.groupMode) {
                    ForEach(ShoppingGroupMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm)

                if items.isEmpty {
                    EmptyStateView(
                        icon: "cart",
                        title: "All shopped!",
                        message: "Nothing to buy right now"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    switch viewModel.groupMode {
                    case .byProject:
                        projectGroupedList
                    case .byMaterial:
                        materialGroupedList
                    }
                }
            }
        }
        .navigationTitle("Shopping List")
    }

    // MARK: - By Project

    private var projectGroupedList: some View {
        let groups = viewModel.groupedByProject(from: items)
        return List {
            ForEach(groups) { group in
                Section {
                    ForEach(group.items) { item in
                        ShoppingItemRow(item: item)
                            .listRowBackground(Color.cream)
                    }
                } header: {
                    HStack {
                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                            Text(group.piece.designName)
                                .font(.playfair(15, weight: .semibold))
                                .foregroundStyle(Color.walnut)
                            Text(group.piece.designer)
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.clay)
                        }
                        Spacer()
                        Text("\(group.items.count)")
                            .font(.typeStyle(.data))
                            .foregroundStyle(Color.clay)
                    }
                    .textCase(nil)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .animation(Motion.gentle, value: items.count)
    }

    // MARK: - By Material (placeholder — implemented in Task 3)

    private var materialGroupedList: some View {
        EmptyView()
    }
}

// MARK: - Shopping Item Row

struct ShoppingItemRow: View {
    let item: ShoppingItem

    var body: some View {
        HStack(spacing: Spacing.md) {
            Button {
                withAnimation(Motion.gentle) {
                    item.material.acquired = true
                    item.material.updatedAt = Date()
                }
            } label: {
                Image(systemName: "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.slate)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(item.material.displayLine)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)

                HStack(spacing: Spacing.xs) {
                    if item.material.quantity > 0 {
                        Text("\(item.material.quantity)")
                            .font(.typeStyle(.data))
                            .foregroundStyle(Color.walnut)
                    }
                    if let unit = item.material.unit {
                        Text(unit)
                            .font(.typeStyle(.subheadline))
                            .foregroundStyle(Color.clay)
                    }
                    Text(item.material.materialType.displayName)
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.clay)
                }
            }

            Spacer()
        }
        .padding(.vertical, Spacing.sm)
        .contentShape(Rectangle())
    }
}
```

**Step 3: Add the Shopping tab to ContentView**

In `apps/ios/stitchuation/stitchuation/ContentView.swift`, add the tab between Stash and Threads. Insert this block after the Stash `NavigationStack` block (after line 35):

```swift
            NavigationStack {
                ShoppingListView()
            }
            .tag(AppTab.shopping)
            .tabItem {
                Label("Shopping", systemImage: "cart")
            }
```

**Step 4: Build and verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -10`

Expected: BUILD SUCCEEDED.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ShoppingListView.swift apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): add Shopping List tab with By Project view"
```

---

### Task 3: ShoppingListView — By Material Mode

Implement the expandable material-grouped view with disclosure groups.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ShoppingListView.swift`

**Step 1: Replace the `materialGroupedList` placeholder**

In `ShoppingListView.swift`, replace the `materialGroupedList` computed property:

```swift
    private var materialGroupedList: some View {
        let groups = viewModel.groupedByMaterial(from: items)
        return List {
            ForEach(groups) { group in
                DisclosureGroup {
                    ForEach(group.items) { item in
                        HStack(spacing: Spacing.md) {
                            Button {
                                withAnimation(Motion.gentle) {
                                    item.material.acquired = true
                                    item.material.updatedAt = Date()
                                }
                            } label: {
                                Image(systemName: "circle")
                                    .font(.system(size: 18))
                                    .foregroundStyle(Color.slate)
                            }
                            .buttonStyle(.plain)

                            Text(item.piece.designName)
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.walnut)

                            Spacer()

                            if item.material.quantity > 0 {
                                Text("qty \(item.material.quantity)")
                                    .font(.typeStyle(.data))
                                    .foregroundStyle(Color.clay)
                            }
                        }
                        .padding(.vertical, Spacing.xs)
                        .listRowBackground(Color.cream)
                    }
                } label: {
                    HStack(spacing: Spacing.md) {
                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                            HStack(spacing: Spacing.xs) {
                                if let brand = group.brand {
                                    Text(brand)
                                        .font(.typeStyle(.subheadline))
                                        .foregroundStyle(Color.clay)
                                }
                                Text(group.displayName)
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(Color.espresso)
                            }
                            Text("\(group.items.count) project\(group.items.count == 1 ? "" : "s") \u{00B7} \(group.materialType.displayName)")
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.clay)
                        }

                        Spacer()

                        Text("qty \(group.totalQuantity)")
                            .font(.typeStyle(.data))
                            .foregroundStyle(Color.walnut)
                    }
                }
                .listRowBackground(Color.cream)
            }
        }
        .scrollContentBackground(.hidden)
        .animation(Motion.gentle, value: items.count)
    }
```

**Step 2: Build and verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -10`

Expected: BUILD SUCCEEDED.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ShoppingListView.swift
git commit -m "feat(ios): add By Material grouped view with disclosure groups"
```

---

### Task 4: Run full test suite

Verify nothing is broken by the new tab addition.

**Step 1: Run all tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | grep -E '(Test Suite|Executed|FAIL|PASS)'`

Expected: All existing tests pass + new ShoppingListViewModel tests pass.

**Step 2: If any tests fail, fix them before committing**

Common issue: if any test references `AppTab` enum values by position, the new `.shopping` case may shift indices. Fix accordingly.

---
