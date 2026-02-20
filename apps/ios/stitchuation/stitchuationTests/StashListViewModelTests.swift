import Testing
import Foundation
import SwiftData
@testable import stitchuation

@MainActor
struct StashListViewModelTests {
    private func makeContainer() throws -> ModelContainer {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        return try ModelContainer(for: StitchPiece.self, configurations: config)
    }

    @Test func filteredPiecesReturnsStashOnlyByDefault() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread", status: .wip)
        context.insert(p1)
        context.insert(p2)

        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designName == "Nutcracker")
    }

    @Test func filteredPiecesShowsAllWhenToggled() throws {
        let vm = StashListViewModel()
        vm.showAllPieces = true
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread", status: .wip)
        context.insert(p1)
        context.insert(p2)

        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 2)
    }

    @Test func filteredPiecesFiltersByDesigner() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread")
        context.insert(p1)
        context.insert(p2)

        vm.searchText = "melissa"
        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designer == "Melissa Shirley")
    }

    @Test func filteredPiecesFiltersByDesignName() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread")
        context.insert(p1)
        context.insert(p2)

        vm.searchText = "gingerbread"
        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designName == "Gingerbread")
    }

    @Test func filteredPiecesIsCaseInsensitive() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        context.insert(p1)

        vm.searchText = "MELISSA"
        let result = vm.filteredPieces(from: [p1])
        #expect(result.count == 1)
    }

    @Test func filteredPiecesReturnsEmptyWhenNoMatch() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        context.insert(p1)

        vm.searchText = "nonexistent"
        let result = vm.filteredPieces(from: [p1])
        #expect(result.isEmpty)
    }

    @Test func deletePiecesSoftDeletes() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Test", designName: "Piece 1")
        let p2 = StitchPiece(designer: "Test", designName: "Piece 2")
        context.insert(p1)
        context.insert(p2)

        vm.deletePieces(from: [p1, p2], at: IndexSet(integer: 0))

        #expect(p1.deletedAt != nil)
        #expect(p1.updatedAt >= p1.createdAt)
        #expect(p2.deletedAt == nil)
    }

    @Test func deletePiecesUsesConsistentTimestamp() throws {
        let vm = StashListViewModel()
        let container = try makeContainer()
        let context = container.mainContext

        let p1 = StitchPiece(designer: "Test", designName: "Piece 1")
        context.insert(p1)

        vm.deletePieces(from: [p1], at: IndexSet(integer: 0))

        #expect(p1.deletedAt == p1.updatedAt)
    }
}
