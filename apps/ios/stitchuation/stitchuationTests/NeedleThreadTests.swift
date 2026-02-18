import Testing
import Foundation
@testable import stitchuation

struct NeedleThreadTests {
    @Test func initSetsDefaults() {
        let thread = NeedleThread(brand: "DMC", number: "310")
        #expect(thread.brand == "DMC")
        #expect(thread.number == "310")
        #expect(thread.fiberType == .wool)
        #expect(thread.quantity == 0)
        #expect(thread.colorName == nil)
        #expect(thread.colorHex == nil)
        #expect(thread.barcode == nil)
        #expect(thread.weightOrLength == nil)
        #expect(thread.notes == nil)
        #expect(thread.deletedAt == nil)
        #expect(thread.syncedAt == nil)
    }

    @Test func initWithAllFields() {
        let id = UUID()
        let thread = NeedleThread(
            id: id,
            brand: "Anchor",
            number: "403",
            colorName: "Black",
            colorHex: "#000000",
            fiberType: .silk,
            quantity: 5,
            barcode: "1234567890",
            weightOrLength: "8m",
            notes: "Test notes"
        )
        #expect(thread.id == id)
        #expect(thread.brand == "Anchor")
        #expect(thread.number == "403")
        #expect(thread.colorName == "Black")
        #expect(thread.colorHex == "#000000")
        #expect(thread.fiberType == .silk)
        #expect(thread.quantity == 5)
        #expect(thread.barcode == "1234567890")
        #expect(thread.weightOrLength == "8m")
        #expect(thread.notes == "Test notes")
    }

    @Test func createdAtAndUpdatedAtAreSet() {
        let before = Date()
        let thread = NeedleThread(brand: "DMC", number: "310")
        let after = Date()
        #expect(thread.createdAt >= before)
        #expect(thread.createdAt <= after)
        #expect(thread.updatedAt >= before)
        #expect(thread.updatedAt <= after)
    }
}
