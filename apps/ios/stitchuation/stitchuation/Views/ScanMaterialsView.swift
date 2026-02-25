import SwiftUI
import PhotosUI
import Vision
#if canImport(UIKit)
import UIKit
#endif

struct ScanMaterialsView: View {
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    let onMaterialsParsed: ([ParsedMaterial]) -> Void

    @State private var selectedPhoto: PhotosPickerItem? = nil
    @State private var showCamera = false
    @State private var isProcessing = false
    @State private var errorMessage: String? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()

                VStack(spacing: Spacing.xl) {
                    if isProcessing {
                        VStack(spacing: Spacing.lg) {
                            ProgressView()
                                .tint(Color.terracotta)
                                .scaleEffect(1.5)
                            Text("Reading stitch guide...")
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.walnut)
                        }
                    } else {
                        EmptyStateView(
                            icon: "camera.viewfinder",
                            title: "Scan Stitch Guide",
                            message: "Take a photo or choose from your library to import the fibers list"
                        )

                        VStack(spacing: Spacing.md) {
                            if CameraView.isCameraAvailable {
                                Button {
                                    showCamera = true
                                } label: {
                                    Label("Take Photo", systemImage: "camera")
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, Spacing.md)
                                        .background(Color.terracotta)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                }
                            }

                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("Choose from Library", systemImage: "photo")
                                    .font(.typeStyle(.headline))
                                    .foregroundStyle(Color.terracotta)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, Spacing.md)
                                    .background(Color.cream)
                                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                                            .stroke(Color.terracotta, lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.horizontal, Spacing.xxxl)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.dustyRose)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, Spacing.lg)
                        }
                    }
                }
            }
            .navigationTitle("Scan Guide")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
            }
            .onChange(of: selectedPhoto) { _, newItem in
                guard let newItem else { return }
                Task {
                    await processPhotoItem(newItem)
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, _ in
                    showCamera = false
                    Task {
                        await processImage(image)
                    }
                }
                .ignoresSafeArea()
            }
        }
    }

    private func processPhotoItem(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else {
            errorMessage = "Could not load image"
            return
        }
        await processImage(image)
    }

    private func processImage(_ image: UIImage) async {
        isProcessing = true
        errorMessage = nil

        guard let cgImage = image.cgImage else {
            isProcessing = false
            errorMessage = "Could not process image"
            return
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        do {
            try handler.perform([request])
            let observations = request.results ?? []

            // Sort by Y position (top to bottom) — in Vision coordinates,
            // higher Y means higher on screen, so sort descending
            let sortedLines = observations
                .sorted { $0.boundingBox.origin.y > $1.boundingBox.origin.y }
                .compactMap { $0.topCandidates(1).first?.string }

            let parser = StitchGuideParser()
            let parsed = parser.parseLines(sortedLines)

            await MainActor.run {
                isProcessing = false
                if parsed.isEmpty {
                    errorMessage = "No materials found in image. Try a clearer photo of the fibers section."
                } else {
                    onMaterialsParsed(parsed)
                }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "OCR failed: \(error.localizedDescription)"
            }
        }
    }
}
