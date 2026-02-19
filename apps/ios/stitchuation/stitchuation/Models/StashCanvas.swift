import Foundation
import SwiftData

@Model
final class StashCanvas {
    @Attribute(.unique) var id: UUID
    var designer: String
    var designName: String
    var acquiredAt: Date?
    var imageKey: String?
    var size: String?
    var meshCount: Int?
    var notes: String?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \StitchProject.canvas)
    var project: StitchProject?

    init(
        id: UUID = UUID(),
        designer: String,
        designName: String,
        acquiredAt: Date? = nil,
        imageKey: String? = nil,
        size: String? = nil,
        meshCount: Int? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.designer = designer
        self.designName = designName
        self.acquiredAt = acquiredAt
        self.imageKey = imageKey
        self.size = size
        self.meshCount = meshCount
        self.notes = notes
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
