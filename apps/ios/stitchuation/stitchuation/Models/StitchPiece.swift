import Foundation
import SwiftData

@Model
final class StitchPiece {
    @Attribute(.unique) var id: UUID
    var designer: String
    var designName: String
    /// Stored as raw string to avoid SwiftData enum schema validation issues.
    var statusRaw: String
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

    @Relationship(deleteRule: .cascade, inverse: \PieceMaterial.piece)
    var materials: [PieceMaterial] = []

    var status: PieceStatus {
        get { PieceStatus(rawValue: statusRaw) ?? .stash }
        set { statusRaw = newValue.rawValue }
    }

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
        self.statusRaw = status.rawValue
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
