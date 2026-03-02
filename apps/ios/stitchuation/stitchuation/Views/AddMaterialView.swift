import SwiftUI
import SwiftData

struct AddMaterialView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    var editing: PieceMaterial? = nil

    @State private var materialType: MaterialType = .thread
    @State private var brand = ""
    @State private var name = ""
    @State private var code = ""
    @State private var quantity = 1
    @State private var unit = ""
    @State private var notes = ""

    private var isEditing: Bool { editing != nil }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Type", selection: $materialType) {
                        ForEach(MaterialType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                    .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Type")
                }
                .listRowBackground(Color.parchment)

                Section {
                    TextField("Brand (e.g. Splendor, DMC)", text: $brand)
                        .font(.typeStyle(.body))
                    ValidatedTextField("Name (e.g. Dark Green)", text: $name)
                    TextField("Code (e.g. S832, #424)", text: $code)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Details")
                }
                .listRowBackground(Color.parchment)

                Section {
                    Stepper("Quantity: \(quantity)", value: $quantity, in: 1...99)
                        .font(.typeStyle(.body))
                    TextField("Unit (e.g. Card, Spool, Tube)", text: $unit)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Quantity")
                }
                .listRowBackground(Color.parchment)

                Section {
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.typeStyle(.body))
                } header: {
                    sectionHeader("Notes")
                }
                .listRowBackground(Color.parchment)

                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            deleteMaterial()
                        } label: {
                            HStack {
                                Spacer()
                                Text("Delete Material")
                                    .font(.typeStyle(.body))
                                    .fontWeight(.medium)
                                Spacer()
                            }
                        }
                        .listRowBackground(Color.parchment)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle(isEditing ? "Edit Material" : "Add Material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!canSave)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .onAppear {
                if let editing {
                    materialType = editing.materialType
                    brand = editing.brand ?? ""
                    name = editing.name
                    code = editing.code ?? ""
                    quantity = editing.quantity
                    unit = editing.unit ?? ""
                    notes = editing.notes ?? ""
                }
            }
        }
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.playfair(15, weight: .semibold))
            .foregroundStyle(Color.walnut)
            .textCase(nil)
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        let trimmedBrand = brand.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUnit = unit.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)

        if let editing {
            editing.materialType = materialType
            editing.brand = trimmedBrand.isEmpty ? nil : trimmedBrand
            editing.name = trimmedName
            editing.code = trimmedCode.isEmpty ? nil : trimmedCode
            editing.quantity = quantity
            editing.unit = trimmedUnit.isEmpty ? nil : trimmedUnit
            editing.notes = trimmedNotes.isEmpty ? nil : trimmedNotes
            editing.updatedAt = Date()
        } else {
            let nextSortOrder = piece.materials
                .filter { $0.deletedAt == nil }
                .map(\.sortOrder)
                .max()
                .map { $0 + 1 } ?? 0

            let material = PieceMaterial(
                piece: piece,
                materialType: materialType,
                brand: trimmedBrand.isEmpty ? nil : trimmedBrand,
                name: trimmedName,
                code: trimmedCode.isEmpty ? nil : trimmedCode,
                quantity: quantity,
                unit: trimmedUnit.isEmpty ? nil : trimmedUnit,
                notes: trimmedNotes.isEmpty ? nil : trimmedNotes,
                sortOrder: nextSortOrder
            )
            modelContext.insert(material)
        }

        dismiss()
    }

    private func deleteMaterial() {
        guard let editing else { return }
        let now = Date()
        editing.deletedAt = now
        editing.updatedAt = now
        dismiss()
    }
}
