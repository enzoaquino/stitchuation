import Testing
import Foundation
@testable import stitchuation

@Suite("UploadQueue Tests")
struct UploadQueueTests {
    @Test("skips uploads not ready for retry")
    func skipsNotReadyUploads() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 10  // backoff = 1024 seconds
        upload.lastAttemptAt = Date()  // just now
        #expect(upload.isReadyForRetry == false)
    }

    @Test("allows uploads ready for retry")
    func allowsReadyUploads() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 1  // backoff = 2 seconds
        upload.lastAttemptAt = Date(timeIntervalSinceNow: -10)  // 10 seconds ago
        #expect(upload.isReadyForRetry == true)
    }
}
