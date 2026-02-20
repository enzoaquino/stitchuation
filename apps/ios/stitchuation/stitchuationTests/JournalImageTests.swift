import Testing
import Foundation
@testable import stitchuation

struct JournalImageTests {
    @Test func initWithRequiredFields() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let image = JournalImage(entry: entry, imageKey: "journals/abc/123/img.jpg")

        #expect(image.entry === entry)
        #expect(image.imageKey == "journals/abc/123/img.jpg")
        #expect(image.sortOrder == 0)
    }

    @Test func initWithCustomSortOrder() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let image = JournalImage(entry: entry, imageKey: "journals/abc/123/img.jpg", sortOrder: 3)

        #expect(image.sortOrder == 3)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let image = JournalImage(entry: entry, imageKey: "test.jpg")
        let after = Date()

        #expect(image.createdAt >= before)
        #expect(image.createdAt <= after)
        #expect(image.updatedAt >= before)
        #expect(image.updatedAt <= after)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let image = JournalImage(entry: entry, imageKey: "test.jpg")

        #expect(image.deletedAt == nil)
        #expect(image.syncedAt == nil)
    }

    @Test func initWithCustomUUID() {
        let customId = UUID()
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let image = JournalImage(id: customId, entry: entry, imageKey: "test.jpg")

        #expect(image.id == customId)
    }
}
