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
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Canvas Info card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Canvas Info")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            ValidatedTextField("Designer", text: $designer)

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

                            TextField("Size (e.g. 13x18)", text: $size)
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
                    .padding(.bottom, Spacing.xxl)
                }
                .padding(.vertical, Spacing.lg)
            }
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
