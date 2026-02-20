import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var buttonTitle: String? = nil
    var onButtonTap: (() -> Void)? = nil

    @State private var showIcon = false
    @State private var showTitle = false
    @State private var showMessage = false
    @State private var showButton = false

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Color.clay)
                .opacity(showIcon ? 1 : 0)
                .offset(y: showIcon ? 0 : 10)

            Text(title)
                .font(.typeStyle(.title2))
                .foregroundStyle(Color.espresso)
                .opacity(showTitle ? 1 : 0)
                .offset(y: showTitle ? 0 : 10)

            Text(message)
                .font(.typeStyle(.body))
                .foregroundStyle(Color.walnut)
                .multilineTextAlignment(.center)
                .opacity(showMessage ? 1 : 0)
                .offset(y: showMessage ? 0 : 10)

            if let buttonTitle, let onButtonTap {
                Button {
                    onButtonTap()
                } label: {
                    Text(buttonTitle)
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.cream)
                        .padding(.horizontal, Spacing.xl)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .clipShape(Capsule())
                }
                .opacity(showButton ? 1 : 0)
                .offset(y: showButton ? 0 : 10)
            }
        }
        .padding(.horizontal, Spacing.xxxl)
        .padding(.vertical, Spacing.xxxl)
        .onAppear {
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showIcon = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 1))) {
                showTitle = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 2))) {
                showMessage = true
            }
            if buttonTitle != nil {
                withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 3))) {
                    showButton = true
                }
            }
        }
    }
}
