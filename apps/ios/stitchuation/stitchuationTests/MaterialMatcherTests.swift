import Testing
import Foundation
@testable import stitchuation

@Suite("MaterialMatcher Tests")
struct MaterialMatcherTests {

    // MARK: - Normalization

    @Test("normalize lowercases and trims whitespace")
    func normalizeBasic() {
        #expect(MaterialMatcher.normalize("  Splendor  ") == "splendor")
    }

    @Test("normalize strips leading/trailing punctuation")
    func normalizePunctuation() {
        #expect(MaterialMatcher.normalize("#310") == "310")
        #expect(MaterialMatcher.normalize("S832.") == "s832")
    }

    @Test("normalize handles nil as empty string")
    func normalizeNil() {
        #expect(MaterialMatcher.normalize(nil) == "")
    }

    @Test("normalize handles empty string")
    func normalizeEmpty() {
        #expect(MaterialMatcher.normalize("") == "")
    }

    // MARK: - Matching

    @Test("exact match links material to thread")
    func exactMatch() {
        let thread = NeedleThread(brand: "Splendor", number: "S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Splendor",
            name: "Dark Green",
            code: "S832"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    @Test("case-insensitive match works")
    func caseInsensitiveMatch() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "dmc",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    @Test("no match when brand differs")
    func noMatchDifferentBrand() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Anchor",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("no match when code differs")
    func noMatchDifferentCode() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "White",
            code: "B5200"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("skips non-thread material types")
    func skipNonThread() {
        let thread = NeedleThread(brand: "Mill Hill", number: "00123", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .bead,
            brand: "Mill Hill",
            name: "Red Bead",
            code: "00123"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("skips materials with nil brand or code")
    func skipMissingFields() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")

        let noBrand = PieceMaterial(piece: piece, materialType: .thread, name: "Black", code: "310")
        #expect(MaterialMatcher.findMatch(for: noBrand, in: [thread]) == nil)

        let noCode = PieceMaterial(piece: piece, materialType: .thread, brand: "DMC", name: "Black")
        #expect(MaterialMatcher.findMatch(for: noCode, in: [thread]) == nil)
    }

    @Test("ambiguous match returns nil (multiple threads match)")
    func ambiguousMatch() {
        let thread1 = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let thread2 = NeedleThread(brand: "DMC", number: "310", quantity: 2)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread1, thread2])

        #expect(result == nil)
    }

    @Test("skips deleted threads")
    func skipDeletedThread() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        thread.deletedAt = Date()
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("match with whitespace and punctuation normalization")
    func normalizedMatch() {
        let thread = NeedleThread(brand: "Splendor ", number: "#S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: " splendor",
            name: "Dark Green",
            code: "S832."
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    // MARK: - Batch matching

    @Test("matchMaterials links matching materials and sets acquired")
    func batchMatch() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "DMC", name: "Black", code: "310")
        let m2 = PieceMaterial(piece: piece, materialType: .thread, brand: "Anchor", name: "White", code: "001")

        let matched = MaterialMatcher.matchMaterials([m1, m2], against: [thread])

        #expect(matched == 1)
        #expect(m1.threadId == thread.id)
        #expect(m1.acquired == true)
        #expect(m2.threadId == nil)
        #expect(m2.acquired == false)
    }

    @Test("matchThread links unlinked materials across pieces")
    func reverseMatch() {
        let thread = NeedleThread(brand: "Splendor", number: "S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832")
        let m2 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832", acquired: true, threadId: UUID()) // already linked

        let matched = MaterialMatcher.matchThread(thread, against: [m1, m2])

        #expect(matched == 1)
        #expect(m1.threadId == thread.id)
        #expect(m1.acquired == true)
        // m2 untouched — already linked
    }
}
