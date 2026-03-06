import Foundation

enum MaterialMatcher {

    /// Normalize a string for fuzzy matching: lowercase, trim whitespace, strip leading/trailing punctuation.
    static func normalize(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "" }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return trimmed.trimmingCharacters(in: .punctuationCharacters)
    }

    /// Find a single matching thread for a material. Returns nil if zero or multiple matches.
    static func findMatch(for material: PieceMaterial, in threads: [NeedleThread]) -> NeedleThread? {
        guard material.materialType == .thread else { return nil }
        guard let brand = material.brand, !brand.isEmpty,
              let code = material.code, !code.isEmpty else { return nil }

        let normalizedBrand = normalize(brand)
        let normalizedCode = normalize(code)
        guard !normalizedBrand.isEmpty, !normalizedCode.isEmpty else { return nil }

        let matches = threads.filter { thread in
            guard thread.deletedAt == nil else { return false }
            return normalize(thread.brand) == normalizedBrand
                && normalize(thread.number) == normalizedCode
        }

        return matches.count == 1 ? matches.first : nil
    }

    /// Match an array of materials against the user's thread inventory.
    /// Links matches by setting `threadId` and `acquired = true`.
    /// Returns the number of materials matched.
    @discardableResult
    static func matchMaterials(_ materials: [PieceMaterial], against threads: [NeedleThread]) -> Int {
        var count = 0
        for material in materials {
            guard material.threadId == nil else { continue }
            if let match = findMatch(for: material, in: threads) {
                material.threadId = match.id
                material.acquired = true
                material.updatedAt = Date()
                count += 1
            }
        }
        return count
    }

    /// Match a newly added thread against all unlinked materials.
    /// Links matches by setting `threadId` and `acquired = true`.
    /// Returns the number of materials matched.
    @discardableResult
    static func matchThread(_ thread: NeedleThread, against materials: [PieceMaterial]) -> Int {
        var count = 0
        for material in materials {
            guard material.threadId == nil,
                  material.materialType == .thread,
                  material.deletedAt == nil else { continue }

            guard let brand = material.brand, !brand.isEmpty,
                  let code = material.code, !code.isEmpty else { continue }

            let normalizedBrand = normalize(brand)
            let normalizedCode = normalize(code)

            if normalize(thread.brand) == normalizedBrand
                && normalize(thread.number) == normalizedCode {
                material.threadId = thread.id
                material.acquired = true
                material.updatedAt = Date()
                count += 1
            }
        }
        return count
    }
}
