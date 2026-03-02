import SwiftUI
import SwiftData

struct ProjectListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: ProjectListView.notDeletedPredicate,
        sort: \StitchPiece.createdAt,
        order: .reverse
    )
    private var pieces: [StitchPiece]

    private static let notDeletedPredicate = #Predicate<StitchPiece> {
        $0.deletedAt == nil
    }

    @State private var viewModel = ProjectListViewModel()
    @State private var showStartProjectSheet = false

    var filteredPieces: [StitchPiece] {
        viewModel.filteredPieces(from: pieces)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: 0) {
                Picker("View", selection: $viewModel.showFinished) {
                    Text("Active").tag(false)
                    Text("Finished").tag(true)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm)

                if filteredPieces.isEmpty && viewModel.searchText.isEmpty {
                    EmptyStateView(
                        icon: "paintbrush.pointed",
                        title: viewModel.showFinished ? "No finished projects" : "No active projects",
                        message: viewModel.showFinished ? "Finished projects will appear here" : "Tap + to start a new project"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach(viewModel.piecesByStatus(from: filteredPieces), id: \.0) { status, statusPieces in
                            Section {
                                ForEach(statusPieces, id: \.id) { piece in
                                    NavigationLink(value: piece.id) {
                                        ProjectRowView(piece: piece)
                                    }
                                    .listRowBackground(Color.cream)
                                }
                            } header: {
                                Text(status.displayName)
                                    .font(.playfair(15, weight: .semibold))
                                    .foregroundStyle(Color.walnut)
                                    .textCase(nil)
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search projects")
        .navigationTitle("Projects")
        .navigationDestination(for: UUID.self) { pieceId in
            ProjectDetailView(pieceId: pieceId)
        }
        .toolbar {
            Button("Add", systemImage: "plus") {
                showStartProjectSheet = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showStartProjectSheet) {
            StartProjectSheet()
        }
    }
}

struct ProjectRowView: View {
    let piece: StitchPiece

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: piece.imageKey, size: .fixed(48))

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(piece.designName)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)
                Text(piece.designer)
                    .font(.typeStyle(.subheadline))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()

            PieceStatusBadge(status: piece.status)
        }
        .padding(.vertical, Spacing.sm)
    }
}

struct StartProjectSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(NavigationCoordinator.self) private var navigationCoordinator
    @Query(
        filter: StartProjectSheet.stashPredicate,
        sort: \StitchPiece.createdAt,
        order: .reverse
    )
    private var stashPieces: [StitchPiece]

    @State private var showAddCanvas = false

    private static let stashPredicate = #Predicate<StitchPiece> {
        $0.deletedAt == nil && $0.statusRaw == "stash"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()
                if stashPieces.isEmpty {
                    VStack(spacing: Spacing.xl) {
                        EmptyStateView(
                            icon: "square.stack.3d.up.slash",
                            title: "No canvases in your stash",
                            message: "Create a new canvas to get started"
                        )

                        Button {
                            showAddCanvas = true
                        } label: {
                            Label("Add New Canvas", systemImage: "plus")
                                .font(.typeStyle(.headline))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.md)
                                .background(Color.terracotta)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                                .warmShadow(.elevated)
                        }
                        .padding(.horizontal, Spacing.xxxl)
                    }
                } else {
                    List {
                        Section {
                            Button {
                                showAddCanvas = true
                            } label: {
                                HStack(spacing: Spacing.md) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 24))
                                        .foregroundStyle(Color.terracotta)

                                    Text("Add New Canvas")
                                        .font(.typeStyle(.headline))
                                        .foregroundStyle(Color.terracotta)

                                    Spacer()
                                }
                                .padding(.vertical, Spacing.sm)
                            }
                            .listRowBackground(Color.cream)
                        }

                        Section {
                            ForEach(stashPieces, id: \.id) { piece in
                                Button {
                                    startProject(piece)
                                } label: {
                                    HStack(spacing: Spacing.md) {
                                        CanvasThumbnail(imageKey: piece.imageKey, size: .fixed(48))

                                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                                            Text(piece.designName)
                                                .font(.typeStyle(.headline))
                                                .foregroundStyle(Color.espresso)
                                            Text(piece.designer)
                                                .font(.typeStyle(.subheadline))
                                                .foregroundStyle(Color.walnut)
                                        }

                                        Spacer()
                                    }
                                    .padding(.vertical, Spacing.sm)
                                }
                                .listRowBackground(Color.cream)
                            }
                        } header: {
                            Text("From Stash")
                                .font(.playfair(15, weight: .semibold))
                                .foregroundStyle(Color.walnut)
                                .textCase(nil)
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Start Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
            }
            .sheet(isPresented: $showAddCanvas) {
                AddCanvasView(onProjectStarted: { piece in
                    let pieceId = piece.id
                    dismiss()
                    navigationCoordinator.presentedProjectId = PieceIdentifier(id: pieceId)
                })
            }
        }
    }

    private func startProject(_ piece: StitchPiece) {
        piece.status = .kitting
        piece.startedAt = Date()
        piece.updatedAt = Date()
        let pieceId = piece.id
        dismiss()
        navigationCoordinator.presentedProjectId = PieceIdentifier(id: pieceId)
    }
}
