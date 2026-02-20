import Testing
import Foundation
@testable import stitchuation

@Suite("StitchPiece Tests")
struct StitchPieceTests {
    @Test("initializes with required fields and stash status")
    func initWithRequired() {
        let piece = StitchPiece(designer: "Melissa Shirley", designName: "Garden")
        #expect(piece.designer == "Melissa Shirley")
        #expect(piece.designName == "Garden")
        #expect(piece.status == .stash)
        #expect(piece.imageKey == nil)
        #expect(piece.startedAt == nil)
        #expect(piece.entries.isEmpty)
    }

    @Test("initializes with all fields")
    func initWithAll() {
        let id = UUID()
        let now = Date()
        let piece = StitchPiece(
            id: id,
            designer: "D",
            designName: "N",
            status: .wip,
            imageKey: "img.jpg",
            size: "13x18",
            meshCount: 18,
            notes: "Note",
            acquiredAt: now,
            startedAt: now
        )
        #expect(piece.id == id)
        #expect(piece.status == .wip)
        #expect(piece.meshCount == 18)
        #expect(piece.startedAt != nil)
    }

    @Test("timestamps are set on creation")
    func timestamps() {
        let piece = StitchPiece(designer: "D", designName: "N")
        #expect(piece.createdAt <= Date())
        #expect(piece.updatedAt <= Date())
        #expect(piece.deletedAt == nil)
        #expect(piece.syncedAt == nil)
    }
}
