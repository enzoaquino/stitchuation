import Testing
import SwiftUI
@testable import stitchuation

struct TypeStyleTests {
    @Test func largeTitleUsesPlayfair() {
        let style = TypeStyle.largeTitle
        #expect(style.family == .playfair)
        #expect(style.size == 34)
        #expect(style.weight == .bold)
    }

    @Test func titleUsesPlayfair() {
        let style = TypeStyle.title
        #expect(style.family == .playfair)
        #expect(style.size == 28)
        #expect(style.weight == .semibold)
    }

    @Test func title2UsesPlayfair() {
        let style = TypeStyle.title2
        #expect(style.family == .playfair)
        #expect(style.size == 22)
        #expect(style.weight == .semibold)
    }

    @Test func title3UsesSourceSerif() {
        let style = TypeStyle.title3
        #expect(style.family == .sourceSerif)
        #expect(style.size == 20)
        #expect(style.weight == .semibold)
    }

    @Test func headlineUsesSourceSerif() {
        let style = TypeStyle.headline
        #expect(style.family == .sourceSerif)
        #expect(style.size == 17)
        #expect(style.weight == .semibold)
    }

    @Test func bodyUsesSourceSerif() {
        let style = TypeStyle.body
        #expect(style.family == .sourceSerif)
        #expect(style.size == 17)
        #expect(style.weight == .regular)
    }

    @Test func calloutUsesSourceSerif() {
        let style = TypeStyle.callout
        #expect(style.family == .sourceSerif)
        #expect(style.size == 16)
        #expect(style.weight == .regular)
    }

    @Test func subheadlineUsesSourceSerif() {
        let style = TypeStyle.subheadline
        #expect(style.family == .sourceSerif)
        #expect(style.size == 15)
        #expect(style.weight == .regular)
    }

    @Test func footnoteUsesSourceSerif() {
        let style = TypeStyle.footnote
        #expect(style.family == .sourceSerif)
        #expect(style.size == 13)
        #expect(style.weight == .regular)
    }

    @Test func dataUsesSFMono() {
        let style = TypeStyle.data
        #expect(style.family == .sfMono)
        #expect(style.size == 17)
        #expect(style.weight == .medium)
    }

    @Test func allStylesProduceFont() {
        for style in TypeStyle.allCases {
            let font = Font.typeStyle(style)
            #expect(type(of: font) == Font.self)
        }
    }
}
