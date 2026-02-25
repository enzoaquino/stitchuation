import Foundation

struct ParsedMaterial {
    var materialType: MaterialType = .other
    var brand: String? = nil
    var name: String = ""
    var code: String? = nil
    var quantity: Int = 1
    var unit: String? = nil
}

final class StitchGuideParser {
    // Known brand -> (code regex pattern, material type)
    private static let knownBrands: [(brand: String, codePattern: String, type: MaterialType)] = [
        ("Splendor", "S\\d+", .thread),
        ("Flair", "F\\d+", .thread),
        ("Neon Rays", "N\\d+", .thread),
        ("Silk Lame Braid", "SL\\d+", .thread),
        ("Silk Lamé Braid", "SL\\d+", .thread),
        ("Radiance", "J\\d+", .thread),
        ("Petite Very Velvet", "V\\d+", .thread),
        ("Sundance Beads", "#\\d+", .bead),
        ("DMC", "\\d{3,4}", .thread),
        ("Kreinik", "\\d+", .thread),
    ]

    private static let quantityPattern = try! NSRegularExpression(
        pattern: "(\\d+)\\s+(Cards?|Spools?|Tubes?|Strands?|Skeins?|Hanks?)",
        options: .caseInsensitive
    )

    private static let codeInParensPattern = try! NSRegularExpression(
        pattern: "\\(([^)]+)\\)",
        options: []
    )

    private static let headerPatterns = ["fibers:", "stitches:", "threads:", "materials:", "supplies:"]
    private static let accessoryKeywords = ["needle", "stretcher", "frame", "scissors", "laying tool"]
    private static let beadKeywords = ["bead", "beads"]

    func parseLine(_ line: String) -> ParsedMaterial {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return ParsedMaterial() }

        var result = ParsedMaterial()

        // Try dash-delimited split first
        let segments = trimmed.components(separatedBy: " - ").map { $0.trimmingCharacters(in: .whitespaces) }

        if segments.count >= 2 {
            result.brand = segments[0]

            // Middle segment(s) = name + possible code
            let middleSegments = segments.count >= 3 ? Array(segments[1..<segments.count - 1]) : [segments[1]]
            let middle = middleSegments.joined(separator: " - ")

            // Extract code from parentheses
            let nsMiddle = middle as NSString
            if let match = Self.codeInParensPattern.firstMatch(in: middle, range: NSRange(location: 0, length: nsMiddle.length)) {
                let codeValue = nsMiddle.substring(with: match.range(at: 1))
                result.code = codeValue
                result.name = nsMiddle.replacingCharacters(in: match.range, with: "").trimmingCharacters(in: .whitespaces)
            } else {
                result.name = middle
            }

            // Last segment -- check for quantity
            if segments.count >= 3 {
                let last = segments.last!
                extractQuantity(from: last, into: &result)
                // If no quantity found, treat it as part of the name
                if result.unit == nil && result.quantity == 1 {
                    result.name += " - " + last
                }
            }
        } else {
            // No dash delimiter -- use entire line as name
            result.name = trimmed
        }

        // Classify material type
        result.materialType = classify(result)

        return result
    }

    func parseLines(_ lines: [String]) -> [ParsedMaterial] {
        lines
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { line in
                !line.isEmpty &&
                !Self.headerPatterns.contains(where: { line.lowercased().hasPrefix($0) }) &&
                line.count > 3
            }
            .map { parseLine($0) }
            .filter { material in
                !material.name.isEmpty &&
                // Filter out unrecognizable lines (no brand, no code, unknown type)
                !(material.brand == nil && material.code == nil && material.materialType == .other)
            }
    }

    private func extractQuantity(from text: String, into result: inout ParsedMaterial) {
        let nsText = text as NSString
        if let match = Self.quantityPattern.firstMatch(in: text, range: NSRange(location: 0, length: nsText.length)) {
            result.quantity = Int(nsText.substring(with: match.range(at: 1))) ?? 1
            result.unit = nsText.substring(with: match.range(at: 2))
        }
    }

    private func classify(_ material: ParsedMaterial) -> MaterialType {
        // Check known brands first
        if let brand = material.brand {
            for known in Self.knownBrands {
                if brand.localizedCaseInsensitiveContains(known.brand) {
                    return known.type
                }
            }
        }

        let lowerName = material.name.lowercased()
        let lowerBrand = (material.brand ?? "").lowercased()
        let combined = lowerBrand + " " + lowerName

        // Keyword classification -- check accessory first since
        // "beading needle" contains "bead" but is an accessory
        if Self.accessoryKeywords.contains(where: { combined.contains($0) }) {
            return .accessory
        }
        if Self.beadKeywords.contains(where: { combined.contains($0) }) {
            return .bead
        }

        // If it has a brand, likely thread
        if material.brand != nil && !material.brand!.isEmpty {
            return .thread
        }

        return .other
    }
}
