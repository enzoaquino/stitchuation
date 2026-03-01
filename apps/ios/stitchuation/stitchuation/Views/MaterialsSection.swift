import SwiftUI

struct MaterialsSection: View {
    let piece: StitchPiece
    let onAddMaterial: () -> Void
    let onScanGuide: () -> Void
    let onEditMaterial: (PieceMaterial) -> Void

    @State private var isExpanded = false

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

    /// Always expanded during kitting; collapsible otherwise.
    private var isKitting: Bool {
        piece.status == .kitting
    }

    private var showContent: Bool {
        isKitting || isExpanded
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            // Header with progress
            headerRow

            // Progress bar
            if !activeMaterials.isEmpty {
                progressBar
            }

            // Collapsible content
            if showContent {
                materialsContent
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(Spacing.lg)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
        .padding(.horizontal, Spacing.lg)
        .onAppear {
            if isKitting { isExpanded = true }
        }
        .onChange(of: piece.status) { oldStatus, newStatus in
            if oldStatus == .kitting && newStatus != .kitting {
                withAnimation(Motion.gentle) {
                    isExpanded = false
                }
            }
        }
    }

    // MARK: - Header

    private var headerRow: some View {
        Button {
            guard !isKitting else { return }
            withAnimation(Motion.gentle) {
                isExpanded.toggle()
            }
        } label: {
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

                if !isKitting {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.clay)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                        .animation(Motion.gentle, value: isExpanded)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Progress Bar

    private var progressBar: some View {
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

    // MARK: - Materials Content

    private var materialsContent: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
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
    }
}
