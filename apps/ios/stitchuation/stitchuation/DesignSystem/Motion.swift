import SwiftUI

enum Motion {
    /// General transitions, stagger reveals. Damping 0.8, response 0.3
    static let gentle: Animation = .spring(response: 0.3, dampingFraction: 0.8)

    /// Quantity stepper, swatch appear, status change. Damping 0.65, response 0.25
    static let bouncy: Animation = .spring(response: 0.25, dampingFraction: 0.65)

    /// Tab switches, small state changes. Damping 0.9, response 0.15
    static let quick: Animation = .spring(response: 0.15, dampingFraction: 0.9)

    /// Calculate stagger delay for sequential animations.
    /// - Parameter index: 0-based index of the element
    /// - Returns: Delay in seconds (0.05s per step)
    static func staggerDelay(index: Int) -> Double {
        Double(index) * 0.05
    }
}
