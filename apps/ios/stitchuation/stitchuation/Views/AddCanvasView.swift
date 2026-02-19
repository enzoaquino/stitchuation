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

    private var meshCountValue: Int? {
        guard !meshCount.isEmpty else { return nil }
        return Int(meshCount)
    }

    private var isMeshCountValid: Bool {
        meshCount.isEmpty || (meshCountValue != nil && meshCountValue! > 0)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 200)
                                .frame(maxWidth: .infinity)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        } else {
                            VStack(spacing: Spacing.md) {
                                Image(systemName: "photo.badge.plus")
                                    .font(.system(size: 32))
                                    .foregroundStyle(Color.terracotta)
                                Text("Add Photo")
                                    .font(.sourceSerif(15))
                                    .foregroundStyle(Color.walnut)
                            }
                            .frame(height: 140)
                            .frame(maxWidth: .infinity)
                            .background(Color.parchment)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        }
                    }
                    .onChange(of: selectedPhoto) { _, newItem in
                        Task {
                            if let data = try? await newItem?.loadTransferable(type: Data.self) {
                                selectedImageData = data
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                }

                Section {
                    TextField("Designer (e.g. Melissa Shirley)", text: $designer)
                    TextField("Design Name", text: $designName)
                } header: {
                    Text("Canvas Info")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    Toggle("Date Acquired", isOn: $showDatePicker)
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
                    }

                    TextField("Size (e.g. 13x18, 10\" round)", text: $size)

                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.sourceSerif(15))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.sourceSerif(12))
                            .foregroundStyle(Color.terracotta)
                    }

                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Details")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Toggle("Add Another", isOn: $addAnother)
            }
            .font(.sourceSerif(17))
            .scrollContentBackground(.hidden)
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
        }
    }

    private func saveCanvas() {
        let canvas = StashCanvas(
            designer: designer,
            designName: designName,
            acquiredAt: showDatePicker ? acquiredAt : nil,
            size: size.isEmpty ? nil : size,
            meshCount: meshCountValue,
            notes: notes.isEmpty ? nil : notes
        )
        modelContext.insert(canvas)

        if let imageData = selectedImageData, let networkClient {
            let canvasId = canvas.id
            Task {
                do {
                    let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
                    let responseData = try await networkClient.uploadImage(
                        path: "/canvases/\(canvasId.uuidString)/image",
                        imageData: compressed,
                        filename: "\(canvasId.uuidString).jpg"
                    )
                    // Update local model with the imageKey from API response
                    if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                       let imageKey = json["imageKey"] as? String {
                        canvas.imageKey = imageKey
                    }
                } catch {
                    // Image upload failed — canvas still saved locally
                }
            }
        }

        if addAnother {
            // Designer intentionally kept — users often add multiple canvases from the same designer
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
