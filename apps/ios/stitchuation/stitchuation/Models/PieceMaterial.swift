import Foundation
import SwiftData

@Model
final class PieceMaterial {
    @Attribute(.unique) var id: UUID
    var piece: StitchPiece
    var materialType: MaterialType
    var brand: String?
    var name: String
    var code: String?
    var quantity: Int
    var unit: String?
    var notes: String?
    var acquired: Bool
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        piece: StitchPiece,
        materialType: MaterialType = .other,
        brand: String? = nil,
        name: String,
        code: String? = nil,
        quantity: Int = 1,
        unit: String? = nil,
        notes: String? = nil,
        acquired: Bool = false,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.piece = piece
        self.materialType = materialType
        self.brand = brand
        self.name = name
        self.code = code
        self.quantity = quantity
        self.unit = unit
        self.notes = notes
        self.acquired = acquired
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    /// Formatted display string: "Brand · Name (Code)" or subset
    var displayLine: String {
        var parts: [String] = []
        if let brand { parts.append(brand) }
        parts.append(name)
        var line = parts.joined(separator: " \u{00B7} ")
        if let code { line += " (\(code))" }
        return line
    }
}
