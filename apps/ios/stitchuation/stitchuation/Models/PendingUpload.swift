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

    static let maxRetries = 5

    var hasFailed: Bool {
        retryCount >= Self.maxRetries
    }

    init(
        id: UUID = UUID(),
        entityType: String,
        entityId: UUID,
        uploadPath: String,
        imageData: Data
    ) {
        self.id = id
        self.entityType = entityType
        self.entityId = entityId
        self.uploadPath = uploadPath
        self.imageData = imageData
        self.createdAt = Date()
        self.retryCount = 0
    }
}
