import Testing
import Foundation
@testable import stitchuation

@Suite("ImageCache Pending Key Tests")
struct ImageCachePendingTests {

    @Test("isPendingKey detects pending: prefix")
    func isPendingKey() {
        #expect(ImageCache.isPendingKey("pending:abc-123") == true)
        #expect(ImageCache.isPendingKey("pending:") == true)
        #expect(ImageCache.isPendingKey("https://example.com/image.jpg") == false)
        #expect(ImageCache.isPendingKey("images/abc.jpg") == false)
        #expect(ImageCache.isPendingKey("") == false)
        #expect(ImageCache.isPendingKey(nil) == false)
    }

    @Test("pendingEntityId extracts UUID from pending key")
    func pendingEntityId() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000"
        #expect(ImageCache.pendingEntityId("pending:\(uuid)")?.uuidString.lowercased() == uuid)
        #expect(ImageCache.pendingEntityId("pending:not-a-uuid") == nil)
        #expect(ImageCache.pendingEntityId("https://example.com") == nil)
        #expect(ImageCache.pendingEntityId(nil) == nil)
    }
}
