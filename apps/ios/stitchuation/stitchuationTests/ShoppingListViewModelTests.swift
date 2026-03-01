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
        let dmc310 = groups.first { $0.groupKey.contains("310") }
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
