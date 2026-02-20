import Testing
import SwiftUI
@testable import stitchuation

struct MotionTests {
    @Test func gentlePresetExists() {
        let anim = Motion.gentle
        #expect(type(of: anim) == Animation.self)
    }

    @Test func bouncyPresetExists() {
        let anim = Motion.bouncy
        #expect(type(of: anim) == Animation.self)
    }

    @Test func quickPresetExists() {
        let anim = Motion.quick
        #expect(type(of: anim) == Animation.self)
    }

    @Test func staggerDelayCalculation() {
        #expect(Motion.staggerDelay(index: 0) == 0.0)
        #expect(Motion.staggerDelay(index: 1) == 0.05)
        #expect(Motion.staggerDelay(index: 2) == 0.10)
    }
}
