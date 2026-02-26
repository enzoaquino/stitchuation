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

            // Progress bar (no percentage text)
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
            }

            // Material rows or empty state
            if activeMaterials.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: "No materials yet",
                    message: "Add supplies manually or scan your stitch guide"
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(activeMaterials.enumerated()), id: \.element.id) { index, material in
                        MaterialRowView(material: material)
                            .onTapGesture { onEditMaterial(material) }

                        if index < activeMaterials.count - 1 {
                            Divider()
                                .background(Color.parchment)
                        }
                    }
                }
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
        .padding(Spacing.lg)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
        .padding(.horizontal, Spacing.lg)
    }
}
