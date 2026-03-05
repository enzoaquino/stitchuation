import SwiftUI
import PhotosUI
import UIKit

struct ColorSamplerView: View {
    @Environment(\.dismiss) private var dismiss

    let onColorSelected: (String) -> Void

    @State private var showCamera = false
    @State private var showLibraryPicker = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var image: UIImage?
    @State private var sampledColor: UIColor?
    @State private var sampledHex: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let image {
                    GeometryReader { geo in
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity)
                            .gesture(
                                DragGesture(minimumDistance: 0)
                                    .onEnded { value in
                                        sampleColor(at: value.location, in: geo.size, image: image)
                                    }
                            )
                    }

                    if let sampledColor, let sampledHex {
                        VStack(spacing: Spacing.md) {
                            HStack(spacing: Spacing.md) {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color(uiColor: sampledColor))
                                    .frame(width: 48, height: 48)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.walnut.opacity(0.3), lineWidth: 1)
                                    )

                                Text(sampledHex)
                                    .font(.typeStyle(.data))
                                    .foregroundStyle(Color.espresso)
                            }

                            Button {
                                onColorSelected(sampledHex)
                                dismiss()
                            } label: {
                                Text("Use This Color")
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, Spacing.sm)
                                    .background(Color.terracotta)
                                    .cornerRadius(10)
                            }
                            .padding(.horizontal, Spacing.lg)
                        }
                        .padding(.vertical, Spacing.md)
                        .background(Color.parchment)
                    } else {
                        Text("Tap the image to sample a color")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.clay)
                            .padding(.vertical, Spacing.md)
                    }
                } else {
                    Spacer()
                    VStack(spacing: Spacing.md) {
                        Image(systemName: "eyedropper")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.clay)

                        Text("Choose a photo to sample a color from")
                            .font(.typeStyle(.body))
                            .foregroundStyle(Color.walnut)

                        Menu {
                            if CameraView.isCameraAvailable {
                                Button("Take Photo", systemImage: "camera") {
                                    showCamera = true
                                }
                            }
                            Button("Choose from Library", systemImage: "photo") {
                                showLibraryPicker = true
                            }
                        } label: {
                            Text("Select Photo")
                                .font(.typeStyle(.headline))
                                .foregroundStyle(.white)
                                .padding(.horizontal, Spacing.xl)
                                .padding(.vertical, Spacing.sm)
                                .background(Color.terracotta)
                                .cornerRadius(10)
                        }
                    }
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.linen)
            .navigationTitle("Color Sampler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                if image != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            if CameraView.isCameraAvailable {
                                Button("Take Photo", systemImage: "camera") {
                                    showCamera = true
                                }
                            }
                            Button("Choose from Library", systemImage: "photo") {
                                showLibraryPicker = true
                            }
                        } label: {
                            Image(systemName: "arrow.triangle.2.circlepath.camera")
                                .foregroundStyle(Color.terracotta)
                        }
                    }
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { capturedImage, _ in
                    image = capturedImage
                    sampledColor = nil
                    sampledHex = nil
                } onDismiss: {
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhoto, matching: .images)
            .onChange(of: selectedPhoto) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self),
                       let loadedImage = UIImage(data: data) {
                        image = loadedImage
                        sampledColor = nil
                        sampledHex = nil
                    }
                }
            }
        }
        .presentationBackground(Color.linen)
    }

    private func sampleColor(at tapLocation: CGPoint, in viewSize: CGSize, image: UIImage) {
        let imageAspect = image.size.width / image.size.height
        let viewAspect = viewSize.width / viewSize.height

        let displayedSize: CGSize
        let origin: CGPoint

        if imageAspect > viewAspect {
            let w = viewSize.width
            let h = w / imageAspect
            displayedSize = CGSize(width: w, height: h)
            origin = CGPoint(x: 0, y: (viewSize.height - h) / 2)
        } else {
            let h = viewSize.height
            let w = h * imageAspect
            displayedSize = CGSize(width: w, height: h)
            origin = CGPoint(x: (viewSize.width - w) / 2, y: 0)
        }

        let relativeX = (tapLocation.x - origin.x) / displayedSize.width
        let relativeY = (tapLocation.y - origin.y) / displayedSize.height

        guard relativeX >= 0, relativeX <= 1, relativeY >= 0, relativeY <= 1 else { return }

        let imagePoint = CGPoint(
            x: relativeX * image.size.width,
            y: relativeY * image.size.height
        )

        if let result = image.averageColor(at: imagePoint) {
            sampledColor = result.color
            sampledHex = result.hex
        }
    }
}
