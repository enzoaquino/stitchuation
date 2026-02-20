import Testing
import Foundation
@testable import stitchuation

@Suite("UploadQueue Tests")
struct UploadQueueTests {
    @Test("skips permanently failed uploads")
    func skipsFailedUploads() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = PendingUpload.maxRetries
        #expect(upload.hasFailed)
    }

    @Test("max retries is 5")
    func maxRetriesValue() {
        #expect(PendingUpload.maxRetries == 5)
    }
}
