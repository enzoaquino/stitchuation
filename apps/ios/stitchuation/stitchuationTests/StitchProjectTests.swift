import Testing
import Foundation
@testable import stitchuation

struct StitchProjectTests {
    @Test func initSetsRequiredFields() {
        let canvas = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")
        let project = StitchProject(canvas: canvas)

        #expect(project.canvas === canvas)
        #expect(project.status == .wip)
        #expect(project.startedAt != nil)
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)
        let after = Date()

        #expect(project.createdAt >= before)
        #expect(project.createdAt <= after)
        #expect(project.updatedAt >= before)
        #expect(project.updatedAt <= after)
    }

    @Test func initWithCustomUUID() {
        let customId = UUID()
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(id: customId, canvas: canvas)

        #expect(project.id == customId)
    }

    @Test func initWithAllFields() {
        let canvas = StashCanvas(designer: "Kirk & Bradley", designName: "Gingerbread")
        let startDate = Date()
        let finishingDate = Date().addingTimeInterval(86400)
        let completedDate = Date().addingTimeInterval(172800)

        let project = StitchProject(
            canvas: canvas,
            status: .completed,
            startedAt: startDate,
            finishingAt: finishingDate,
            completedAt: completedDate
        )

        #expect(project.canvas === canvas)
        #expect(project.status == .completed)
        #expect(project.startedAt == startDate)
        #expect(project.finishingAt == finishingDate)
        #expect(project.completedAt == completedDate)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas, startedAt: nil)

        #expect(project.finishingAt == nil)
        #expect(project.completedAt == nil)
        #expect(project.deletedAt == nil)
        #expect(project.syncedAt == nil)
        #expect(project.startedAt == nil)
    }

    @Test func initDefaultsEntriesToEmptyArray() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let project = StitchProject(canvas: canvas)

        #expect(project.entries.isEmpty)
    }
}
