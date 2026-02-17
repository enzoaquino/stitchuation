import SwiftUI

extension Font {
    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .bold: return .custom("PlayfairDisplay-Bold", size: size)
        case .semibold: return .custom("PlayfairDisplay-SemiBold", size: size)
        default: return .custom("PlayfairDisplay-Regular", size: size)
        }
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch weight {
        case .semibold: return .custom("SourceSerif4-SemiBold", size: size)
        case .medium: return .custom("SourceSerif4-Medium", size: size)
        default: return .custom("SourceSerif4-Regular", size: size)
        }
    }
}
