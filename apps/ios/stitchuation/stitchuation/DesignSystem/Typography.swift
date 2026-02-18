import SwiftUI

extension Font {
    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Playfair Display", size: size).weight(weight)
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Source Serif 4", size: size).weight(weight)
    }
}
