import Foundation

enum MaterialType: String, Codable, CaseIterable {
    case thread
    case bead
    case accessory
    case ribbon
    case other

    var displayName: String {
        switch self {
        case .thread: return "Thread"
        case .bead: return "Bead"
        case .accessory: return "Accessory"
        case .ribbon: return "Ribbon"
        case .other: return "Other"
        }
    }
}
