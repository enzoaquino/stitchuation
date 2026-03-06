import SwiftUI
import SwiftData
import PhotosUI

struct AddCanvasView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    /// When provided, the saved canvas is set to kitting and this callback fires instead of dismissing.
    var onProjectStarted: ((StitchPiece) -> Void)? = nil

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
    @State private var isSaving = false

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
                VStack(spacing: Spacing.sm) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.terracotta.opacity(0.7))
                    Text("Add Photo")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
                .frame(height: 120)
                .frame(maxWidth: .infinity)
                .background(Color.parchment)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.card)
                        .stroke(Color.clay.opacity(0.2), lineWidth: 1)
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
                            ValidatedTextField("Designer (e.g. Melissa Shirley)", text: $designer)

                            Divider().background(Color.parchment)

                            ValidatedTextField("Design Name", text: $designName)
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

                        VStack(alignment: .leading, spacing: 0) {
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

                    if onProjectStarted == nil {
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
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle(onProjectStarted != nil ? "New Project" : "Add Canvas")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        isSaving = true
                        saveCanvas()
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(Color.terracotta)
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(designer.isEmpty || designName.isEmpty || !isMeshCountValid || isSaving)
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
                } onDismiss: {
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

            // Set imageKey immediately with pending key — image shows right away
            piece.imageKey = "pending:\(piece.id.uuidString)"

            // Cache the image in memory so it renders instantly
            if let uiImage = UIImage(data: compressed) {
                Task {
                    await ImageCache.shared.store(uiImage, forKey: "pending:\(piece.id.uuidString)")
                }
            }

            // Create PendingUpload for background upload
            let pendingUpload = PendingUpload(
                entityType: "piece",
                entityId: piece.id,
                uploadPath: uploadPath,
                imageData: compressed
            )
            modelContext.insert(pendingUpload)
        }

        if let onProjectStarted {
            piece.status = .kitting
            piece.startedAt = Date()
            piece.updatedAt = Date()
            dismiss()
            onProjectStarted(piece)
        } else if addAnother {
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
