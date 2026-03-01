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
        var result: [ShoppingItem] = []
        for piece in pieces {
            guard piece.status.isActive && piece.deletedAt == nil else { continue }
            for material in piece.materials {
                guard material.deletedAt == nil && !material.acquired else { continue }
                result.append(ShoppingItem(material: material, piece: piece))
            }
        }
        return result
    }

    /// Group items by their parent project.
    func groupedByProject(from items: [ShoppingItem]) -> [ProjectGroup] {
        let grouped = Dictionary(grouping: items) { $0.piece.id }
        var groups: [ProjectGroup] = []
        for (_, groupItems) in grouped {
            guard let piece = groupItems.first?.piece else { continue }
            let sorted = groupItems.sorted { $0.material.sortOrder < $1.material.sortOrder }
            groups.append(ProjectGroup(piece: piece, items: sorted))
        }
        return groups.sorted { $0.piece.designName.localizedCompare($1.piece.designName) == .orderedAscending }
    }

    /// Group items by brand+code (or brand+name), separated by material type.
    func groupedByMaterial(from items: [ShoppingItem]) -> [MaterialGroup] {
        let grouped = Dictionary(grouping: items) { item -> String in
            materialGroupKey(for: item.material)
        }
        var groups: [MaterialGroup] = []
        for (key, groupItems) in grouped {
            let first = groupItems[0].material
            let display = first.code ?? first.name
            let sorted = groupItems.sorted { $0.piece.designName.localizedCompare($1.piece.designName) == .orderedAscending }
            groups.append(MaterialGroup(
                groupKey: key,
                displayName: display,
                brand: first.brand,
                materialType: first.materialType,
                items: sorted
            ))
        }
        return groups.sorted { $0.displayName.localizedCompare($1.displayName) == .orderedAscending }
    }

    private func materialGroupKey(for material: PieceMaterial) -> String {
        let brand = material.brand ?? ""
        let identifier = material.code ?? material.name
        let type = material.materialType.rawValue
        return "\(brand)\u{001F}\(identifier)\u{001F}\(type)"
    }
}
