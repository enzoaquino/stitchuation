import SwiftUI
import SwiftData
import PhotosUI

extension Notification.Name {
    static let journalImagesDidChange = Notification.Name("journalImagesDidChange")
}

struct AddJournalEntryView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    let piece: StitchPiece

    @State private var notes = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var selectedImages: [SelectedImage] = []
    @State private var showPhotoOptions = false
    @State private var showCamera = false
    @State private var showLibraryPicker = false
    @State private var isSaving = false

    private var canSave: Bool {
        !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedImages.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What did you work on?", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                        .font(.typeStyle(.body))
                } header: {
                    Text("Notes")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
                .listRowBackground(Color.parchment)

                Section {
                    if !selectedImages.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: Spacing.sm) {
                                ForEach(selectedImages.indices, id: \.self) { index in
                                    ZStack(alignment: .topTrailing) {
                                        Image(uiImage: selectedImages[index].image)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 100, height: 100)
                                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))

                                        Button {
                                            selectedImages.remove(at: index)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 20))
                                                .foregroundStyle(.white)
                                                .background(Circle().fill(Color.espresso.opacity(0.6)))
                                        }
                                        .offset(x: 4, y: -4)
                                    }
                                }
                            }
                            .padding(.vertical, Spacing.sm)
                        }
                        .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
                    }

                    if selectedImages.count < 4 {
                        Button {
                            if CameraView.isCameraAvailable {
                                showPhotoOptions = true
                            } else {
                                showLibraryPicker = true
                            }
                        } label: {
                            HStack(spacing: Spacing.sm) {
                                Image(systemName: "photo.badge.plus")
                                    .foregroundStyle(Color.terracotta)
                                Text(selectedImages.isEmpty ? "Add Photos" : "Add More Photos")
                                    .font(.typeStyle(.subheadline))
                                    .foregroundStyle(Color.walnut)
                            }
                        }
                        .buttonStyle(.plain)
                        .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                            Button("Take Photo") { showCamera = true }
                            Button("Choose from Library") { showLibraryPicker = true }
                            Button("Cancel", role: .cancel) { }
                        }
                    }
                } header: {
                    Text("Photos")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
                .listRowBackground(Color.parchment)
            }
            .font(.typeStyle(.body))
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle("New Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        isSaving = true
                        saveEntry()
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(Color.terracotta)
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(!canSave || isSaving)
                    .foregroundStyle(Color.terracotta)
                }
            }
            .onChange(of: selectedPhotos) { _, newItems in
                Task {
                    for item in newItems {
                        if let data = try? await item.loadTransferable(type: Data.self),
                           let uiImage = UIImage(data: data) {
                            selectedImages.append(SelectedImage(image: uiImage, data: data))
                        }
                    }
                    selectedPhotos = []
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImages.append(SelectedImage(image: image, data: data))
                } onDismiss: {
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhotos, maxSelectionCount: 4 - selectedImages.count, matching: .images)
        }
    }

    private func saveEntry() {
        let entryNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry = JournalEntry(
            piece: piece,
            notes: entryNotes.isEmpty ? nil : entryNotes
        )
        modelContext.insert(entry)

        // Create JournalImage + PendingUpload for each photo immediately
        for (index, selectedImage) in selectedImages.enumerated() {
            let imageId = UUID()
            let compressed = compressImage(selectedImage.data, maxBytes: 10 * 1024 * 1024)
            let uploadPath = "/pieces/\(piece.id.uuidString)/entries/\(entry.id.uuidString)/images"

            // Create JournalImage with pending key — image shows immediately
            let journalImage = JournalImage(
                id: imageId,
                entry: entry,
                imageKey: "pending:\(imageId.uuidString)",
                sortOrder: index
            )
            modelContext.insert(journalImage)

            // Cache the image in memory so it renders instantly
            if let uiImage = UIImage(data: compressed) {
                Task {
                    await ImageCache.shared.store(uiImage, forKey: "pending:\(imageId.uuidString)")
                }
            }

            // Create PendingUpload for background upload
            let pendingUpload = PendingUpload(
                entityType: "journalImage",
                entityId: imageId,
                uploadPath: uploadPath,
                imageData: compressed,
                parentEntryId: entry.id,
                sortOrder: index
            )
            modelContext.insert(pendingUpload)
        }

        try? modelContext.save()
        dismiss()
    }
}

private struct SelectedImage {
    let image: UIImage
    let data: Data
}
