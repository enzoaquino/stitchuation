import SwiftUI

// MARK: - Type Scale

enum TypeFamily {
    case playfair
    case sourceSerif
    case sfMono
}

enum TypeStyle: CaseIterable {
    case largeTitle    // Playfair 34 Bold
    case title         // Playfair 28 SemiBold
    case title2        // Playfair 22 SemiBold
    case title3        // Source Serif 20 SemiBold
    case headline      // Source Serif 17 SemiBold
    case body          // Source Serif 17 Regular
    case callout       // Source Serif 16 Regular
    case subheadline   // Source Serif 15 Regular
    case footnote      // Source Serif 13 Regular
    case data          // SF Mono 17 Medium

    var family: TypeFamily {
        switch self {
        case .largeTitle, .title, .title2: return .playfair
        case .title3, .headline, .body, .callout, .subheadline, .footnote: return .sourceSerif
        case .data: return .sfMono
        }
    }

    var size: CGFloat {
        switch self {
        case .largeTitle: return 34
        case .title: return 28
        case .title2: return 22
        case .title3: return 20
        case .headline: return 17
        case .body: return 17
        case .callout: return 16
        case .subheadline: return 15
        case .footnote: return 13
        case .data: return 17
        }
    }

    var weight: Font.Weight {
        switch self {
        case .largeTitle: return .bold
        case .title, .title2, .title3, .headline: return .semibold
        case .body, .callout, .subheadline, .footnote: return .regular
        case .data: return .medium
        }
    }
}

// MARK: - Font Extensions

extension Font {
    static func typeStyle(_ style: TypeStyle) -> Font {
        switch style.family {
        case .playfair:
            return .playfair(style.size, weight: style.weight)
        case .sourceSerif:
            return .sourceSerif(style.size, weight: style.weight)
        case .sfMono:
            return .sfMono(style.size, weight: style.weight)
        }
    }

    static func playfair(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Playfair Display", size: size).weight(weight)
    }

    static func sourceSerif(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .custom("Source Serif 4", size: size).weight(weight)
    }

    static func sfMono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, design: .monospaced).weight(weight)
    }
}
