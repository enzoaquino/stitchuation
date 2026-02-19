import Foundation
import SwiftData

@Model
final class JournalImage {
    @Attribute(.unique) var id: UUID
    var entry: JournalEntry
    var imageKey: String
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    init(
        id: UUID = UUID(),
        entry: JournalEntry,
        imageKey: String,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.entry = entry
        self.imageKey = imageKey
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
