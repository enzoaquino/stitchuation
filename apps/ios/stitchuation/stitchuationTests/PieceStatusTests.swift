import Testing
@testable import stitchuation

@Suite("PieceStatus Tests")
struct PieceStatusTests {
    @Test("has 6 cases")
    func caseCount() {
        #expect(PieceStatus.allCases.count == 6)
    }

    @Test("raw values match API values")
    func rawValues() {
        #expect(PieceStatus.stash.rawValue == "stash")
        #expect(PieceStatus.kitting.rawValue == "kitting")
        #expect(PieceStatus.wip.rawValue == "wip")
        #expect(PieceStatus.stitched.rawValue == "stitched")
        #expect(PieceStatus.atFinishing.rawValue == "at_finishing")
        #expect(PieceStatus.finished.rawValue == "finished")
    }

    @Test("display names are correct")
    func displayNames() {
        #expect(PieceStatus.stash.displayName == "Stash")
        #expect(PieceStatus.kitting.displayName == "Kitting")
        #expect(PieceStatus.wip.displayName == "WIP")
        #expect(PieceStatus.stitched.displayName == "Stitched")
        #expect(PieceStatus.atFinishing.displayName == "At Finishing")
        #expect(PieceStatus.finished.displayName == "Finished")
    }

    @Test("next status follows lifecycle")
    func nextStatus() {
        #expect(PieceStatus.stash.next == .kitting)
        #expect(PieceStatus.kitting.next == .wip)
        #expect(PieceStatus.wip.next == .stitched)
        #expect(PieceStatus.stitched.next == .atFinishing)
        #expect(PieceStatus.atFinishing.next == .finished)
        #expect(PieceStatus.finished.next == nil)
    }

    @Test("active statuses are kitting through atFinishing")
    func activeStatuses() {
        #expect(PieceStatus.stash.isActive == false)
        #expect(PieceStatus.kitting.isActive == true)
        #expect(PieceStatus.wip.isActive == true)
        #expect(PieceStatus.stitched.isActive == true)
        #expect(PieceStatus.atFinishing.isActive == true)
        #expect(PieceStatus.finished.isActive == false)
    }
}
