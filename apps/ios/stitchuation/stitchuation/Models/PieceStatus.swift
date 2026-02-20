import Foundation

enum PieceStatus: String, Codable, CaseIterable {
    case stash
    case kitting
    case wip
    case stitched
    case atFinishing = "at_finishing"
    case finished

    var displayName: String {
        switch self {
        case .stash: return "Stash"
        case .kitting: return "Kitting"
        case .wip: return "WIP"
        case .stitched: return "Stitched"
        case .atFinishing: return "At Finishing"
        case .finished: return "Finished"
        }
    }

    /// Statuses that appear in the Projects Active tab
    static let activeStatuses: [PieceStatus] = [.kitting, .wip, .stitched, .atFinishing]

    /// Whether this is an active project status (not stash, not finished)
    var isActive: Bool { Self.activeStatuses.contains(self) }

    /// The next status in the lifecycle, or nil if finished
    var next: PieceStatus? {
        guard let index = Self.allCases.firstIndex(of: self),
              index + 1 < Self.allCases.count else { return nil }
        return Self.allCases[index + 1]
    }
}
