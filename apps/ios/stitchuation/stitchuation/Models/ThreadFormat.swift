import Foundation

enum ThreadFormat: String, Codable, CaseIterable {
    case skein, card, hank, spool, ball, cone, other

    var displayName: String {
        switch self {
        case .skein: "Skein"
        case .card: "Card"
        case .hank: "Hank"
        case .spool: "Spool"
        case .ball: "Ball"
        case .cone: "Cone"
        case .other: "Other"
        }
    }
}
