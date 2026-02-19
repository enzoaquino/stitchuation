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

    private var canSave: Bool {
        !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !selectedImages.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What did you work on?", text: $notes, axis: .vertical)
                        .lineLimit(3...8)
                        .font(.sourceSerif(17))
                } header: {
                    Text("Notes")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

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
                        PhotosPicker(
                            selection: $selectedPhotos,
                            maxSelectionCount: 4 - selectedImages.count,
                            matching: .images
                        ) {
                            HStack(spacing: Spacing.sm) {
                                Image(systemName: "photo.badge.plus")
                                    .foregroundStyle(Color.terracotta)
                                Text(selectedImages.isEmpty ? "Add Photos" : "Add More Photos")
                                    .font(.sourceSerif(15))
                                    .foregroundStyle(Color.walnut)
                            }
                        }
                    }
                } header: {
                    Text("Photos")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
            }
            .font(.sourceSerif(17))
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
        }
    }

    private func saveEntry() {
        let entryNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let entry = JournalEntry(
            project: project,
            notes: entryNotes.isEmpty ? nil : entryNotes
        )
        modelContext.insert(entry)

        // Create local JournalImage placeholders and upload in background
        var imagesToUpload: [(JournalImage, Data)] = []
        for (index, selectedImage) in selectedImages.enumerated() {
            let journalImage = JournalImage(
                entry: entry,
                imageKey: "",
                sortOrder: index
            )
            modelContext.insert(journalImage)
            imagesToUpload.append((journalImage, selectedImage.data))
        }

        if let networkClient, !imagesToUpload.isEmpty {
            let projectIdString = project.id.uuidString
            let entryIdString = entry.id.uuidString
            Task {
                for (journalImage, imageData) in imagesToUpload {
                    do {
                        let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
                        let responseData = try await networkClient.uploadImage(
                            path: "/projects/\(projectIdString)/entries/\(entryIdString)/images",
                            imageData: compressed,
                            filename: "\(journalImage.id.uuidString).jpg"
                        )
                        if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                           let imageKey = json["imageKey"] as? String {
                            await MainActor.run {
                                journalImage.imageKey = imageKey
                                journalImage.updatedAt = Date()
                            }
                        }
                    } catch {
                        // Network failed — image saved locally, sync will reconcile
                    }
                }
            }
        }

        dismiss()
    }

    private func compressImage(_ data: Data, maxBytes: Int) -> Data {
        guard let uiImage = UIImage(data: data) else { return data }
        var quality: CGFloat = 0.8
        var compressed = uiImage.jpegData(compressionQuality: quality) ?? data
        while compressed.count > maxBytes && quality > 0.1 {
            quality -= 0.1
            compressed = uiImage.jpegData(compressionQuality: quality) ?? data
        }
        return compressed
    }
}

private struct SelectedImage {
    let image: UIImage
    let data: Data
}
