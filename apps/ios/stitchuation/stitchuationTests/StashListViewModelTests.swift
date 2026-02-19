import Testing
import Foundation
import SwiftData
@testable import stitchuation

@MainActor
struct StashListViewModelTests {
    private func makeContainer() throws -> ModelContainer {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        return try ModelContainer(for: StashCanvas.self, configurations: config)
    }

    @Test func filteredCanvasesReturnsAllWhenSearchEmpty() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        let c2 = StashCanvas(designer: "Kirk & Bradley", designName: "Gingerbread")
        context.insert(c1)
        context.insert(c2)

        let result = vm.filteredCanvases(from: [c1, c2])
        #expect(result.count == 2)
    }

    @Test func filteredCanvasesFiltersByDesigner() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        let c2 = StashCanvas(designer: "Kirk & Bradley", designName: "Gingerbread")
        context.insert(c1)
        context.insert(c2)

        vm.searchText = "melissa"
        let result = vm.filteredCanvases(from: [c1, c2])
        #expect(result.count == 1)
        #expect(result.first?.designer == "Melissa Shirley")
    }

    @Test func filteredCanvasesFiltersByDesignName() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        let c2 = StashCanvas(designer: "Kirk & Bradley", designName: "Gingerbread")
        context.insert(c1)
        context.insert(c2)

        vm.searchText = "gingerbread"
        let result = vm.filteredCanvases(from: [c1, c2])
        #expect(result.count == 1)
        #expect(result.first?.designName == "Gingerbread")
    }

    @Test func filteredCanvasesIsCaseInsensitive() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        context.insert(c1)

        vm.searchText = "MELISSA"
        let result = vm.filteredCanvases(from: [c1])
        #expect(result.count == 1)
    }

    @Test func filteredCanvasesReturnsEmptyWhenNoMatch() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        context.insert(c1)

        vm.searchText = "nonexistent"
        let result = vm.filteredCanvases(from: [c1])
        #expect(result.isEmpty)
    }

    @Test func deleteCanvasesSoftDeletes() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Test", designName: "Canvas 1")
        let c2 = StashCanvas(designer: "Test", designName: "Canvas 2")
        context.insert(c1)
        context.insert(c2)

        vm.deleteCanvases(from: [c1, c2], at: IndexSet(integer: 0))

        #expect(c1.deletedAt != nil)
        #expect(c1.updatedAt >= c1.createdAt)
        #expect(c2.deletedAt == nil)
    }

    @Test func deleteCanvasesUsesConsistentTimestamp() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let c1 = StashCanvas(designer: "Test", designName: "Canvas 1")
        context.insert(c1)

        vm.deleteCanvases(from: [c1], at: IndexSet(integer: 0))

        #expect(c1.deletedAt == c1.updatedAt)
    }
}
