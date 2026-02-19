import Testing
import Foundation
@testable import stitchuation

struct CanvasTests {
    @Test func initSetsRequiredFields() {
        let canvas = StashCanvas(designer: "Melissa Shirley", designName: "Nutcracker")

        #expect(canvas.designer == "Melissa Shirley")
        #expect(canvas.designName == "Nutcracker")
        #expect(canvas.id != UUID(uuidString: "00000000-0000-0000-0000-000000000000"))
    }

    @Test func initSetsTimestamps() {
        let before = Date()
        let canvas = StashCanvas(designer: "Test", designName: "Test")
        let after = Date()

        #expect(canvas.createdAt >= before)
        #expect(canvas.createdAt <= after)
        #expect(canvas.updatedAt >= before)
        #expect(canvas.updatedAt <= after)
    }

    @Test func initDefaultsOptionalFieldsToNil() {
        let canvas = StashCanvas(designer: "Test", designName: "Test")

        #expect(canvas.acquiredAt == nil)
        #expect(canvas.imageKey == nil)
        #expect(canvas.size == nil)
        #expect(canvas.meshCount == nil)
        #expect(canvas.notes == nil)
        #expect(canvas.deletedAt == nil)
        #expect(canvas.syncedAt == nil)
    }

    @Test func initWithAllFields() {
        let date = Date()
        let canvas = StashCanvas(
            designer: "Kirk & Bradley",
            designName: "Gingerbread",
            acquiredAt: date,
            imageKey: "canvases/user1/canvas1.jpg",
            size: "14x18",
            meshCount: 18,
            notes: "Gift from Mom"
        )

        #expect(canvas.designer == "Kirk & Bradley")
        #expect(canvas.designName == "Gingerbread")
        #expect(canvas.acquiredAt == date)
        #expect(canvas.imageKey == "canvases/user1/canvas1.jpg")
        #expect(canvas.size == "14x18")
        #expect(canvas.meshCount == 18)
        #expect(canvas.notes == "Gift from Mom")
    }

    @Test func initWithClientProvidedUUID() {
        let customId = UUID()
        let canvas = StashCanvas(id: customId, designer: "Test", designName: "Test")

        #expect(canvas.id == customId)
    }
}
