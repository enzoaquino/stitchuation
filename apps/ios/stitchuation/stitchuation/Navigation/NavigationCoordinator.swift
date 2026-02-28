import SwiftUI

@Observable
final class NavigationCoordinator {
    var presentedProjectId: PieceIdentifier?
}

struct PieceIdentifier: Identifiable {
    let id: UUID
}
