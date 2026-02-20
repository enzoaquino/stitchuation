import Foundation

@MainActor
@Observable
final class ProjectListViewModel {
    var searchText = ""
    var showFinished = false

    func filteredPieces(from pieces: [StitchPiece]) -> [StitchPiece] {
        let statusFiltered: [StitchPiece]
        if showFinished {
            statusFiltered = pieces.filter { $0.status == .finished }
        } else {
            statusFiltered = pieces.filter { $0.status.isActive }
        }
        guard !searchText.isEmpty else { return statusFiltered }
        let query = searchText.lowercased()
        return statusFiltered.filter { piece in
            piece.designName.lowercased().contains(query) ||
            piece.designer.lowercased().contains(query)
        }
    }

    func piecesByStatus(from pieces: [StitchPiece]) -> [(PieceStatus, [StitchPiece])] {
        let grouped = Dictionary(grouping: pieces) { $0.status }
        let order: [PieceStatus] = showFinished ? [.finished] : PieceStatus.activeStatuses
        return order.compactMap { status in
            guard let items = grouped[status], !items.isEmpty else { return nil }
            return (status, items)
        }
    }
}
