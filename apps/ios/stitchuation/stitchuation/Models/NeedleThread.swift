import Foundation
import SwiftData

@Model
final class NeedleThread {
    @Attribute(.unique) var id: UUID
    var brand: String
    var number: String
    var colorName: String?
    var colorHex: String?
    var fiberType: FiberType
    var quantity: Int
    var barcode: String?
    var weightOrLength: String?
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        brand: String,
        number: String,
        colorName: String? = nil,
        colorHex: String? = nil,
        fiberType: FiberType = .wool,
        quantity: Int = 0,
        barcode: String? = nil,
        weightOrLength: String? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.brand = brand
        self.number = number
        self.colorName = colorName
        self.colorHex = colorHex
        self.fiberType = fiberType
        self.quantity = quantity
        self.barcode = barcode
        self.weightOrLength = weightOrLength
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
