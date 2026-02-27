import SwiftUI
import SwiftData
import PhotosUI

struct AddCanvasView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    @State private var designer = ""
    @State private var designName = ""
    @State private var acquiredAt: Date?
    @State private var showDatePicker = false
    @State private var size = ""
    @State private var meshCount = ""
    @State private var notes = ""

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImageData: Data?

    @State private var addAnother = false

    @State private var showPhotoOptions = false
    @State private var showCamera = false
    @State private var showLibraryPicker = false

    private var meshCountValue: Int? {
        guard !meshCount.isEmpty else { return nil }
        return Int(meshCount)
    }

    private var isMeshCountValid: Bool {
        meshCount.isEmpty || (meshCountValue != nil && meshCountValue! > 0)
    }

    @ViewBuilder
    private var photoSection: some View {
        Button {
            if CameraView.isCameraAvailable {
                showPhotoOptions = true
            } else {
                showLibraryPicker = true
            }
        } label: {
            if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
            } else {
                VStack(spacing: Spacing.md) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.terracotta)
                    Text("Add Photo")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.walnut)
                }
                .frame(height: 180)
                .frame(maxWidth: .infinity)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.card)
                        .strokeBorder(
                            Color.clay.opacity(0.4),
                            style: StrokeStyle(lineWidth: 1.5, dash: [8, 6])
                        )
                )
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.lg)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Photo zone
                    photoSection

                    // Canvas Info card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Canvas Info")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            TextField("Designer (e.g. Melissa Shirley)", text: $designer)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            TextField("Design Name", text: $designName)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Details card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Details")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            Toggle("Date Acquired", isOn: $showDatePicker)
                                .font(.typeStyle(.body))
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)

                            if showDatePicker {
                                DatePicker(
                                    "Acquired",
                                    selection: Binding(
                                        get: { acquiredAt ?? Date() },
                                        set: { acquiredAt = $0 }
                                    ),
                                    displayedComponents: .date
                                )
                                .datePickerStyle(.graphical)
                                .tint(Color.terracotta)
                                .padding(.vertical, Spacing.sm)
                            }

                            Divider().background(Color.parchment)

                            TextField("Size (e.g. 13x18, 10\" round)", text: $size)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            MeshCountPicker(meshCount: $meshCount)
                                .padding(.vertical, Spacing.md)

                            if !isMeshCountValid {
                                Text("Enter a positive number")
                                    .font(.typeStyle(.footnote))
                                    .foregroundStyle(Color.terracotta)
                            }

                            Divider().background(Color.parchment)

                            TextField("Notes", text: $notes, axis: .vertical)
                                .lineLimit(3...6)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Add Another banner
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .foregroundStyle(Color.clay)
                        Text("Add Another")
                            .font(.typeStyle(.body))
                            .foregroundStyle(Color.walnut)
                        Spacer()
                        Toggle("", isOn: $addAnother)
                            .labelsHidden()
                            .tint(Color.terracotta)
                    }
                    .padding(Spacing.lg)
                    .background(Color.terracottaMuted.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.xxl)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle("Add Canvas")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveCanvas() }
                        .disabled(designer.isEmpty || designName.isEmpty || !isMeshCountValid)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                Button("Take Photo") { showCamera = true }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImageData = data
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhoto, matching: .images)
            .onChange(of: selectedPhoto) { _, newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self) {
                        selectedImageData = data
                    }
                }
            }
        }
    }

    private func saveCanvas() {
        let piece = StitchPiece(
            designer: designer,
            designName: designName,
            size: size.isEmpty ? nil : size,
            meshCount: meshCountValue,
            notes: notes.isEmpty ? nil : notes,
            acquiredAt: showDatePicker ? acquiredAt : nil
        )
        modelContext.insert(piece)

        if let imageData = selectedImageData {
            let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
            let uploadPath = "/pieces/\(piece.id.uuidString)/image"

            // Persist PendingUpload before attempting network
            let pendingUpload = PendingUpload(
                entityType: "piece",
                entityId: piece.id,
                uploadPath: uploadPath,
                imageData: compressed
            )
            modelContext.insert(pendingUpload)

            if let networkClient {
                let pieceId = piece.id
                let pieceDesigner = piece.designer
                let pieceDesignName = piece.designName
                Task {
                    do {
                        // Ensure piece exists on server
                        let body: [String: Any] = [
                            "id": pieceId.uuidString,
                            "designer": pieceDesigner,
                            "designName": pieceDesignName,
                        ]
                        let jsonData = try JSONSerialization.data(withJSONObject: body)
                        _ = try await networkClient.postJSON(path: "/pieces", body: jsonData)

                        let responseData = try await networkClient.uploadImage(
                            path: uploadPath,
                            imageData: compressed,
                            filename: "\(pieceId.uuidString).jpg"
                        )
                        if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                           let imageKey = json["imageKey"] as? String {
                            await MainActor.run {
                                piece.imageKey = imageKey
                                piece.updatedAt = Date()
                                // Upload succeeded — delete PendingUpload
                                modelContext.delete(pendingUpload)
                            }
                            // Cache the image immediately
                            if let cachedImage = UIImage(data: compressed) {
                                await ImageCache.shared.store(cachedImage, forKey: imageKey)
                            }
                            await ImageCache.shared.storeToDisk(compressed, forKey: imageKey)
                        }
                    } catch {
                        // Network failed — PendingUpload persists for retry
                    }
                }
            }
        }

        if addAnother {
            // Intentionally keep designer — users often add multiple canvases from the same designer
            designName = ""
            acquiredAt = nil
            showDatePicker = false
            size = ""
            meshCount = ""
            notes = ""
            selectedPhoto = nil
            selectedImageData = nil
        } else {
            dismiss()
        }
    }

}
