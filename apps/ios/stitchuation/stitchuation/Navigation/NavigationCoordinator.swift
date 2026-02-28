import SwiftUI

@Observable
final class NavigationCoordinator {
    var presentedProjectId: PieceIdentifier?
    var switchToTab: AppTab?
}

struct PieceIdentifier: Identifiable {
    let id: UUID
}
