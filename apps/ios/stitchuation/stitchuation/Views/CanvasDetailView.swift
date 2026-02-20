import SwiftUI
import SwiftData

struct CanvasDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let pieceId: UUID

    @State private var piece: StitchPiece?
    @State private var showEditSheet = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            if let piece {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        CanvasThumbnail(imageKey: piece.imageKey, size: .fill)
                            .frame(height: 260)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .padding(.horizontal, Spacing.lg)

                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                Text(piece.designName)
                                    .font(.typeStyle(.title))
                                    .foregroundStyle(Color.espresso)

                                Spacer()

                                if piece.status != .stash {
                                    PieceStatusBadge(status: piece.status)
                                }
                            }

                            Text(piece.designer)
                                .font(.typeStyle(.title3))
                                .foregroundStyle(Color.walnut)

                            if piece.acquiredAt != nil || piece.size != nil || piece.meshCount != nil {
                                Divider().background(Color.slate.opacity(0.3))

                                VStack(alignment: .leading, spacing: Spacing.sm) {
                                    if let acquiredAt = piece.acquiredAt {
                                        DetailRow(label: "Acquired", value: acquiredAt.formatted(date: .abbreviated, time: .omitted))
                                    }
                                    if let size = piece.size {
                                        DetailRow(label: "Size", value: size)
                                    }
                                    if let meshCount = piece.meshCount {
                                        DetailRow(label: "Mesh", value: "\(meshCount) count")
                                    }
                                }
                            }

                            if let notes = piece.notes, !notes.isEmpty {
                                Divider().background(Color.slate.opacity(0.3))

                                Text(notes)
                                    .font(.typeStyle(.body))
                                    .foregroundStyle(Color.walnut)
                            }

                            if piece.status == .stash {
                                Divider().background(Color.slate.opacity(0.3))

                                Button {
                                    piece.status = .kitting
                                    piece.startedAt = Date()
                                    piece.updatedAt = Date()
                                } label: {
                                    Text("Start Project")
                                        .font(.typeStyle(.headline))
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, Spacing.md)
                                        .background(Color.terracotta)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                                }
                            }
                        }
                        .padding(Spacing.lg)
                        .background(Color.cream)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.subtle)
                        .padding(.horizontal, Spacing.lg)
                    }
                    .padding(.vertical, Spacing.lg)
                }
            } else {
                ProgressView()
                    .tint(Color.terracotta)
            }
        }
        .navigationTitle(piece?.designName ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if piece != nil {
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
        .sheet(isPresented: $showEditSheet, onDismiss: { loadPiece() }) {
            if let piece {
                EditCanvasView(piece: piece)
            }
        }
        .confirmationDialog("Delete Piece", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let piece {
                    let now = Date()
                    piece.deletedAt = now
                    piece.updatedAt = now

                    // Clean up pending uploads for this piece
                    let currentPieceId = piece.id
                    let uploadDescriptor = FetchDescriptor<PendingUpload>(
                        predicate: #Predicate { $0.entityType == "piece" && $0.entityId == currentPieceId }
                    )
                    if let uploads = try? modelContext.fetch(uploadDescriptor) {
                        for upload in uploads { modelContext.delete(upload) }
                    }

                    dismiss()
                }
            }
        } message: {
            Text("Are you sure you want to delete this piece?")
        }
        .task {
            loadPiece()
        }
    }

    private func loadPiece() {
        let id = pieceId
        let descriptor = FetchDescriptor<StitchPiece>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        piece = try? modelContext.fetch(descriptor).first
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.typeStyle(.subheadline))
                .foregroundStyle(Color.clay)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.typeStyle(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(Color.espresso)
        }
    }
}
