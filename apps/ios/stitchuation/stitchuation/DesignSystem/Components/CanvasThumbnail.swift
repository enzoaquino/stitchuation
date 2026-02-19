import SwiftUI

struct CanvasThumbnail: View {
    let imageKey: String?
    var size: CGFloat = 48

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
                            .scaleEffect(size < 100 ? 0.6 : 1.0)
                    }
            } else {
                placeholderView
            }
        }
        .frame(width: size == .infinity ? nil : size, height: size == .infinity ? nil : size)
        .frame(maxWidth: size == .infinity ? .infinity : nil)
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
                    .font(.system(size: min(size * 0.4, 20)))
                    .foregroundStyle(Color.clay)
            }
    }

    private func loadImage() async {
        loadedImage = nil
        guard let imageKey, let networkClient else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let data = try await networkClient.fetchData(path: "/images/\(imageKey)")
            if let image = UIImage(data: data) {
                loadedImage = image
            }
        } catch {
            // Failed to load image — placeholder remains
        }
    }
}
