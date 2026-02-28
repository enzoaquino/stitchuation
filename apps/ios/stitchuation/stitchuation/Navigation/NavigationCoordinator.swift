import SwiftUI

@Observable
final class NavigationCoordinator {
    var pendingProjectId: UUID?
    var journalPath = NavigationPath()
}
