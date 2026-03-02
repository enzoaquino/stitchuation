import Foundation

struct ParsedMaterial {
    var materialType: MaterialType = .other
    var brand: String? = nil
    var name: String = ""
    var code: String? = nil
    var quantity: Int = 1
    var unit: String? = nil
}
