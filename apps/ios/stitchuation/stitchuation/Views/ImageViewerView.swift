import SwiftUI

struct ImageViewerView: View {
    let images: [JournalImage]
    let initialIndex: Int

    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient
    @State private var currentIndex: Int
    @State private var loadedImages: [UUID: UIImage] = [:]

    init(images: [JournalImage], initialIndex: Int) {
        self.images = images
        self.initialIndex = initialIndex
        self._currentIndex = State(initialValue: initialIndex)
    }

    var body: some View {
        ZStack {
            Color.espresso.ignoresSafeArea()

            TabView(selection: $currentIndex) {
                ForEach(Array(images.enumerated()), id: \.element.id) { index, image in
                    imagePageView(image)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack {
                HStack {
                    if images.count > 1 {
                        Text("\(currentIndex + 1) of \(images.count)")
                            .font(.typeStyle(.subheadline))
                            .fontWeight(.medium)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(.white.opacity(0.15))
                            .clipShape(Circle())
                    }
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.sm)

                Spacer()

                if images.count > 1 {
                    HStack(spacing: Spacing.sm) {
                        ForEach(0..<images.count, id: \.self) { index in
                            Circle()
                                .fill(index == currentIndex ? Color.terracotta : .white.opacity(0.35))
                                .frame(width: 7, height: 7)
                                .animation(.easeInOut(duration: 0.2), value: currentIndex)
                        }
                    }
                    .padding(.bottom, Spacing.xl)
                }
            }
        }
        .statusBarHidden(true)
    }

    @ViewBuilder
    private func imagePageView(_ journalImage: JournalImage) -> some View {
        Group {
            if let uiImage = loadedImages[journalImage.id] {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    .padding(.horizontal, Spacing.sm)
            } else {
                ProgressView()
                    .tint(Color.terracotta)
                    .scaleEffect(1.2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            await loadImage(journalImage)
        }
    }

    private func loadImage(_ journalImage: JournalImage) async {
        guard loadedImages[journalImage.id] == nil,
              let networkClient else { return }
        do {
            let data = try await networkClient.fetchData(path: "/images/\(journalImage.imageKey)")
            if let image = UIImage(data: data) {
                loadedImages[journalImage.id] = image
            }
        } catch {
            // Failed to load — stays as spinner
        }
    }
}
