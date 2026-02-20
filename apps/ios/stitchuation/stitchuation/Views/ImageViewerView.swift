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
                    ZoomableImagePage(image: loadedImages[image.id])
                        .tag(index)
                        .task {
                            await loadImage(image)
                        }
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
                            .frame(width: 40, height: 40)
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

    private func loadImage(_ journalImage: JournalImage) async {
        guard loadedImages[journalImage.id] == nil else { return }
        let image = await ImageCache.shared.image(for: journalImage.imageKey, networkClient: networkClient)
        if let image {
            loadedImages[journalImage.id] = image
        }
    }
}

// MARK: - Zoomable Image Page

private struct ZoomableImagePage: View {
    let image: UIImage?

    @State private var currentZoom: CGFloat = 0
    @State private var totalZoom: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private var effectiveZoom: CGFloat {
        max(1, totalZoom + currentZoom)
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .scaleEffect(effectiveZoom)
                    .offset(offset)
                    .gesture(
                        MagnifyGesture()
                            .onChanged { value in
                                currentZoom = value.magnification - 1
                            }
                            .onEnded { value in
                                totalZoom = max(1, totalZoom + currentZoom)
                                currentZoom = 0
                                if totalZoom <= 1 {
                                    withAnimation(Motion.gentle) {
                                        offset = .zero
                                        lastOffset = .zero
                                    }
                                }
                            }
                            .simultaneously(with:
                                DragGesture()
                                    .onChanged { value in
                                        if effectiveZoom > 1 {
                                            offset = CGSize(
                                                width: lastOffset.width + value.translation.width,
                                                height: lastOffset.height + value.translation.height
                                            )
                                        }
                                    }
                                    .onEnded { _ in
                                        lastOffset = offset
                                    }
                            )
                    )
                    .onTapGesture(count: 2) {
                        withAnimation(Motion.gentle) {
                            if totalZoom > 1 {
                                totalZoom = 1
                                offset = .zero
                                lastOffset = .zero
                            } else {
                                totalZoom = 2
                            }
                        }
                    }
            } else {
                ProgressView()
                    .tint(Color.terracotta)
                    .scaleEffect(1.2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
