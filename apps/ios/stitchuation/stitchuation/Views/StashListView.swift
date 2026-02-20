import SwiftUI
import SwiftData

struct StashListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: StashListView.notDeletedPredicate,
        sort: \StashCanvas.createdAt,
        order: .reverse
    )
    private var canvases: [StashCanvas]

    private static let notDeletedPredicate = #Predicate<StashCanvas> {
        $0.deletedAt == nil
    }

    @State private var viewModel = StashListViewModel()
    @State private var showAddCanvas = false

    var filteredCanvases: [StashCanvas] {
        viewModel.filteredCanvases(from: canvases)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredCanvases.isEmpty && viewModel.searchText.isEmpty {
                EmptyStateView(
                    icon: "square.stack.3d.up",
                    title: "No canvases yet",
                    message: "Tap + to add your first canvas"
                )
            } else {
                List {
                    ForEach(filteredCanvases, id: \.id) { canvas in
                        NavigationLink(value: canvas.id) {
                            CanvasRowView(canvas: canvas)
                        }
                        .listRowBackground(Color.cream)
                    }
                    .onDelete { offsets in
                        deleteCanvases(at: offsets)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search canvases")
        .navigationTitle("Stitch Stash")
        .navigationDestination(for: UUID.self) { canvasId in
            CanvasDetailView(canvasId: canvasId)
        }
        .toolbar {
            Button("Add", systemImage: "plus") {
                showAddCanvas = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showAddCanvas) {
            AddCanvasView()
        }
    }

    private func deleteCanvases(at offsets: IndexSet) {
        viewModel.deleteCanvases(from: filteredCanvases, at: offsets)
    }
}

struct CanvasRowView: View {
    let canvas: StashCanvas

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: canvas.imageKey, size: .fixed(48))

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(canvas.designName)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)
                Text(canvas.designer)
                    .font(.typeStyle(.subheadline))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()

            if let project = canvas.project, project.deletedAt == nil {
                ProjectStatusBadge(status: project.status)
            }

            if let meshCount = canvas.meshCount {
                Text("\(meshCount)m")
                    .font(.typeStyle(.data))
                    .foregroundStyle(Color.clay)
            }
        }
        .padding(.vertical, Spacing.sm)
    }
}
