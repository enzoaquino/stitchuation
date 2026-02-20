import SwiftUI
import SwiftData

struct ProjectDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let pieceId: UUID

    @State private var piece: StitchPiece?
    @State private var showAddEntry = false
    @State private var showDeleteConfirmation = false
    @State private var showReturnToStashConfirmation = false
    @State private var showChangeStatus = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            if let piece {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Piece image
                        CanvasThumbnail(imageKey: piece.imageKey, size: .fill)
                            .frame(height: 250)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .padding(.horizontal, Spacing.lg)

                        // Status section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                Button {
                                    showChangeStatus = true
                                } label: {
                                    PieceStatusBadge(status: piece.status)
                                }
                                Spacer()
                                if let button = advanceStatusButton(for: piece) {
                                    Button(button.label) {
                                        advanceStatus()
                                    }
                                    .font(.typeStyle(.subheadline))
                                    .fontWeight(.medium)
                                    .foregroundStyle(Color.terracotta)
                                }
                            }
                        }
                        .padding(Spacing.md)
                        .background(Color.cream)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.subtle)
                        .padding(.horizontal, Spacing.lg)

                        // Info section
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            Text(piece.designer)
                                .font(.typeStyle(.title3))
                                .foregroundStyle(Color.walnut)

                            if let startedAt = piece.startedAt {
                                DetailRow(label: "Started", value: startedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let stitchedAt = piece.stitchedAt {
                                DetailRow(label: "Stitched", value: stitchedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let finishingAt = piece.finishingAt {
                                DetailRow(label: "Finishing", value: finishingAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let completedAt = piece.completedAt {
                                DetailRow(label: "Completed", value: completedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                        }
                        .padding(Spacing.lg)
                        .background(Color.cream)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.subtle)
                        .padding(.horizontal, Spacing.lg)

                        // Journal section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            Text("Journal")
                                .font(.typeStyle(.title2))
                                .foregroundStyle(Color.espresso)

                            if sortedEntries.isEmpty {
                                EmptyStateView(
                                    icon: "book",
                                    title: "No entries yet",
                                    message: "Tap + to add your first journal entry"
                                )
                            } else {
                                ForEach(sortedEntries, id: \.id) { entry in
                                    JournalEntryCard(entry: entry)
                                }
                            }
                        }
                        .padding(.horizontal, Spacing.lg)
                        .padding(.bottom, Spacing.xxxl)
                    }
                    .padding(.vertical, Spacing.lg)
                }
                .overlay(alignment: .bottomTrailing) {
                    Button {
                        showAddEntry = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 56, height: 56)
                            .background(Color.terracotta)
                            .clipShape(Circle())
                            .warmShadow(.floating)
                    }
                    .padding(Spacing.xl)
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
                    Button("Return to Stash", systemImage: "arrow.uturn.backward") {
                        showReturnToStashConfirmation = true
                    }
                    Button("Delete Project", systemImage: "trash", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
        .sheet(isPresented: $showAddEntry, onDismiss: { loadPiece() }) {
            if let piece {
                AddJournalEntryView(piece: piece)
            }
        }
        .sheet(isPresented: $showChangeStatus) {
            changeStatusSheet
        }
        .confirmationDialog("Return to Stash", isPresented: $showReturnToStashConfirmation) {
            Button("Return to Stash", role: .destructive) {
                if let piece {
                    piece.status = .stash
                    piece.startedAt = nil
                    piece.stitchedAt = nil
                    piece.finishingAt = nil
                    piece.completedAt = nil
                    piece.updatedAt = Date()
                }
            }
        } message: {
            Text("This will move the piece back to your stash. Journal entries will be preserved.")
        }
        .confirmationDialog("Delete Project", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let piece {
                    let now = Date()
                    piece.deletedAt = now
                    piece.updatedAt = now

                    // Soft-delete child entries and their images
                    for entry in piece.entries where entry.deletedAt == nil {
                        entry.deletedAt = now
                        entry.updatedAt = now
                        for image in entry.images where image.deletedAt == nil {
                            image.deletedAt = now
                            image.updatedAt = now

                            // Clean up pending uploads for this journal image
                            let imageId = image.id
                            let imageUploadDescriptor = FetchDescriptor<PendingUpload>(
                                predicate: #Predicate { $0.entityType == "journalImage" && $0.entityId == imageId }
                            )
                            if let uploads = try? modelContext.fetch(imageUploadDescriptor) {
                                for upload in uploads { modelContext.delete(upload) }
                            }
                        }
                    }

                    // Clean up pending uploads for piece image
                    let currentPieceId = piece.id
                    let pieceUploadDescriptor = FetchDescriptor<PendingUpload>(
                        predicate: #Predicate { $0.entityType == "piece" && $0.entityId == currentPieceId }
                    )
                    if let uploads = try? modelContext.fetch(pieceUploadDescriptor) {
                        for upload in uploads { modelContext.delete(upload) }
                    }

                    dismiss()
                }
            }
        } message: {
            Text("Are you sure you want to delete this project?")
        }
        .task {
            loadPiece()
        }
    }

    @ViewBuilder
    private var changeStatusSheet: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()
                List {
                    ForEach(PieceStatus.allCases, id: \.self) { status in
                        Button {
                            if let piece {
                                applyStatus(status, to: piece)
                            }
                            showChangeStatus = false
                        } label: {
                            HStack {
                                PieceStatusBadge(status: status)
                                Spacer()
                                if piece?.status == status {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(Color.terracotta)
                                }
                            }
                        }
                        .listRowBackground(Color.cream)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Change Status")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { showChangeStatus = false }
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private var sortedEntries: [JournalEntry] {
        guard let piece else { return [] }
        return piece.entries
            .filter { $0.deletedAt == nil }
            .sorted { $0.createdAt > $1.createdAt }
    }

    private func loadPiece() {
        let id = pieceId
        let descriptor = FetchDescriptor<StitchPiece>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        piece = try? modelContext.fetch(descriptor).first
    }

    private struct StatusButton {
        let label: String
    }

    private func advanceStatusButton(for piece: StitchPiece) -> StatusButton? {
        switch piece.status {
        case .stash:
            return nil
        case .kitting:
            return StatusButton(label: "Start Stitching")
        case .wip:
            return StatusButton(label: "Mark Stitched")
        case .stitched:
            return StatusButton(label: "Send to Finishing")
        case .atFinishing:
            return StatusButton(label: "Mark Finished")
        case .finished:
            return nil
        }
    }

    private func advanceStatus() {
        guard let piece, let next = piece.status.next else { return }
        applyStatus(next, to: piece)
    }

    private func applyStatus(_ status: PieceStatus, to piece: StitchPiece) {
        let now = Date()
        piece.status = status

        // Set lifecycle timestamps based on target status
        let allCases = PieceStatus.allCases
        let targetIndex = allCases.firstIndex(of: status)!
        let kittingIndex = allCases.firstIndex(of: .kitting)!
        let stitchedIndex = allCases.firstIndex(of: .stitched)!
        let atFinishingIndex = allCases.firstIndex(of: .atFinishing)!
        let finishedIndex = allCases.firstIndex(of: .finished)!

        piece.startedAt = targetIndex >= kittingIndex ? (piece.startedAt ?? now) : nil
        piece.stitchedAt = targetIndex >= stitchedIndex ? (piece.stitchedAt ?? now) : nil
        piece.finishingAt = targetIndex >= atFinishingIndex ? (piece.finishingAt ?? now) : nil
        piece.completedAt = targetIndex >= finishedIndex ? (piece.completedAt ?? now) : nil

        piece.updatedAt = now
    }
}

struct JournalEntryCard: View {
    let entry: JournalEntry

    @State private var selectedImageIndex = 0
    @State private var showImageViewer = false

    private var sortedImages: [JournalImage] {
        entry.images
            .filter { $0.deletedAt == nil && !$0.imageKey.isEmpty }
            .sorted { $0.sortOrder < $1.sortOrder }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                .font(.typeStyle(.footnote))
                .foregroundStyle(Color.clay)

            if let notes = entry.notes, !notes.isEmpty {
                Text(notes)
                    .font(.typeStyle(.body))
                    .foregroundStyle(Color.espresso)
            }

            if !sortedImages.isEmpty {
                if entry.notes != nil && !entry.notes!.isEmpty {
                    Divider().background(Color.slate.opacity(0.2))
                }
                JournalImageGrid(images: sortedImages) { index in
                    selectedImageIndex = index
                    showImageViewer = true
                }
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
        .fullScreenCover(isPresented: $showImageViewer) {
            ImageViewerView(images: sortedImages, initialIndex: selectedImageIndex)
        }
    }
}
