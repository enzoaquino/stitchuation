import SwiftUI

struct CanvasThumbnail: View {
    let imageKey: String?
    var size: CGFloat = 48

    var body: some View {
        placeholderView
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: CornerRadius.subtle)
            .fill(Color.parchment)
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: min(size * 0.4, 20)))
                    .foregroundStyle(Color.clay)
            }
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.subtle)
                    .stroke(Color.slate.opacity(0.3), lineWidth: 0.5)
            )
            .frame(width: size == .infinity ? nil : size, height: size == .infinity ? nil : size)
            .frame(maxWidth: size == .infinity ? .infinity : nil)
    }
}
