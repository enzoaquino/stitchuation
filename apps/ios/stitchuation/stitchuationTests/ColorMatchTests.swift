import Testing
@testable import stitchuation

struct ColorMatchTests {

    // MARK: - RGB to Lab Conversion

    @Test func convertsWhiteToLab() {
        let lab = ColorMatch.rgbToLab(r: 255, g: 255, b: 255)
        #expect(abs(lab.L - 100.0) < 1.0)
        #expect(abs(lab.a) < 1.0)
        #expect(abs(lab.b) < 1.0)
    }

    @Test func convertsBlackToLab() {
        let lab = ColorMatch.rgbToLab(r: 0, g: 0, b: 0)
        #expect(abs(lab.L) < 1.0)
    }

    @Test func convertsPureRedToLab() {
        let lab = ColorMatch.rgbToLab(r: 255, g: 0, b: 0)
        #expect(lab.L > 50)
        #expect(lab.a > 60)
    }

    // MARK: - Delta E Distance

    @Test func identicalColorsHaveZeroDistance() {
        let d = ColorMatch.deltaE(r1: 128, g1: 64, b1: 200, r2: 128, g2: 64, b2: 200)
        #expect(d < 0.01)
    }

    @Test func similarRedsHaveSmallDistance() {
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 255, g2: 1, b2: 0)
        #expect(d < 5.0)
    }

    @Test func redVsCrimsonWithinMediumThreshold() {
        // red #FF0000 vs crimson #DC143C
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 220, g2: 20, b2: 60)
        #expect(d < 40)
    }

    @Test func redVsSalmonExceedsMediumThreshold() {
        // red #FF0000 vs salmon #FA8072
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 250, g2: 128, b2: 114)
        #expect(d > 40)
    }

    @Test func redVsBlueIsVeryFar() {
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 0, g2: 0, b2: 255)
        #expect(d > 100)
    }

    // MARK: - Hex Parsing

    @Test func parsesHexWithHash() {
        let rgb = ColorMatch.parseHex("#FF8000")
        #expect(rgb?.r == 255)
        #expect(rgb?.g == 128)
        #expect(rgb?.b == 0)
    }

    @Test func parsesHexWithoutHash() {
        let rgb = ColorMatch.parseHex("00FF00")
        #expect(rgb?.r == 0)
        #expect(rgb?.g == 255)
        #expect(rgb?.b == 0)
    }

    @Test func returnsNilForInvalidHex() {
        #expect(ColorMatch.parseHex("nope") == nil)
        #expect(ColorMatch.parseHex("") == nil)
        #expect(ColorMatch.parseHex("FFF") == nil)
    }

    // MARK: - Color Name Matching

    @Test func matchesExactColorName() {
        #expect(ColorMatch.matchesColorName("red", hex: "#FF0000"))
    }

    @Test func matchesFuzzyRed() {
        #expect(ColorMatch.matchesColorName("red", hex: "#FF0100"))
    }

    @Test func matchesCrimsonAsRed() {
        // #CC0000 is a dark red, should be close to CSS red
        #expect(ColorMatch.matchesColorName("red", hex: "#CC0000"))
    }

    @Test func doesNotMatchSalmonAsRed() {
        #expect(!ColorMatch.matchesColorName("red", hex: "#FA8072"))
    }

    @Test func doesNotMatchBlueAsRed() {
        #expect(!ColorMatch.matchesColorName("red", hex: "#0000FF"))
    }

    @Test func matchesCaseInsensitive() {
        #expect(ColorMatch.matchesColorName("Red", hex: "#FF0000"))
        #expect(ColorMatch.matchesColorName("RED", hex: "#FF0000"))
    }

    @Test func matchesMultiWordColorName() {
        // "dark red" -> "darkred" -> (139, 0, 0) which is #8B0000
        #expect(ColorMatch.matchesColorName("dark red", hex: "#8B0000"))
    }

    @Test func unknownColorNameReturnsFalse() {
        #expect(!ColorMatch.matchesColorName("sparkle", hex: "#FF0000"))
    }

    @Test func handlesNilHexGracefully() {
        #expect(!ColorMatch.matchesColorName("red", hex: nil))
    }

    @Test func matchesNavyBlue() {
        #expect(ColorMatch.matchesColorName("navy", hex: "#000080"))
    }

    @Test func matchesForestGreenFamily() {
        #expect(ColorMatch.matchesColorName("forest green", hex: "#228B22"))
    }
}
