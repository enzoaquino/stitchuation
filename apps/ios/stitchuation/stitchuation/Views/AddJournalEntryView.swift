import SwiftUI
import SwiftData
import PhotosUI

struct AddJournalEntryView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.networkClient) private var networkClient

    let project: StitchProject

    @State private var notes = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var selectedImages: [SelectedImage] = []
    @State private var showPhotoOptions = false
    @State private var showCamera = false
    @State private var showLibraryPicker = false

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
                    Button("Save") { saveEntry() }
                        .disabled(!canSave)
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
            .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                Button("Take Photo") { showCamera = true }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImages.append(SelectedImage(image: image, data: data))
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
            project: project,
            notes: entryNotes.isEmpty ? nil : entryNotes
        )
        modelContext.insert(entry)

        // Create PendingUploads for each selected image — no JournalImage records yet
        var pendingUploads: [PendingUpload] = []
        for (index, selectedImage) in selectedImages.enumerated() {
            let imageId = UUID()
            let compressed = compressImage(selectedImage.data, maxBytes: 10 * 1024 * 1024)
            let uploadPath = "/projects/\(project.id.uuidString)/entries/\(entry.id.uuidString)/images"

            let pendingUpload = PendingUpload(
                entityType: "journalImage",
                entityId: imageId,
                uploadPath: uploadPath,
                imageData: compressed,
                parentEntryId: entry.id,
                sortOrder: index
            )
            modelContext.insert(pendingUpload)
            pendingUploads.append(pendingUpload)
        }

        if let networkClient, !pendingUploads.isEmpty {
            let projectIdString = project.id.uuidString
            let canvasIdString = project.canvas.id.uuidString
            let entryIdString = entry.id.uuidString
            let entryNotesForServer = entryNotes.isEmpty ? nil : entryNotes

            Task {
                do {
                    // Ensure project exists on server
                    let projectBody: [String: Any] = ["id": projectIdString, "canvasId": canvasIdString]
                    let projectJSON = try JSONSerialization.data(withJSONObject: projectBody)
                    _ = try? await networkClient.postJSON(path: "/projects", body: projectJSON)

                    // Ensure entry exists on server
                    var entryBody: [String: Any] = ["id": entryIdString]
                    if let notes = entryNotesForServer { entryBody["notes"] = notes }
                    let entryJSON = try JSONSerialization.data(withJSONObject: entryBody)
                    _ = try? await networkClient.postJSON(path: "/projects/\(projectIdString)/entries", body: entryJSON)

                    // Upload each image
                    for (index, pendingUpload) in pendingUploads.enumerated() {
                        let responseData = try await networkClient.uploadImage(
                            path: pendingUpload.uploadPath,
                            imageData: pendingUpload.imageData,
                            filename: "\(pendingUpload.entityId.uuidString).jpg"
                        )
                        if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                           let imageKey = json["imageKey"] as? String {
                            await MainActor.run {
                                // Now create the JournalImage with a real imageKey
                                let journalImage = JournalImage(
                                    id: pendingUpload.entityId,
                                    entry: entry,
                                    imageKey: imageKey,
                                    sortOrder: index
                                )
                                modelContext.insert(journalImage)
                                // Upload succeeded — delete PendingUpload
                                modelContext.delete(pendingUpload)
                            }
                            // Cache the image
                            if let cachedImage = UIImage(data: pendingUpload.imageData) {
                                await ImageCache.shared.store(cachedImage, forKey: imageKey)
                            }
                            await ImageCache.shared.storeToDisk(pendingUpload.imageData, forKey: imageKey)
                        }
                    }
                } catch {
                    // Network failed — PendingUploads persist for retry
                }
            }
        }

        dismiss()
    }
}

private struct SelectedImage {
    let image: UIImage
    let data: Data
}
