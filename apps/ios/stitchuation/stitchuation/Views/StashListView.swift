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
        guard !viewModel.searchText.isEmpty else { return canvases }
        let search = viewModel.searchText.lowercased()
        return canvases.filter { canvas in
            canvas.designer.lowercased().contains(search)
                || canvas.designName.lowercased().contains(search)
        }
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredCanvases.isEmpty && viewModel.searchText.isEmpty {
                VStack(spacing: Spacing.lg) {
                    Image(systemName: "square.stack.3d.up")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.clay)
                    Text("No canvases yet")
                        .font(.playfair(22, weight: .semibold))
                        .foregroundStyle(Color.espresso)
                    Text("Tap + to add your first canvas")
                        .font(.sourceSerif(17))
                        .foregroundStyle(Color.walnut)
                }
                .padding(Spacing.xxxl)
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
        for index in offsets {
            let canvas = filteredCanvases[index]
            canvas.deletedAt = Date()
            canvas.updatedAt = Date()
        }
    }
}

struct CanvasRowView: View {
    let canvas: StashCanvas

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: canvas.imageKey, size: 48)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(canvas.designName)
                    .font(.sourceSerif(17, weight: .semibold))
                    .foregroundStyle(Color.espresso)
                Text(canvas.designer)
                    .font(.sourceSerif(15))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()

            if let meshCount = canvas.meshCount {
                Text("\(meshCount)m")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(Color.clay)
            }
        }
        .padding(.vertical, Spacing.sm)
    }
}
