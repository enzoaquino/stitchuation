import Foundation

enum ProjectStatus: String, Codable, CaseIterable {
    case wip
    case atFinishing = "at_finishing"
    case completed

    var displayName: String {
        switch self {
        case .wip: return "WIP"
        case .atFinishing: return "At Finishing"
        case .completed: return "Completed"
        }
    }
}
