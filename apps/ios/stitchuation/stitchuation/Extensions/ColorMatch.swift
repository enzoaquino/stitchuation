import Foundation

/// Utility for matching hex color codes against named colors using perceptual
/// distance in CIE Lab color space (Delta E / CIE76).
enum ColorMatch {

    // MARK: - Hex Parsing

    /// Parse a hex string (with or without leading '#') to RGB components.
    /// Returns nil for invalid input (wrong length, non-hex characters, nil, etc.).
    static func parseHex(_ hex: String?) -> (r: Int, g: Int, b: Int)? {
        guard let hex else { return nil }
        var cleaned = hex
        if cleaned.hasPrefix("#") {
            cleaned = String(cleaned.dropFirst())
        }
        guard cleaned.count == 6 else { return nil }
        guard let value = UInt32(cleaned, radix: 16) else { return nil }
        let r = Int((value >> 16) & 0xFF)
        let g = Int((value >> 8) & 0xFF)
        let b = Int(value & 0xFF)
        return (r, g, b)
    }

    // MARK: - RGB to CIE Lab

    /// Convert sRGB (0-255) to CIE Lab color space using D65 illuminant.
    static func rgbToLab(r: Int, g: Int, b: Int) -> (L: Double, a: Double, b: Double) {
        // Step 1: sRGB 0-255 -> linear sRGB 0-1
        func linearize(_ c: Int) -> Double {
            let v = Double(c) / 255.0
            return v > 0.04045
                ? pow((v + 0.055) / 1.055, 2.4)
                : v / 12.92
        }

        let rLin = linearize(r)
        let gLin = linearize(g)
        let bLin = linearize(b)

        // Step 2: Linear sRGB -> XYZ (D65)
        var x = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375
        var y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750
        var z = rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041

        // Normalize for D65 white point
        x /= 0.95047
        // y /= 1.00000  (no-op)
        z /= 1.08883

        // Step 3: XYZ -> Lab
        func f(_ t: Double) -> Double {
            let delta: Double = 6.0 / 29.0
            if t > delta * delta * delta {
                return pow(t, 1.0 / 3.0)
            } else {
                return t / (3.0 * delta * delta) + 4.0 / 29.0
            }
        }

        let fx = f(x)
        let fy = f(y)
        let fz = f(z)

        let L = 116.0 * fy - 16.0
        let a = 500.0 * (fx - fy)
        let bVal = 200.0 * (fy - fz)

        return (L, a, bVal)
    }

    // MARK: - Delta E (CIE76)

    /// Compute CIE76 Delta E: Euclidean distance in Lab space.
    static func deltaE(r1: Int, g1: Int, b1: Int, r2: Int, g2: Int, b2: Int) -> Double {
        let lab1 = rgbToLab(r: r1, g: g1, b: b1)
        let lab2 = rgbToLab(r: r2, g: g2, b: b2)

        let dL = lab1.L - lab2.L
        let da = lab1.a - lab2.a
        let db = lab1.b - lab2.b

        return sqrt(dL * dL + da * da + db * db)
    }

    // MARK: - Color Name Matching

    /// Returns true if the given hex color is perceptually close to the named CSS color.
    ///
    /// The `name` is lowercased and stripped of spaces before lookup. If the name
    /// isn't found in the dictionary of CSS named colors, this returns false.
    static func matchesColorName(_ name: String, hex: String?, threshold: Double = 40.0) -> Bool {
        guard let parsed = parseHex(hex) else { return false }

        let key = name.lowercased().replacingOccurrences(of: " ", with: "")
        guard let named = namedColors[key] else { return false }

        let distance = deltaE(
            r1: named.r, g1: named.g, b1: named.b,
            r2: parsed.r, g2: parsed.g, b2: parsed.b
        )
        return distance <= threshold
    }

    // MARK: - CSS Named Colors (148 colors)

    /// All standard CSS named colors mapped by lowercase name to RGB.
    static let namedColors: [String: (r: Int, g: Int, b: Int)] = [
        // Reds
        "red": (255, 0, 0),
        "darkred": (139, 0, 0),
        "crimson": (220, 20, 60),
        "firebrick": (178, 34, 34),
        "indianred": (205, 92, 92),
        "salmon": (250, 128, 114),
        "darksalmon": (233, 150, 122),
        "lightsalmon": (255, 160, 122),

        // Oranges
        "orange": (255, 165, 0),
        "darkorange": (255, 140, 0),
        "orangered": (255, 69, 0),
        "tomato": (255, 99, 71),
        "coral": (255, 127, 80),
        "lightcoral": (240, 128, 128),

        // Yellows
        "yellow": (255, 255, 0),
        "lightyellow": (255, 255, 224),
        "lemonchiffon": (255, 250, 205),
        "lightgoldenrodyellow": (250, 250, 210),
        "papayawhip": (255, 239, 213),
        "moccasin": (255, 228, 181),
        "peachpuff": (255, 218, 185),
        "palegoldenrod": (238, 232, 170),
        "khaki": (240, 230, 140),
        "darkkhaki": (189, 183, 107),
        "gold": (255, 215, 0),
        "goldenrod": (218, 165, 32),
        "darkgoldenrod": (184, 134, 11),

        // Greens
        "green": (0, 128, 0),
        "darkgreen": (0, 100, 0),
        "forestgreen": (34, 139, 34),
        "limegreen": (50, 205, 50),
        "lime": (0, 255, 0),
        "lightgreen": (144, 238, 144),
        "palegreen": (152, 251, 152),
        "springgreen": (0, 255, 127),
        "mediumspringgreen": (0, 250, 154),
        "greenyellow": (173, 255, 47),
        "lawngreen": (124, 252, 0),
        "chartreuse": (127, 255, 0),
        "mediumaquamarine": (102, 205, 170),
        "mediumseagreen": (60, 179, 113),
        "seagreen": (46, 139, 87),
        "darkseagreen": (143, 188, 143),
        "olivedrab": (107, 142, 35),
        "olive": (128, 128, 0),
        "darkolivegreen": (85, 107, 47),
        "yellowgreen": (154, 205, 50),

        // Cyans / Teals
        "cyan": (0, 255, 255),
        "aqua": (0, 255, 255),
        "lightcyan": (224, 255, 255),
        "darkturquoise": (0, 206, 209),
        "turquoise": (64, 224, 208),
        "mediumturquoise": (72, 209, 204),
        "paleturquoise": (175, 238, 238),
        "aquamarine": (127, 255, 212),
        "teal": (0, 128, 128),
        "darkcyan": (0, 139, 139),
        "cadetblue": (95, 158, 160),

        // Blues
        "blue": (0, 0, 255),
        "darkblue": (0, 0, 139),
        "navy": (0, 0, 128),
        "mediumblue": (0, 0, 205),
        "royalblue": (65, 105, 225),
        "cornflowerblue": (100, 149, 237),
        "steelblue": (70, 130, 180),
        "lightsteelblue": (176, 196, 222),
        "dodgerblue": (30, 144, 255),
        "deepskyblue": (0, 191, 255),
        "lightskyblue": (135, 206, 250),
        "skyblue": (135, 206, 235),
        "lightblue": (173, 216, 230),
        "powderblue": (176, 224, 230),
        "midnightblue": (25, 25, 112),
        "slateblue": (106, 90, 205),
        "mediumslateblue": (123, 104, 238),
        "darkslateblue": (72, 61, 139),

        // Purples / Violets
        "purple": (128, 0, 128),
        "indigo": (75, 0, 130),
        "violet": (238, 130, 238),
        "darkviolet": (148, 0, 211),
        "blueviolet": (138, 43, 226),
        "darkorchid": (153, 50, 204),
        "mediumorchid": (186, 85, 211),
        "orchid": (218, 112, 214),
        "plum": (221, 160, 221),
        "mediumpurple": (147, 112, 219),
        "magenta": (255, 0, 255),
        "fuchsia": (255, 0, 255),
        "darkmagenta": (139, 0, 139),
        "mediumvioletred": (199, 21, 133),
        "deeppink": (255, 20, 147),
        "hotpink": (255, 105, 180),
        "palevioletred": (219, 112, 147),
        "thistle": (216, 191, 216),
        "lavender": (230, 230, 250),
        "lavenderblush": (255, 240, 245),

        // Pinks
        "pink": (255, 192, 203),
        "lightpink": (255, 182, 193),
        "mistyrose": (255, 228, 225),

        // Browns
        "brown": (165, 42, 42),
        "maroon": (128, 0, 0),
        "saddlebrown": (139, 69, 19),
        "sienna": (160, 82, 45),
        "chocolate": (210, 105, 30),
        "peru": (205, 133, 63),
        "sandybrown": (244, 164, 96),
        "burlywood": (222, 184, 135),
        "tan": (210, 180, 140),
        "rosybrown": (188, 143, 143),
        "wheat": (245, 222, 179),
        "navajowhite": (255, 222, 173),
        "bisque": (255, 228, 196),
        "blanchedalmond": (255, 235, 205),
        "cornsilk": (255, 248, 220),

        // Whites
        "white": (255, 255, 255),
        "snow": (255, 250, 250),
        "honeydew": (240, 255, 240),
        "mintcream": (245, 255, 250),
        "azure": (240, 255, 255),
        "aliceblue": (240, 248, 255),
        "ghostwhite": (248, 248, 255),
        "whitesmoke": (245, 245, 245),
        "seashell": (255, 245, 238),
        "beige": (245, 245, 220),
        "oldlace": (253, 245, 230),
        "floralwhite": (255, 250, 240),
        "ivory": (255, 255, 240),
        "antiquewhite": (250, 235, 215),
        "linen": (250, 240, 230),

        // Grays
        "black": (0, 0, 0),
        "gray": (128, 128, 128),
        "grey": (128, 128, 128),
        "darkgray": (169, 169, 169),
        "darkgrey": (169, 169, 169),
        "silver": (192, 192, 192),
        "lightgray": (211, 211, 211),
        "lightgrey": (211, 211, 211),
        "gainsboro": (220, 220, 220),
        "dimgray": (105, 105, 105),
        "dimgrey": (105, 105, 105),
        "lightslategray": (119, 136, 153),
        "lightslategrey": (119, 136, 153),
        "slategray": (112, 128, 144),
        "slategrey": (112, 128, 144),
        "darkslategray": (47, 79, 79),
        "darkslategrey": (47, 79, 79),
    ]
}
