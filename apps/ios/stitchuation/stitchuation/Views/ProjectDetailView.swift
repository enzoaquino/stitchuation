import SwiftUI
import SwiftData

struct ProjectDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let projectId: UUID

    @State private var project: StitchProject?
    @State private var showAddEntry = false
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            if let project {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.xl) {
                        // Canvas image
                        CanvasThumbnail(imageKey: project.canvas.imageKey, size: .fill)
                            .frame(height: 250)
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .padding(.horizontal, Spacing.lg)

                        // Status section
                        VStack(alignment: .leading, spacing: Spacing.md) {
                            HStack {
                                ProjectStatusBadge(status: project.status)
                                Spacer()
                                if let button = advanceStatusButton(for: project) {
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
                            Text(project.canvas.designer)
                                .font(.typeStyle(.title3))
                                .foregroundStyle(Color.walnut)

                            if let startedAt = project.startedAt {
                                DetailRow(label: "Started", value: startedAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let finishingAt = project.finishingAt {
                                DetailRow(label: "Finishing", value: finishingAt.formatted(date: .abbreviated, time: .omitted))
                            }
                            if let completedAt = project.completedAt {
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
        .navigationTitle(project?.canvas.designName ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if project != nil {
                Menu {
                    Button("Delete Project", systemImage: "trash", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
        .sheet(isPresented: $showAddEntry, onDismiss: { loadProject() }) {
            if let project {
                AddJournalEntryView(project: project)
            }
        }
        .confirmationDialog("Delete Project", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let project {
                    let now = Date()
                    project.deletedAt = now
                    project.updatedAt = now

                    // Soft-delete child entries and their images
                    for entry in project.entries where entry.deletedAt == nil {
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

                    // Clean up pending uploads for canvas image
                    let canvasId = project.canvas.id
                    let canvasUploadDescriptor = FetchDescriptor<PendingUpload>(
                        predicate: #Predicate { $0.entityType == "canvas" && $0.entityId == canvasId }
                    )
                    if let uploads = try? modelContext.fetch(canvasUploadDescriptor) {
                        for upload in uploads { modelContext.delete(upload) }
                    }

                    dismiss()
                }
            }
        } message: {
            Text("Are you sure you want to delete this project?")
        }
        .task {
            loadProject()
        }
    }

    private var sortedEntries: [JournalEntry] {
        guard let project else { return [] }
        return project.entries
            .filter { $0.deletedAt == nil }
            .sorted { $0.createdAt > $1.createdAt }
    }

    private func loadProject() {
        let id = projectId
        let descriptor = FetchDescriptor<StitchProject>(
            predicate: #Predicate { $0.id == id && $0.deletedAt == nil }
        )
        project = try? modelContext.fetch(descriptor).first
    }

    private struct StatusButton {
        let label: String
    }

    private func advanceStatusButton(for project: StitchProject) -> StatusButton? {
        switch project.status {
        case .wip:
            return StatusButton(label: "Move to Finishing")
        case .atFinishing:
            return StatusButton(label: "Mark Complete")
        case .completed:
            return nil
        }
    }

    private func advanceStatus() {
        guard let project else { return }
        let now = Date()
        switch project.status {
        case .wip:
            project.status = .atFinishing
            project.finishingAt = now
        case .atFinishing:
            project.status = .completed
            project.completedAt = now
        case .completed:
            break
        }
        project.updatedAt = now
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
