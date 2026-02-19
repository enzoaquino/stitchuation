import SwiftUI
import SwiftData

struct CanvasDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let canvasId: UUID

    @State private var canvas: StashCanvas?
    @State private var showEditSheet = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            if let canvas {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        CanvasThumbnail(imageKey: canvas.imageKey, size: .infinity)
                            .frame(height: 260)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .padding(.horizontal, Spacing.lg)

                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text(canvas.designName)
                                .font(.playfair(28, weight: .bold))
                                .foregroundStyle(Color.espresso)

                            Text(canvas.designer)
                                .font(.sourceSerif(19))
                                .foregroundStyle(Color.walnut)

                            if canvas.acquiredAt != nil || canvas.size != nil || canvas.meshCount != nil {
                                Divider().background(Color.slate.opacity(0.3))

                                VStack(alignment: .leading, spacing: Spacing.sm) {
                                    if let acquiredAt = canvas.acquiredAt {
                                        DetailRow(label: "Acquired", value: acquiredAt.formatted(date: .abbreviated, time: .omitted))
                                    }
                                    if let size = canvas.size {
                                        DetailRow(label: "Size", value: size)
                                    }
                                    if let meshCount = canvas.meshCount {
                                        DetailRow(label: "Mesh", value: "\(meshCount) count")
                                    }
                                }
                            }

                            if let notes = canvas.notes, !notes.isEmpty {
                                Divider().background(Color.slate.opacity(0.3))

                                Text(notes)
                                    .font(.sourceSerif(17))
                                    .foregroundStyle(Color.walnut)
                            }
                        }
                        .padding(.horizontal, Spacing.lg)
                    }
                    .padding(.vertical, Spacing.lg)
                }
            } else {
                ProgressView()
                    .tint(Color.terracotta)
            }
        }
        .navigationTitle(canvas?.designName ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canvas != nil {
                Menu {
                    Button("Edit", systemImage: "pencil") {
                        showEditSheet = true
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let canvas {
                EditCanvasView(canvas: canvas)
            }
        }
        .confirmationDialog("Delete Canvas", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let canvas {
                    canvas.deletedAt = Date()
                    canvas.updatedAt = Date()
                    dismiss()
                }
            }
        } message: {
            Text("Are you sure you want to delete this canvas?")
        }
        .task {
            loadCanvas()
        }
    }

    private func loadCanvas() {
        let id = canvasId
        let descriptor = FetchDescriptor<StashCanvas>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        canvas = try? modelContext.fetch(descriptor).first
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.sourceSerif(15))
                .foregroundStyle(Color.clay)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.sourceSerif(15, weight: .medium))
                .foregroundStyle(Color.espresso)
        }
    }
}
