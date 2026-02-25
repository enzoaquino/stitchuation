import Testing
import Foundation
@testable import stitchuation

@Suite("PieceMaterial Tests")
struct PieceMaterialTests {
    @Test("MaterialType has 4 cases")
    func materialTypeCaseCount() {
        #expect(MaterialType.allCases.count == 4)
    }

    @Test("MaterialType raw values match API values")
    func materialTypeRawValues() {
        #expect(MaterialType.thread.rawValue == "thread")
        #expect(MaterialType.bead.rawValue == "bead")
        #expect(MaterialType.accessory.rawValue == "accessory")
        #expect(MaterialType.other.rawValue == "other")
    }

    @Test("MaterialType display names are correct")
    func materialTypeDisplayNames() {
        #expect(MaterialType.thread.displayName == "Thread")
        #expect(MaterialType.bead.displayName == "Bead")
        #expect(MaterialType.accessory.displayName == "Accessory")
        #expect(MaterialType.other.displayName == "Other")
    }

    @Test("MaterialType Codable round-trip")
    func materialTypeCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        for type in MaterialType.allCases {
            let data = try encoder.encode(type)
            let decoded = try decoder.decode(MaterialType.self, from: data)
            #expect(decoded == type)
        }
    }

    @Test("PieceMaterial initializes with defaults")
    func defaultInit() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(piece: piece, name: "Dark Green")

        #expect(material.name == "Dark Green")
        #expect(material.materialType == .other)
        #expect(material.quantity == 1)
        #expect(material.acquired == false)
        #expect(material.sortOrder == 0)
        #expect(material.brand == nil)
        #expect(material.code == nil)
        #expect(material.unit == nil)
        #expect(material.notes == nil)
        #expect(material.deletedAt == nil)
    }

    @Test("PieceMaterial initializes with all fields")
    func fullInit() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Splendor",
            name: "Dark Green",
            code: "S832",
            quantity: 2,
            unit: "Card",
            notes: "for 18 ct",
            acquired: true,
            sortOrder: 3
        )

        #expect(material.materialType == .thread)
        #expect(material.brand == "Splendor")
        #expect(material.code == "S832")
        #expect(material.quantity == 2)
        #expect(material.unit == "Card")
        #expect(material.notes == "for 18 ct")
        #expect(material.acquired == true)
        #expect(material.sortOrder == 3)
    }

    @Test("PieceMaterial displayLine formats correctly")
    func displayLine() {
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")

        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832")
        #expect(m1.displayLine == "Splendor \u{00B7} Dark Green (S832)")

        let m2 = PieceMaterial(piece: piece, name: "Beading Needle")
        #expect(m2.displayLine == "Beading Needle")

        let m3 = PieceMaterial(piece: piece, brand: "DMC", name: "Black")
        #expect(m3.displayLine == "DMC \u{00B7} Black")
    }
}
