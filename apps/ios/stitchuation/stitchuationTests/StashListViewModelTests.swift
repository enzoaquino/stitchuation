import Testing
import Foundation
@testable import stitchuation

@Suite("StashListViewModel Tests")
@MainActor
struct StashListViewModelTests {
    @Test func filteredPiecesReturnsStashOnlyByDefault() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread", status: .wip)

        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designName == "Nutcracker")
    }

    @Test func filteredPiecesShowsAllWhenToggled() {
        let vm = StashListViewModel()
        vm.showAllPieces = true

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread", status: .wip)

        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 2)
    }

    @Test func filteredPiecesFiltersByDesigner() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread")

        vm.searchText = "melissa"
        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designer == "Melissa Shirley")
    }

    @Test func filteredPiecesFiltersByDesignName() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")
        let p2 = StitchPiece(designer: "Kirk & Bradley", designName: "Gingerbread")

        vm.searchText = "gingerbread"
        let result = vm.filteredPieces(from: [p1, p2])
        #expect(result.count == 1)
        #expect(result.first?.designName == "Gingerbread")
    }

    @Test func filteredPiecesIsCaseInsensitive() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")

        vm.searchText = "MELISSA"
        let result = vm.filteredPieces(from: [p1])
        #expect(result.count == 1)
    }

    @Test func filteredPiecesReturnsEmptyWhenNoMatch() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Melissa Shirley", designName: "Nutcracker")

        vm.searchText = "nonexistent"
        let result = vm.filteredPieces(from: [p1])
        #expect(result.isEmpty)
    }

    @Test func deletePiecesSoftDeletes() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Test", designName: "Piece 1")
        let p2 = StitchPiece(designer: "Test", designName: "Piece 2")

        vm.deletePieces(from: [p1, p2], at: IndexSet(integer: 0))

        #expect(p1.deletedAt != nil)
        #expect(p1.updatedAt >= p1.createdAt)
        #expect(p2.deletedAt == nil)
    }

    @Test func deletePiecesUsesConsistentTimestamp() {
        let vm = StashListViewModel()

        let p1 = StitchPiece(designer: "Test", designName: "Piece 1")

        vm.deletePieces(from: [p1], at: IndexSet(integer: 0))

        #expect(p1.deletedAt == p1.updatedAt)
    }
}
