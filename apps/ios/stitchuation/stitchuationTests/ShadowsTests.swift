import Testing
import SwiftUI
@testable import stitchuation

struct ShadowsTests {
    @Test func shadowLevelSubtleExists() {
        let level = ShadowLevel.subtle
        #expect(level.radius == 3)
        #expect(level.y == 1)
        #expect(level.opacity == 0.08)
    }

    @Test func shadowLevelElevatedExists() {
        let level = ShadowLevel.elevated
        #expect(level.radius == 12)
        #expect(level.y == 4)
        #expect(level.opacity == 0.12)
    }

    @Test func shadowLevelFloatingExists() {
        let level = ShadowLevel.floating
        #expect(level.radius == 24)
        #expect(level.y == 8)
        #expect(level.opacity == 0.16)
    }
}
