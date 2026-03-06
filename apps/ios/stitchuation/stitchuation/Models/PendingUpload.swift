import Foundation
import SwiftData

@Model
final class PendingUpload {
    @Attribute(.unique) var id: UUID
    var entityType: String
    var entityId: UUID
    var uploadPath: String
    @Attribute(.externalStorage) var imageData: Data
    var createdAt: Date
    var retryCount: Int
    var lastAttemptAt: Date?

    /// Parent entry ID for journalImage uploads (needed for retry to create JournalImage)
    var parentEntryId: UUID?
    /// Sort order for journalImage uploads (needed for retry to create JournalImage)
    var sortOrder: Int?

    /// Minimum seconds to wait before next retry: 2^retryCount, capped at 1 hour.
    var backoffSeconds: TimeInterval {
        min(pow(2.0, Double(retryCount)), 3600)
    }

    /// Whether enough time has passed since last attempt to retry.
    var isReadyForRetry: Bool {
        guard let lastAttempt = lastAttemptAt else { return true }
        return Date().timeIntervalSince(lastAttempt) >= backoffSeconds
    }

    init(
        id: UUID = UUID(),
        entityType: String,
        entityId: UUID,
        uploadPath: String,
        imageData: Data,
        parentEntryId: UUID? = nil,
        sortOrder: Int? = nil
    ) {
        self.id = id
        self.entityType = entityType
        self.entityId = entityId
        self.uploadPath = uploadPath
        self.imageData = imageData
        self.parentEntryId = parentEntryId
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.retryCount = 0
    }
}
