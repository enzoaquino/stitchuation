import Foundation

@MainActor
@Observable
final class StashListViewModel {
    var searchText = ""

    func filteredCanvases(from canvases: [StashCanvas]) -> [StashCanvas] {
        guard !searchText.isEmpty else { return canvases }
        let search = searchText.lowercased()
        return canvases.filter { canvas in
            canvas.designer.lowercased().contains(search)
                || canvas.designName.lowercased().contains(search)
        }
    }

    func deleteCanvases(from canvases: [StashCanvas], at offsets: IndexSet) {
        let now = Date()
        for index in offsets {
            let canvas = canvases[index]
            canvas.deletedAt = now
            canvas.updatedAt = now
        }
    }
}
