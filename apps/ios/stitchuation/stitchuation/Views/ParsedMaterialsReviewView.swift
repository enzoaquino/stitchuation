import SwiftUI
import SwiftData

struct ParsedMaterialsReviewView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let piece: StitchPiece
    @State var materials: [ParsedMaterial]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()

                if materials.isEmpty {
                    EmptyStateView(
                        icon: "list.clipboard",
                        title: "No materials",
                        message: "All items were removed"
                    )
                } else {
                    List {
                        ForEach(materials.indices, id: \.self) { index in
                            VStack(alignment: .leading, spacing: Spacing.xs) {
                                HStack {
                                    Text(materials[index].materialType.displayName)
                                        .font(.typeStyle(.footnote))
                                        .foregroundStyle(Color.clay)
                                        .padding(.horizontal, Spacing.sm)
                                        .padding(.vertical, Spacing.xxs)
                                        .background(Color.parchment)
                                        .clipShape(Capsule())

                                    Spacer()

                                    if materials[index].quantity > 0 {
                                        Text(materials[index].unit.map { "\(materials[index].quantity) \($0)" } ?? "\(materials[index].quantity)")
                                            .font(.typeStyle(.data))
                                            .foregroundStyle(Color.walnut)
                                    }
                                }

                                if let brand = materials[index].brand {
                                    Text(brand)
                                        .font(.typeStyle(.subheadline))
                                        .foregroundStyle(Color.walnut)
                                }

                                HStack {
                                    Text(materials[index].name)
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(Color.espresso)

                                    if let code = materials[index].code {
                                        Text("(\(code))")
                                            .font(.typeStyle(.subheadline))
                                            .foregroundStyle(Color.clay)
                                    }
                                }
                            }
                            .padding(.vertical, Spacing.xs)
                            .listRowBackground(Color.cream)
                        }
                        .onDelete { indexSet in
                            materials.remove(atOffsets: indexSet)
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("\(materials.count) Materials Found")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Discard") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save All") { saveAll() }
                        .disabled(materials.isEmpty)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func saveAll() {
        let existingMaxSort = piece.materials
            .filter { $0.deletedAt == nil }
            .map(\.sortOrder)
            .max() ?? -1

        for (index, parsed) in materials.enumerated() {
            let material = PieceMaterial(
                piece: piece,
                materialType: parsed.materialType,
                brand: parsed.brand,
                name: parsed.name,
                code: parsed.code,
                quantity: parsed.quantity,
                unit: parsed.unit,
                sortOrder: existingMaxSort + 1 + index
            )
            modelContext.insert(material)
        }

        dismiss()
    }
}
