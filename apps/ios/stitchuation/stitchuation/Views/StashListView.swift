import SwiftUI
import SwiftData

struct StashListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: StashListView.notDeletedPredicate,
        sort: \StitchPiece.createdAt,
        order: .reverse
    )
    private var pieces: [StitchPiece]

    private static let notDeletedPredicate = #Predicate<StitchPiece> {
        $0.deletedAt == nil
    }

    @State private var viewModel = StashListViewModel()
    @State private var showAddCanvas = false

    var filteredPieces: [StitchPiece] {
        viewModel.filteredPieces(from: pieces)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredPieces.isEmpty && viewModel.searchText.isEmpty {
                EmptyStateView(
                    icon: "square.stack.3d.up",
                    title: "No canvases yet",
                    message: "Tap + to add your first canvas"
                )
            } else {
                List {
                    ForEach(filteredPieces, id: \.id) { piece in
                        NavigationLink(value: piece.id) {
                            CanvasRowView(piece: piece)
                        }
                        .listRowBackground(Color.cream)
                    }
                    .onDelete { offsets in
                        deletePieces(at: offsets)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search canvases")
        .navigationTitle("Stitch Stash")
        .navigationDestination(for: UUID.self) { pieceId in
            CanvasDetailView(pieceId: pieceId)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add", systemImage: "plus") {
                    showAddCanvas = true
                }
                .tint(Color.terracotta)
            }
            ToolbarItem(placement: .topBarLeading) {
                Toggle(viewModel.showAllPieces ? "All" : "Stash", isOn: $viewModel.showAllPieces)
                    .toggleStyle(.button)
                    .font(.typeStyle(.subheadline))
                    .tint(Color.terracotta)
            }
        }
        .sheet(isPresented: $showAddCanvas) {
            AddCanvasView()
        }
    }

    private func deletePieces(at offsets: IndexSet) {
        viewModel.deletePieces(from: filteredPieces, at: offsets)
    }
}

struct CanvasRowView: View {
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

            if piece.status != .stash {
                PieceStatusBadge(status: piece.status)
            }

            if let meshCount = piece.meshCount {
                Text("\(meshCount)m")
                    .font(.typeStyle(.data))
                    .foregroundStyle(Color.clay)
            }
        }
        .padding(.vertical, Spacing.sm)
    }
}
