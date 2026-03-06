import Testing
import Foundation
@testable import stitchuation

@Suite("PendingUpload Tests")
struct PendingUploadTests {
    @Test("initializes with correct defaults")
    func defaults() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.entityType == "piece")
        #expect(upload.retryCount == 0)
        #expect(upload.lastAttemptAt == nil)
        #expect(!upload.imageData.isEmpty)
    }

    @Test("supports journal image entity type with parent entry")
    func journalImageType() {
        let entryId = UUID()
        let imageId = UUID()
        let upload = PendingUpload(
            entityType: "journalImage",
            entityId: imageId,
            uploadPath: "/pieces/p1/entries/\(entryId.uuidString)/images",
            imageData: Data([0xFF, 0xD8]),
            parentEntryId: entryId,
            sortOrder: 2
        )
        #expect(upload.entityType == "journalImage")
        #expect(upload.entityId == imageId)
        #expect(upload.parentEntryId == entryId)
        #expect(upload.sortOrder == 2)
    }

    @Test("piece upload has nil parent entry fields")
    func pieceNoParentEntry() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.parentEntryId == nil)
        #expect(upload.sortOrder == nil)
    }

    @Test("retryCount increments")
    func retryIncrement() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount += 1
        upload.lastAttemptAt = Date()
        #expect(upload.retryCount == 1)
        #expect(upload.lastAttemptAt != nil)
    }

    @Test("backoff seconds doubles with retry count")
    func backoffSeconds() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.backoffSeconds == 1.0) // 2^0

        upload.retryCount = 3
        #expect(upload.backoffSeconds == 8.0) // 2^3

        upload.retryCount = 10
        #expect(upload.backoffSeconds == 1024.0) // 2^10
    }

    @Test("backoff caps at 1 hour")
    func backoffCap() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 20
        #expect(upload.backoffSeconds == 3600.0)
    }

    @Test("isReadyForRetry returns true with no lastAttemptAt")
    func readyNoLastAttempt() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.isReadyForRetry == true)
    }

    @Test("isReadyForRetry returns false when recently attempted")
    func notReadyRecentAttempt() {
        let upload = PendingUpload(
            entityType: "piece",
            entityId: UUID(),
            uploadPath: "/pieces/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 5  // backoff = 32 seconds
        upload.lastAttemptAt = Date()  // just now
        #expect(upload.isReadyForRetry == false)
    }

    @Test("isReadyForRetry returns true when backoff has elapsed")
    func readyAfterBackoff() {
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
