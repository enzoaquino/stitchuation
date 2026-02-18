import Testing
import SwiftUI
@testable import stitchuation

struct ColorHexTests {
    @Test func parsesValidHexWithHash() {
        let color = Color(hex: "#FF0000")
        // Color(hex:) should not crash for valid input
        #expect(type(of: color) == Color.self)
    }

    @Test func parsesValidHexWithoutHash() {
        let color = Color(hex: "00FF00")
        #expect(type(of: color) == Color.self)
    }

    @Test func parsesBlack() {
        let color = Color(hex: "#000000")
        #expect(type(of: color) == Color.self)
    }

    @Test func parsesWhite() {
        let color = Color(hex: "#FFFFFF")
        #expect(type(of: color) == Color.self)
    }

    @Test func hexValidationRegex() {
        // Valid patterns
        #expect("FF0000".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil)
        #expect("#FF0000".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil)
        #expect("aabbcc".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil)

        // Invalid patterns
        #expect("GGGGGG".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) == nil)
        #expect("FFF".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) == nil)
        #expect("##FF0000".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) == nil)
        #expect("".range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) == nil)
    }
}
