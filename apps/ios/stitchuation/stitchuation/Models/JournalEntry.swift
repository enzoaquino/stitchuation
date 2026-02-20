import Foundation
import SwiftData

@Model
final class JournalEntry {
    @Attribute(.unique) var id: UUID
    var piece: StitchPiece
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalImage.entry)
    var images: [JournalImage] = []

    init(
        id: UUID = UUID(),
        piece: StitchPiece,
        notes: String? = nil
    ) {
        self.id = id
        self.piece = piece
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
