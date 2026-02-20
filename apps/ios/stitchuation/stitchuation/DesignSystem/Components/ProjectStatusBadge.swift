import SwiftUI

struct ProjectStatusBadge: View {
    let status: ProjectStatus

    private var backgroundColor: Color {
        switch status {
        case .wip: return Color.terracotta
        case .atFinishing: return Color.dustyRose
        case .completed: return Color.sage
        }
    }

    var body: some View {
        Text(status.displayName)
            .font(.typeStyle(.footnote))
            .fontWeight(.medium)
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xxs)
            .background(backgroundColor)
            .clipShape(Capsule())
    }
}
