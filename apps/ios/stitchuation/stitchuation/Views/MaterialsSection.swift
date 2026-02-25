import SwiftUI

struct MaterialsSection: View {
    let piece: StitchPiece
    let onAddMaterial: () -> Void
    let onScanGuide: () -> Void
    let onEditMaterial: (PieceMaterial) -> Void

    private var activeMaterials: [PieceMaterial] {
        piece.materials
            .filter { $0.deletedAt == nil }
            .sorted { $0.sortOrder < $1.sortOrder }
    }

    private var acquiredCount: Int {
        activeMaterials.filter(\.acquired).count
    }

    private var progress: Double {
        guard !activeMaterials.isEmpty else { return 0 }
        return Double(acquiredCount) / Double(activeMaterials.count)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header with progress
            HStack {
                Text("Materials")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)

                Spacer()

                if !activeMaterials.isEmpty {
                    Text("\(acquiredCount)/\(activeMaterials.count) \u{2713}")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
            }

            // Progress bar
            if !activeMaterials.isEmpty {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.parchment)
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .fill(Color.sage)
                            .frame(width: geo.size.width * progress, height: 6)
                            .animation(.easeInOut(duration: 0.3), value: progress)
                    }
                }
                .frame(height: 6)

                Text("\(Int(progress * 100))%")
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.clay)
            }

            // Material list or empty state
            if activeMaterials.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: "No materials yet",
                    message: "Add supplies manually or scan your stitch guide"
                )
            } else {
                List {
                    ForEach(activeMaterials, id: \.id) { material in
                        MaterialRowView(material: material)
                            .onTapGesture { onEditMaterial(material) }
                            .listRowSeparatorTint(Color.parchment)
                            .listRowBackground(Color.clear)
                    }
                    .onDelete { indexSet in
                        let now = Date()
                        for index in indexSet {
                            activeMaterials[index].deletedAt = now
                            activeMaterials[index].updatedAt = now
                        }
                    }
                }
                .listStyle(.plain)
                .scrollDisabled(true)
                .frame(minHeight: CGFloat(activeMaterials.count) * 44)
            }

            // Action buttons
            HStack(spacing: Spacing.md) {
                Button {
                    onAddMaterial()
                } label: {
                    Label("Add Material", systemImage: "plus")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }

                Button {
                    onScanGuide()
                } label: {
                    Label("Scan Guide", systemImage: "camera.viewfinder")
                        .font(.typeStyle(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.terracotta)
                }
            }
            .padding(.top, Spacing.sm)
        }
        .padding(.horizontal, Spacing.lg)
    }
}
