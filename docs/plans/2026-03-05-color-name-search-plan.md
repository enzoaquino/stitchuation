# Color Name Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users search threads by typing a color name (e.g. "red") and match against hex codes using perceptual color distance.

**Architecture:** iOS-only. A static CSS named color dictionary + CIE76 Delta E distance function, integrated into the existing `filteredThreads` computed property in `ThreadListView`.

**Tech Stack:** Swift, SwiftUI, Swift Testing

---

### Task 1: Create ColorMatch utility with Delta E distance function

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Extensions/ColorMatch.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/ColorMatchTests.swift`

**Step 1: Write the failing tests**

Create `apps/ios/stitchuation/stitchuationTests/ColorMatchTests.swift`:

```swift
import Testing
@testable import stitchuation

struct ColorMatchTests {
    // MARK: - RGB to Lab conversion

    @Test func convertsWhiteToLab() {
        let lab = ColorMatch.rgbToLab(r: 255, g: 255, b: 255)
        #expect(abs(lab.L - 100.0) < 1.0)
        #expect(abs(lab.a) < 1.0)
        #expect(abs(lab.b) < 1.0)
    }

    @Test func convertsBlackToLab() {
        let lab = ColorMatch.rgbToLab(r: 0, g: 0, b: 0)
        #expect(abs(lab.L) < 1.0)
    }

    @Test func convertsPureRedToLab() {
        let lab = ColorMatch.rgbToLab(r: 255, g: 0, b: 0)
        #expect(lab.L > 50)
        #expect(lab.a > 60) // Red has high positive a*
    }

    // MARK: - Delta E distance

    @Test func identicalColorsHaveZeroDistance() {
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 255, g2: 0, b2: 0)
        #expect(d < 0.01)
    }

    @Test func similarRedsHaveSmallDistance() {
        // #FF0000 vs #FF0100 — nearly identical
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 255, g2: 1, b2: 0)
        #expect(d < 5.0)
    }

    @Test func redVsCrimsonWithinMediumThreshold() {
        // #FF0000 vs #DC143C (crimson)
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 0xDC, g2: 0x14, b2: 0x3C)
        #expect(d < 40.0)
    }

    @Test func redVsSalmonExceedsMediumThreshold() {
        // #FF0000 vs #FA8072 (salmon) — different family
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 0xFA, g2: 0x80, b2: 0x72)
        #expect(d > 40.0)
    }

    @Test func redVsBlueIsVeryFar() {
        let d = ColorMatch.deltaE(r1: 255, g1: 0, b1: 0, r2: 0, g2: 0, b2: 255)
        #expect(d > 100.0)
    }

    // MARK: - Hex parsing

    @Test func parsesHexWithHash() {
        let rgb = ColorMatch.parseHex("#FF8000")
        #expect(rgb?.r == 255)
        #expect(rgb?.g == 128)
        #expect(rgb?.b == 0)
    }

    @Test func parsesHexWithoutHash() {
        let rgb = ColorMatch.parseHex("00FF00")
        #expect(rgb?.r == 0)
        #expect(rgb?.g == 255)
        #expect(rgb?.b == 0)
    }

    @Test func returnsNilForInvalidHex() {
        #expect(ColorMatch.parseHex("nope") == nil)
        #expect(ColorMatch.parseHex("") == nil)
        #expect(ColorMatch.parseHex("FFF") == nil)
    }

    // MARK: - Named color matching

    @Test func matchesExactColorName() {
        // "red" should match #FF0000
        #expect(ColorMatch.matchesColorName("red", hex: "#FF0000"))
    }

    @Test func matchesFuzzyRed() {
        // "red" should match #FF0100 (very close to red)
        #expect(ColorMatch.matchesColorName("red", hex: "#FF0100"))
    }

    @Test func matchesCrimsonAsRed() {
        // "red" should match #CC0000 (dark red)
        #expect(ColorMatch.matchesColorName("red", hex: "#CC0000"))
    }

    @Test func doesNotMatchSalmonAsRed() {
        // "red" should NOT match salmon
        #expect(!ColorMatch.matchesColorName("red", hex: "#FA8072"))
    }

    @Test func doesNotMatchBlueAsRed() {
        #expect(!ColorMatch.matchesColorName("red", hex: "#0000FF"))
    }

    @Test func matchesCaseInsensitive() {
        #expect(ColorMatch.matchesColorName("Red", hex: "#FF0000"))
        #expect(ColorMatch.matchesColorName("RED", hex: "#FF0000"))
    }

    @Test func matchesMultiWordColorName() {
        // "dark red" should match #8B0000 (darkred)
        #expect(ColorMatch.matchesColorName("dark red", hex: "#8B0000"))
    }

    @Test func unknownColorNameReturnsFalse() {
        #expect(!ColorMatch.matchesColorName("sparkle", hex: "#FF0000"))
    }

    @Test func handlesNilHexGracefully() {
        #expect(!ColorMatch.matchesColorName("red", hex: nil))
    }

    @Test func matchesNavyBlue() {
        #expect(ColorMatch.matchesColorName("navy", hex: "#000080"))
    }

    @Test func matchesForestGreenFamily() {
        #expect(ColorMatch.matchesColorName("forest green", hex: "#228B22"))
    }
}
```

**Step 2: Build to verify tests fail**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/ColorMatchTests 2>&1 | tail -20`

Expected: Build failure — `ColorMatch` not found.

**Step 3: Implement ColorMatch**

Create `apps/ios/stitchuation/stitchuation/Extensions/ColorMatch.swift`:

```swift
import Foundation

enum ColorMatch {
    // MARK: - Hex Parsing

    static func parseHex(_ hex: String?) -> (r: Int, g: Int, b: Int)? {
        guard let hex, !hex.isEmpty else { return nil }
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard cleaned.count == 6 else { return nil }
        var rgb: UInt64 = 0
        guard Scanner(string: cleaned).scanHexInt64(&rgb) else { return nil }
        return (r: Int((rgb >> 16) & 0xFF), g: Int((rgb >> 8) & 0xFF), b: Int(rgb & 0xFF))
    }

    // MARK: - CIE Lab Conversion

    static func rgbToLab(r: Int, g: Int, b: Int) -> (L: Double, a: Double, b: Double) {
        // RGB → linear sRGB
        func linearize(_ c: Double) -> Double {
            c > 0.04045 ? pow((c + 0.055) / 1.055, 2.4) : c / 12.92
        }
        let rl = linearize(Double(r) / 255.0)
        let gl = linearize(Double(g) / 255.0)
        let bl = linearize(Double(b) / 255.0)

        // Linear sRGB → XYZ (D65)
        var x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
        var y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750)
        var z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883

        // XYZ → Lab
        func f(_ t: Double) -> Double {
            t > 0.008856 ? pow(t, 1.0 / 3.0) : (7.787 * t) + (16.0 / 116.0)
        }
        x = f(x); y = f(y); z = f(z)

        let L = (116.0 * y) - 16.0
        let a = 500.0 * (x - y)
        let bStar = 200.0 * (y - z)
        return (L, a, bStar)
    }

    // MARK: - Delta E (CIE76)

    static func deltaE(r1: Int, g1: Int, b1: Int, r2: Int, g2: Int, b2: Int) -> Double {
        let lab1 = rgbToLab(r: r1, g: g1, b: b1)
        let lab2 = rgbToLab(r: r2, g: g2, b: b2)
        let dL = lab1.L - lab2.L
        let da = lab1.a - lab2.a
        let db = lab1.b - lab2.b
        return sqrt(dL * dL + da * da + db * db)
    }

    // MARK: - Named Color Matching

    static let defaultThreshold: Double = 40.0

    static func matchesColorName(_ name: String, hex: String?, threshold: Double = defaultThreshold) -> Bool {
        guard let hex, let target = parseHex(hex) else { return false }
        let key = name.lowercased().replacingOccurrences(of: " ", with: "")
        guard let source = namedColors[key] else { return false }
        return deltaE(
            r1: source.r, g1: source.g, b1: source.b,
            r2: target.r, g2: target.g, b2: target.b
        ) <= threshold
    }

    // MARK: - CSS Named Colors (~150)

    static let namedColors: [String: (r: Int, g: Int, b: Int)] = [
        "aliceblue": (240, 248, 255),
        "antiquewhite": (250, 235, 215),
        "aqua": (0, 255, 255),
        "aquamarine": (127, 255, 212),
        "azure": (240, 255, 255),
        "beige": (245, 245, 220),
        "bisque": (255, 228, 196),
        "black": (0, 0, 0),
        "blanchedalmond": (255, 235, 205),
        "blue": (0, 0, 255),
        "blueviolet": (138, 43, 226),
        "brown": (165, 42, 42),
        "burlywood": (222, 184, 135),
        "cadetblue": (95, 158, 160),
        "chartreuse": (127, 255, 0),
        "chocolate": (210, 105, 30),
        "coral": (255, 127, 80),
        "cornflowerblue": (100, 149, 237),
        "cornsilk": (255, 248, 220),
        "crimson": (220, 20, 60),
        "cyan": (0, 255, 255),
        "darkblue": (0, 0, 139),
        "darkcyan": (0, 139, 139),
        "darkgoldenrod": (184, 134, 11),
        "darkgray": (169, 169, 169),
        "darkgreen": (0, 100, 0),
        "darkkhaki": (189, 183, 107),
        "darkmagenta": (139, 0, 139),
        "darkolivegreen": (85, 107, 47),
        "darkorange": (255, 140, 0),
        "darkorchid": (153, 50, 204),
        "darkred": (139, 0, 0),
        "darksalmon": (233, 150, 122),
        "darkseagreen": (143, 188, 143),
        "darkslateblue": (72, 61, 139),
        "darkslategray": (47, 79, 79),
        "darkturquoise": (0, 206, 209),
        "darkviolet": (148, 0, 211),
        "deeppink": (255, 20, 147),
        "deepskyblue": (0, 191, 255),
        "dimgray": (105, 105, 105),
        "dodgerblue": (30, 144, 255),
        "firebrick": (178, 34, 34),
        "floralwhite": (255, 250, 240),
        "forestgreen": (34, 139, 34),
        "fuchsia": (255, 0, 255),
        "gainsboro": (220, 220, 220),
        "ghostwhite": (248, 248, 255),
        "gold": (255, 215, 0),
        "goldenrod": (218, 165, 32),
        "gray": (128, 128, 128),
        "green": (0, 128, 0),
        "greenyellow": (173, 255, 47),
        "honeydew": (240, 255, 240),
        "hotpink": (255, 105, 180),
        "indianred": (205, 92, 92),
        "indigo": (75, 0, 130),
        "ivory": (255, 255, 240),
        "khaki": (240, 230, 140),
        "lavender": (230, 230, 250),
        "lavenderblush": (255, 240, 245),
        "lawngreen": (124, 252, 0),
        "lemonchiffon": (255, 250, 205),
        "lightblue": (173, 216, 230),
        "lightcoral": (240, 128, 128),
        "lightcyan": (224, 255, 255),
        "lightgoldenrodyellow": (250, 250, 210),
        "lightgray": (211, 211, 211),
        "lightgreen": (144, 238, 144),
        "lightpink": (255, 182, 193),
        "lightsalmon": (255, 160, 122),
        "lightseagreen": (32, 178, 170),
        "lightskyblue": (135, 206, 250),
        "lightslategray": (119, 136, 153),
        "lightsteelblue": (176, 196, 222),
        "lightyellow": (255, 255, 224),
        "lime": (0, 255, 0),
        "limegreen": (50, 205, 50),
        "linen": (250, 240, 230),
        "magenta": (255, 0, 255),
        "maroon": (128, 0, 0),
        "mediumaquamarine": (102, 205, 170),
        "mediumblue": (0, 0, 205),
        "mediumorchid": (186, 85, 211),
        "mediumpurple": (147, 112, 219),
        "mediumseagreen": (60, 179, 113),
        "mediumslateblue": (123, 104, 238),
        "mediumspringgreen": (0, 250, 154),
        "mediumturquoise": (72, 209, 204),
        "mediumvioletred": (199, 21, 133),
        "midnightblue": (25, 25, 112),
        "mintcream": (245, 255, 250),
        "mistyrose": (255, 228, 225),
        "moccasin": (255, 228, 181),
        "navajowhite": (255, 222, 173),
        "navy": (0, 0, 128),
        "oldlace": (253, 245, 230),
        "olive": (128, 128, 0),
        "olivedrab": (107, 142, 35),
        "orange": (255, 165, 0),
        "orangered": (255, 69, 0),
        "orchid": (218, 112, 214),
        "palegoldenrod": (238, 232, 170),
        "palegreen": (152, 251, 152),
        "paleturquoise": (175, 238, 238),
        "palevioletred": (219, 112, 147),
        "papayawhip": (255, 239, 213),
        "peachpuff": (255, 218, 185),
        "peru": (205, 133, 63),
        "pink": (255, 192, 203),
        "plum": (221, 160, 221),
        "powderblue": (176, 224, 230),
        "purple": (128, 0, 128),
        "rebeccapurple": (102, 51, 153),
        "red": (255, 0, 0),
        "rosybrown": (188, 143, 143),
        "royalblue": (65, 105, 225),
        "saddlebrown": (139, 69, 19),
        "salmon": (250, 128, 114),
        "sandybrown": (244, 164, 96),
        "seagreen": (46, 139, 87),
        "seashell": (255, 245, 238),
        "sienna": (160, 82, 45),
        "silver": (192, 192, 192),
        "skyblue": (135, 206, 235),
        "slateblue": (106, 90, 205),
        "slategray": (112, 128, 144),
        "snow": (255, 250, 250),
        "springgreen": (0, 255, 127),
        "steelblue": (70, 130, 180),
        "tan": (210, 180, 140),
        "teal": (0, 128, 128),
        "thistle": (216, 191, 216),
        "tomato": (255, 99, 71),
        "turquoise": (64, 224, 208),
        "violet": (238, 130, 238),
        "wheat": (245, 222, 179),
        "white": (255, 255, 255),
        "whitesmoke": (245, 245, 245),
        "yellow": (255, 255, 0),
        "yellowgreen": (154, 205, 50),
    ]
}
```

**Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/ColorMatchTests 2>&1 | tail -20`

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Extensions/ColorMatch.swift apps/ios/stitchuation/stitchuationTests/ColorMatchTests.swift
git commit -m "feat(ios): add ColorMatch utility with named color lookup and Delta E distance"
```

---

### Task 2: Integrate color name search into ThreadListView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift:19-26`

**Step 1: Update filteredThreads to include color name matching**

In `ThreadListView.swift`, replace the `filteredThreads` computed property (lines 19-36):

```swift
var filteredThreads: [NeedleThread] {
    threads.filter { thread in
        if !viewModel.searchText.isEmpty {
            let search = viewModel.searchText.lowercased()
            let matches = thread.brand.lowercased().contains(search)
                || thread.number.lowercased().contains(search)
                || (thread.colorName?.lowercased().contains(search) ?? false)
                || ColorMatch.matchesColorName(search, hex: thread.colorHex)
            if !matches { return false }
        }
        if let brand = viewModel.selectedBrandFilter, thread.brand != brand {
            return false
        }
        if let fiber = viewModel.selectedFiberFilter, thread.fiberType != fiber {
            return false
        }
        return true
    }
}
```

The only change is adding `|| ColorMatch.matchesColorName(search, hex: thread.colorHex)` to the match chain.

**Step 2: Build and verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -5`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift
git commit -m "feat(ios): integrate color name search into thread inventory filter"
```
