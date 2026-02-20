import Testing
import SwiftUI
@testable import stitchuation

struct EmptyStateViewTests {
    @Test func initializesWithRequiredProperties() {
        let view = EmptyStateView(
            icon: "tray",
            title: "No threads yet",
            message: "Tap + to add your first thread"
        )
        #expect(view.icon == "tray")
        #expect(view.title == "No threads yet")
        #expect(view.message == "Tap + to add your first thread")
        #expect(view.buttonTitle == nil)
    }

    @Test func initializesWithOptionalButton() {
        var tapped = false
        let view = EmptyStateView(
            icon: "tray",
            title: "No threads yet",
            message: "Tap + to add your first thread",
            buttonTitle: "Add Thread"
        ) {
            tapped = true
        }
        #expect(view.buttonTitle == "Add Thread")
        #expect(view.onButtonTap != nil)
    }
}
