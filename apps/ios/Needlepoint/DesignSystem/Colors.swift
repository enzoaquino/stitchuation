import SwiftUI

extension Color {
    // Backgrounds
    static let linen = Color(hex: "#F5F0E8")
    static let parchment = Color(hex: "#EDE6D8")
    static let cream = Color(hex: "#FAF7F2")

    // Text
    static let espresso = Color(hex: "#3B2F2F")
    static let walnut = Color(hex: "#5C4A3D")
    static let clay = Color(hex: "#8B7355")

    // Accents
    static let terracotta = Color(hex: "#C4704B")
    static let terracottaLight = Color(hex: "#D4896A")
    static let terracottaMuted = Color(hex: "#E8C4B0")
    static let sage = Color(hex: "#7A8B6F")
    static let dustyRose = Color(hex: "#C4919B")
    static let slate = Color(hex: "#8B8589")
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
}
