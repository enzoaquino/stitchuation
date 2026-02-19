import Testing
import Foundation
@testable import stitchuation

struct JournalEntryTests {
    @Test func initWithNotes() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project, notes: "Finished the background")

        #expect(entry.project === project)
        #expect(entry.notes == "Finished the background")
    }

    @Test func initWithoutNotes() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)

        #expect(entry.project === project)
        #expect(entry.notes == nil)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)
        let after = Date()

        #expect(entry.createdAt >= before)
        #expect(entry.createdAt <= after)
        #expect(entry.updatedAt >= before)
        #expect(entry.updatedAt <= after)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)

        #expect(entry.notes == nil)
        #expect(entry.deletedAt == nil)
        #expect(entry.syncedAt == nil)
    }

    @Test func initDefaultsImagesToEmptyArray() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(project: project)

        #expect(entry.images.isEmpty)
    }

    @Test func initWithCustomUUID() {
        let customId = UUID()
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let entry = JournalEntry(id: customId, project: project)

        #expect(entry.id == customId)
    }
}
