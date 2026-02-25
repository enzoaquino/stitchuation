import Foundation

enum MaterialType: String, Codable, CaseIterable {
    case thread
    case bead
    case accessory
    case other

    var displayName: String {
        switch self {
        case .thread: return "Thread"
        case .bead: return "Bead"
        case .accessory: return "Accessory"
        case .other: return "Other"
        }
    }
}
