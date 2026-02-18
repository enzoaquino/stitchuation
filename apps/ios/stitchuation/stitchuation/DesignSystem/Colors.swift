import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

extension Color {
    // Backgrounds
    static let linen = Color(light: "#F5F0E8", dark: "#2A2320")
    static let parchment = Color(light: "#EDE6D8", dark: "#362F29")
    static let cream = Color(light: "#FAF7F2", dark: "#403733")

    // Text
    static let espresso = Color(light: "#3B2F2F", dark: "#F0E8DC")
    static let walnut = Color(light: "#5C4A3D", dark: "#C4B8A8")
    static let clay = Color(light: "#8B7355", dark: "#9E8E7A")

    // Accents
    static let terracotta = Color(light: "#C4704B", dark: "#D4896A")
    static let terracottaLight = Color(light: "#D4896A", dark: "#E0A088")
    static let terracottaMuted = Color(light: "#E8C4B0", dark: "#5C4438")
    static let sage = Color(light: "#7A8B6F", dark: "#8FA282")
    static let dustyRose = Color(light: "#C4919B", dark: "#D4A1AB")
    static let slate = Color(light: "#8B8589", dark: "#A09A9E")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        self.init(
            red: Double((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: Double((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: Double(rgbValue & 0x0000FF) / 255.0
        )
    }

    init(light lightHex: String, dark darkHex: String) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? darkHex : lightHex
            return UIColor(Color(hex: hex))
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            let hex = isDark ? darkHex : lightHex
            return NSColor(Color(hex: hex))
        })
        #else
        self.init(hex: lightHex)
        #endif
    }
}
