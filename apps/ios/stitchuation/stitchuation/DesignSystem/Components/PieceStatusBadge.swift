import SwiftUI

struct PieceStatusBadge: View {
    let status: PieceStatus

    @State private var badgeScale: CGFloat = 1.0

    private var backgroundColor: Color {
        switch status {
        case .stash: return Color.walnut
        case .kitting: return Color.dustyRose
        case .wip: return Color.terracotta
        case .stitched: return Color.sage
        case .atFinishing: return Color.clay
        case .finished: return Color.espresso
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
