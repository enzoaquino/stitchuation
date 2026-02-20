import Testing
import Foundation
@testable import stitchuation

struct JournalEntryTests {
    @Test func initWithNotes() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece, notes: "Finished the background")

        #expect(entry.piece === piece)
        #expect(entry.notes == "Finished the background")
    }

    @Test func initWithoutNotes() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)

        #expect(entry.piece === piece)
        #expect(entry.notes == nil)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)
        let after = Date()

        #expect(entry.createdAt >= before)
        #expect(entry.createdAt <= after)
        #expect(entry.updatedAt >= before)
        #expect(entry.updatedAt <= after)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)

        #expect(entry.notes == nil)
        #expect(entry.deletedAt == nil)
        #expect(entry.syncedAt == nil)
    }

    @Test func initDefaultsImagesToEmptyArray() {
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(piece: piece)

        #expect(entry.images.isEmpty)
    }

    @Test func initWithCustomUUID() {
        let customId = UUID()
        let piece = StitchPiece(designer: "Test", designName: "Test")
        let entry = JournalEntry(id: customId, piece: piece)

        #expect(entry.id == customId)
    }
}
