import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif

struct ScanMaterialsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    let piece: StitchPiece
    let onMaterialsParsed: ([ParsedMaterial]) -> Void

    @State private var selectedPhoto: PhotosPickerItem? = nil
    @State private var showCamera = false
    @State private var showDocumentPicker = false
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
                            Text("Analyzing stitch guide...")
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.walnut)
                        }
                    } else {
                        EmptyStateView(
                            icon: "camera.viewfinder",
                            title: "Scan Stitch Guide",
                            message: "Take a photo, choose from your library, or select a document to import the fibers list"
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

                            Button {
                                showDocumentPicker = true
                            } label: {
                                Label("Select Document", systemImage: "doc")
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
                    Task {
                        await processImage(image)
                    }
                } onDismiss: {
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showDocumentPicker) {
                DocumentPickerView { url in
                    Task {
                        await processDocument(url)
                    }
                }
            }
        }
    }

    private func processPhotoItem(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorMessage = "Could not load image"
            return
        }
        await sendToAPI(fileData: data, mediaType: "image/jpeg")
    }

    private func processImage(_ image: UIImage) async {
        guard let data = image.jpegData(compressionQuality: 0.8) else {
            errorMessage = "Could not process image"
            return
        }
        await sendToAPI(fileData: data, mediaType: "image/jpeg")
    }

    private func processDocument(_ url: URL) async {
        guard url.startAccessingSecurityScopedResource() else {
            errorMessage = "Could not access document"
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        guard let data = try? Data(contentsOf: url) else {
            errorMessage = "Could not read document"
            return
        }

        let mediaType = Self.mediaType(for: url)
        await sendToAPI(fileData: data, mediaType: mediaType)
    }

    private func sendToAPI(fileData: Data, mediaType: String) async {
        isProcessing = true
        errorMessage = nil

        do {
            guard let networkClient else {
                throw APIError.network("Not connected")
            }
            let materials = try await networkClient.parseStitchGuide(
                fileData: fileData,
                mediaType: mediaType
            )

            await MainActor.run {
                isProcessing = false
                if materials.isEmpty {
                    errorMessage = "No materials found. Try a clearer photo or different document."
                } else {
                    onMaterialsParsed(materials)
                }
            }
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to analyze stitch guide. Please try again."
            }
        }
    }

    static func mediaType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf": return "application/pdf"
        case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "png": return "image/png"
        case "webp": return "image/webp"
        default: return "image/jpeg"
        }
    }
}
