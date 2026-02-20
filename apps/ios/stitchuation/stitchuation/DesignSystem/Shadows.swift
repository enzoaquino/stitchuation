import SwiftUI

enum ShadowLevel {
    case subtle
    case elevated
    case floating

    var radius: CGFloat {
        switch self {
        case .subtle: return 3
        case .elevated: return 12
        case .floating: return 24
        }
    }

    var y: CGFloat {
        switch self {
        case .subtle: return 1
        case .elevated: return 4
        case .floating: return 8
        }
    }

    var opacity: Double {
        switch self {
        case .subtle: return 0.08
        case .elevated: return 0.12
        case .floating: return 0.16
        }
    }
}

extension View {
    func warmShadow(_ level: ShadowLevel) -> some View {
        self.shadow(
            color: Color(hex: "3B2F2F").opacity(level.opacity),
            radius: level.radius,
            x: 0,
            y: level.y
        )
    }
}
