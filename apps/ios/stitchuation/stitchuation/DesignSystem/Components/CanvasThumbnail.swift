import SwiftUI

struct CanvasThumbnail: View {
    enum ThumbnailSize {
        case fixed(CGFloat)
        case fill

        var isFixed: Bool {
            if case .fixed = self { return true }
            return false
        }

        var fixedValue: CGFloat? {
            if case .fixed(let v) = self { return v }
            return nil
        }
    }

    let imageKey: String?
    var size: ThumbnailSize = .fixed(48)

    @Environment(\.networkClient) private var networkClient
    @State private var loadedImage: UIImage?
    @State private var isLoading = false

    var body: some View {
        Group {
            if let loadedImage {
                Image(uiImage: loadedImage)
                    .resizable()
                    .scaledToFill()
            } else if isLoading {
                placeholderView
                    .overlay {
                        ProgressView()
                            .tint(Color.terracotta)
                            .scaleEffect(size.isFixed && (size.fixedValue ?? 48) < 100 ? 0.6 : 1.0)
                    }
            } else {
                placeholderView
            }
        }
        .frame(width: size.fixedValue, height: size.fixedValue)
        .frame(maxWidth: size.isFixed ? nil : .infinity)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
        .overlay(
            RoundedRectangle(cornerRadius: CornerRadius.subtle)
                .stroke(Color.slate.opacity(0.3), lineWidth: 0.5)
        )
        .task(id: imageKey) {
            await loadImage()
        }
    }

    private var placeholderView: some View {
        RoundedRectangle(cornerRadius: CornerRadius.subtle)
            .fill(Color.parchment)
            .overlay {
                Image(systemName: "photo")
                    .font(.system(size: min((size.fixedValue ?? 48) * 0.4, 20)))
                    .foregroundStyle(Color.clay)
            }
    }

    private func loadImage() async {
        loadedImage = nil
        guard let imageKey, !imageKey.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }

        let image = await ImageCache.shared.image(for: imageKey, networkClient: networkClient)
        loadedImage = image
    }
}
