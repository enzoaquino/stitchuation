import Foundation
import SwiftData

@Model
final class StitchPiece {
    @Attribute(.unique) var id: UUID
    var designer: String
    var designName: String
    var status: PieceStatus
    var imageKey: String?
    var size: String?
    var meshCount: Int?
    var notes: String?
    var acquiredAt: Date?
    var startedAt: Date?
    var stitchedAt: Date?
    var finishingAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalEntry.piece)
    var entries: [JournalEntry] = []

    init(
        id: UUID = UUID(),
        designer: String,
        designName: String,
        status: PieceStatus = .stash,
        imageKey: String? = nil,
        size: String? = nil,
        meshCount: Int? = nil,
        notes: String? = nil,
        acquiredAt: Date? = nil,
        startedAt: Date? = nil
    ) {
        self.id = id
        self.designer = designer
        self.designName = designName
        self.status = status
        self.imageKey = imageKey
        self.size = size
        self.meshCount = meshCount
        self.notes = notes
        self.acquiredAt = acquiredAt
        self.startedAt = startedAt
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
