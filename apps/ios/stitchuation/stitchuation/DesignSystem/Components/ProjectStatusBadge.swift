import SwiftUI

struct ProjectStatusBadge: View {
    let status: ProjectStatus

    @State private var badgeScale: CGFloat = 1.0

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
            .scaleEffect(badgeScale)
            .onChange(of: status) { _, _ in
                withAnimation(Motion.bouncy) {
                    badgeScale = 1.15
                }
                withAnimation(Motion.bouncy.delay(0.15)) {
                    badgeScale = 1.0
                }
            }
    }
}
