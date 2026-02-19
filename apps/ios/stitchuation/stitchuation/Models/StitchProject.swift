import Foundation
import SwiftData

@Model
final class StitchProject {
    @Attribute(.unique) var id: UUID
    var canvas: StashCanvas
    var status: ProjectStatus
    var startedAt: Date?
    var finishingAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var syncedAt: Date?

    @Relationship(deleteRule: .cascade, inverse: \JournalEntry.project)
    var entries: [JournalEntry] = []

    init(
        id: UUID = UUID(),
        canvas: StashCanvas,
        status: ProjectStatus = .wip,
        startedAt: Date? = Date(),
        finishingAt: Date? = nil,
        completedAt: Date? = nil
    ) {
        self.id = id
        self.canvas = canvas
        self.status = status
        self.startedAt = startedAt
        self.finishingAt = finishingAt
        self.completedAt = completedAt
        self.createdAt = Date()
        self.updatedAt = Date()
    }
}
