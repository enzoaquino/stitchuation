import SwiftUI

struct EditCanvasView: View {
    @Environment(\.dismiss) private var dismiss

    @Bindable var canvas: StashCanvas

    @State private var designer: String
    @State private var designName: String
    @State private var acquiredAt: Date?
    @State private var showDatePicker: Bool
    @State private var size: String
    @State private var meshCount: String
    @State private var notes: String

    init(canvas: StashCanvas) {
        self.canvas = canvas
        _designer = State(initialValue: canvas.designer)
        _designName = State(initialValue: canvas.designName)
        _acquiredAt = State(initialValue: canvas.acquiredAt)
        _showDatePicker = State(initialValue: canvas.acquiredAt != nil)
        _size = State(initialValue: canvas.size ?? "")
        _meshCount = State(initialValue: canvas.meshCount.map { String($0) } ?? "")
        _notes = State(initialValue: canvas.notes ?? "")
    }

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
                    TextField("Designer", text: $designer)
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

                    TextField("Size (e.g. 13x18)", text: $size)

                    HStack {
                        TextField("Mesh Count", text: $meshCount)
                            .keyboardType(.numberPad)
                        if !meshCount.isEmpty {
                            Text("mesh")
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.clay)
                        }
                    }
                    if !isMeshCountValid {
                        Text("Enter a positive number")
                            .font(.typeStyle(.footnote))
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
            }
            .font(.typeStyle(.body))
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle("Edit Canvas")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveChanges() }
                        .disabled(designer.isEmpty || designName.isEmpty || !isMeshCountValid)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func saveChanges() {
        canvas.designer = designer
        canvas.designName = designName
        canvas.acquiredAt = showDatePicker ? acquiredAt : nil
        canvas.size = size.isEmpty ? nil : size
        canvas.meshCount = meshCountValue
        canvas.notes = notes.isEmpty ? nil : notes
        canvas.updatedAt = Date()
        dismiss()
    }
}
