import Testing
import Foundation
@testable import stitchuation

@Suite("StitchGuideParser Tests")
struct StitchGuideParserTests {
    let parser = StitchGuideParser()

    // MARK: - Known Brand Patterns

    @Test("parses Splendor thread line")
    func parseSplendor() {
        let result = parser.parseLine("Splendor - Dark Green (S832) - 1 Card")
        #expect(result.brand == "Splendor")
        #expect(result.name == "Dark Green")
        #expect(result.code == "S832")
        #expect(result.quantity == 1)
        #expect(result.unit == "Card")
        #expect(result.materialType == .thread)
    }

    @Test("parses Flair thread line")
    func parseFlair() {
        let result = parser.parseLine("Flair - Antique Mauve (F511) - 1 Card")
        #expect(result.brand == "Flair")
        #expect(result.name == "Antique Mauve")
        #expect(result.code == "F511")
        #expect(result.materialType == .thread)
    }

    @Test("parses Neon Rays thread line")
    func parseNeonRays() {
        let result = parser.parseLine("Neon Rays - Emerald (N38) - 1 Card")
        #expect(result.brand == "Neon Rays")
        #expect(result.code == "N38")
        #expect(result.materialType == .thread)
    }

    @Test("parses DMC thread line")
    func parseDMC() {
        let result = parser.parseLine("DMC - Black (310) - 2 Skeins")
        #expect(result.brand == "DMC")
        #expect(result.name == "Black")
        #expect(result.code == "310")
        #expect(result.quantity == 2)
        #expect(result.unit == "Skeins")
        #expect(result.materialType == .thread)
    }

    @Test("parses Sundance Beads line")
    func parseSundanceBeads() {
        let result = parser.parseLine("Sundance Beads - Emerald (#424) - 1 Tube")
        #expect(result.brand == "Sundance Beads")
        #expect(result.code == "#424")
        #expect(result.materialType == .bead)
    }

    @Test("parses Silk Lame Braid line")
    func parseSilkLame() {
        let result = parser.parseLine("Silk Lame Braid - Gold (SL102) - 1 Spool")
        #expect(result.brand == "Silk Lame Braid")
        #expect(result.code == "SL102")
        #expect(result.materialType == .thread)
    }

    // MARK: - Fallback Parsing

    @Test("parses unknown brand with dash delimiter")
    func parseUnknownBrand() {
        let result = parser.parseLine("Mystery Brand - Pretty Color (X99) - 3 Cards")
        #expect(result.brand == "Mystery Brand")
        #expect(result.name == "Pretty Color")
        #expect(result.code == "X99")
        #expect(result.quantity == 3)
        #expect(result.unit == "Cards")
    }

    @Test("parses line without quantity")
    func parseNoQuantity() {
        let result = parser.parseLine("DMC - Ecru (Ecru)")
        #expect(result.brand == "DMC")
        #expect(result.name == "Ecru")
        #expect(result.quantity == 1)
    }

    @Test("parses simple line without dashes")
    func parseSimpleLine() {
        let result = parser.parseLine("Beading Needle & Clear Thread")
        #expect(result.name == "Beading Needle & Clear Thread")
        #expect(result.brand == nil)
        #expect(result.materialType == .accessory)
    }

    // MARK: - Classification

    @Test("classifies needle as accessory")
    func classifyNeedle() {
        let result = parser.parseLine("Size 24 Tapestry Needle")
        #expect(result.materialType == .accessory)
    }

    @Test("classifies bead keyword")
    func classifyBeadKeyword() {
        let result = parser.parseLine("Mill Hill Glass Beads - Red (02013)")
        #expect(result.materialType == .bead)
    }

    // MARK: - Quantity Extraction

    @Test("extracts plural units")
    func pluralUnits() {
        let result = parser.parseLine("DMC - Red (321) - 3 Skeins")
        #expect(result.quantity == 3)
        #expect(result.unit == "Skeins")
    }

    @Test("extracts Spool unit")
    func spoolUnit() {
        let result = parser.parseLine("Kreinik - Gold (002) - 1 Spool")
        #expect(result.quantity == 1)
        #expect(result.unit == "Spool")
    }

    // MARK: - Batch Parsing

    @Test("parseLines filters headers and blank lines")
    func parseLinesFiltering() {
        let lines = [
            "Fibers:",
            "Splendor - Dark Green (S832) - 1 Card",
            "",
            "Flair - Antique Mauve (F511) - 1 Card",
            "Stitches:",
            "Continental",
        ]
        let results = parser.parseLines(lines)
        #expect(results.count == 2)
        #expect(results[0].brand == "Splendor")
        #expect(results[1].brand == "Flair")
    }
}
