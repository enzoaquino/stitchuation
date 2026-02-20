import Foundation

@MainActor
@Observable
final class StashListViewModel {
    var searchText = ""
    var showAllPieces = false

    func filteredPieces(from pieces: [StitchPiece]) -> [StitchPiece] {
        let filtered = showAllPieces ? pieces : pieces.filter { $0.status == .stash }
        guard !searchText.isEmpty else { return filtered }
        let search = searchText.lowercased()
        return filtered.filter { piece in
            piece.designer.lowercased().contains(search)
                || piece.designName.lowercased().contains(search)
        }
    }

    func deletePieces(from pieces: [StitchPiece], at offsets: IndexSet) {
        let now = Date()
        for index in offsets {
            let piece = pieces[index]
            piece.deletedAt = now
            piece.updatedAt = now
        }
    }
}
