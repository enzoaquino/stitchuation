import Testing
@testable import stitchuation

@MainActor
struct ProjectListViewModelTests {
    let viewModel = ProjectListViewModel()

    private func makePiece(designer: String, designName: String, status: PieceStatus = .wip) -> StitchPiece {
        StitchPiece(designer: designer, designName: designName, status: status)
    }

    @Test func filteredPiecesReturnsActiveByDefault() {
        let pieces = [
            makePiece(designer: "Alice", designName: "Flowers", status: .wip),
            makePiece(designer: "Bob", designName: "Trees", status: .finished),
            makePiece(designer: "Carol", designName: "Stars", status: .kitting),
        ]
        let result = viewModel.filteredPieces(from: pieces)
        #expect(result.count == 2)
    }

    @Test func filteredPiecesShowsFinishedWhenToggled() {
        viewModel.showFinished = true
        let pieces = [
            makePiece(designer: "Alice", designName: "Flowers", status: .wip),
            makePiece(designer: "Bob", designName: "Trees", status: .finished),
        ]
        let result = viewModel.filteredPieces(from: pieces)
        #expect(result.count == 1)
        #expect(result.first?.designName == "Trees")
    }

    @Test func filteredPiecesByDesigner() {
        let pieces = [
            makePiece(designer: "Alice", designName: "Flowers"),
            makePiece(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "alice"
        let result = viewModel.filteredPieces(from: pieces)
        #expect(result.count == 1)
        #expect(result[0].designer == "Alice")
    }

    @Test func filteredPiecesByDesignName() {
        let pieces = [
            makePiece(designer: "Alice", designName: "Flowers"),
            makePiece(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "tree"
        let result = viewModel.filteredPieces(from: pieces)
        #expect(result.count == 1)
    }

    @Test func piecesByStatusGroupsCorrectly() {
        let pieces = [
            makePiece(designer: "A", designName: "D1", status: .wip),
            makePiece(designer: "B", designName: "D2", status: .finished),
            makePiece(designer: "C", designName: "D3", status: .wip),
            makePiece(designer: "D", designName: "D4", status: .atFinishing),
            makePiece(designer: "E", designName: "D5", status: .kitting),
        ]
        let grouped = viewModel.piecesByStatus(from: pieces)
        #expect(grouped.count == 3)
        #expect(grouped[0].0 == .kitting)
        #expect(grouped[0].1.count == 1)
        #expect(grouped[1].0 == .wip)
        #expect(grouped[1].1.count == 2)
        #expect(grouped[2].0 == .atFinishing)
        #expect(grouped[2].1.count == 1)
    }

    @Test func piecesByStatusOmitsEmptyGroups() {
        let pieces = [
            makePiece(designer: "A", designName: "D1", status: .wip),
        ]
        let grouped = viewModel.piecesByStatus(from: pieces)
        #expect(grouped.count == 1)
        #expect(grouped[0].0 == .wip)
    }

    @Test func piecesByStatusShowsFinishedGroup() {
        viewModel.showFinished = true
        let pieces = [
            makePiece(designer: "A", designName: "D1", status: .finished),
            makePiece(designer: "B", designName: "D2", status: .wip),
        ]
        let grouped = viewModel.piecesByStatus(from: pieces)
        #expect(grouped.count == 1)
        #expect(grouped[0].0 == .finished)
        #expect(grouped[0].1.count == 1)
    }
}
