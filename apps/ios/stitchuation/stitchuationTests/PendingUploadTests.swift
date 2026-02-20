import Testing
import Foundation
@testable import stitchuation

@Suite("PendingUpload Tests")
struct PendingUploadTests {
    @Test("initializes with correct defaults")
    func defaults() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.entityType == "canvas")
        #expect(upload.retryCount == 0)
        #expect(upload.lastAttemptAt == nil)
        #expect(!upload.imageData.isEmpty)
    }

    @Test("supports journal image entity type")
    func journalImageType() {
        let entryId = UUID()
        let imageId = UUID()
        let upload = PendingUpload(
            entityType: "journalImage",
            entityId: imageId,
            uploadPath: "/projects/p1/entries/\(entryId.uuidString)/images",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.entityType == "journalImage")
        #expect(upload.entityId == imageId)
    }

    @Test("retryCount increments")
    func retryIncrement() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount += 1
        upload.lastAttemptAt = Date()
        #expect(upload.retryCount == 1)
        #expect(upload.lastAttemptAt != nil)
    }

    @Test("max retries threshold is 5")
    func maxRetries() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 5
        #expect(upload.hasFailed)
    }
}
