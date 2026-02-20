import SwiftUI

struct EditCanvasView: View {
    @Environment(\.dismiss) private var dismiss

    @Bindable var piece: StitchPiece

    @State private var designer: String
    @State private var designName: String
    @State private var acquiredAt: Date?
    @State private var showDatePicker: Bool
    @State private var size: String
    @State private var meshCount: String
    @State private var notes: String

    init(piece: StitchPiece) {
        self.piece = piece
        _designer = State(initialValue: piece.designer)
        _designName = State(initialValue: piece.designName)
        _acquiredAt = State(initialValue: piece.acquiredAt)
        _showDatePicker = State(initialValue: piece.acquiredAt != nil)
        _size = State(initialValue: piece.size ?? "")
        _meshCount = State(initialValue: piece.meshCount.map { String($0) } ?? "")
        _notes = State(initialValue: piece.notes ?? "")
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
                .listRowBackground(Color.parchment)

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

                    MeshCountPicker(meshCount: $meshCount)
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
                .listRowBackground(Color.parchment)
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
        piece.designer = designer
        piece.designName = designName
        piece.acquiredAt = showDatePicker ? acquiredAt : nil
        piece.size = size.isEmpty ? nil : size
        piece.meshCount = meshCountValue
        piece.notes = notes.isEmpty ? nil : notes
        piece.updatedAt = Date()
        dismiss()
    }
}
