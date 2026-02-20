import SwiftUI
import SwiftData

struct ThreadListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: ThreadListView.notDeletedPredicate,
        sort: \NeedleThread.brand
    )
    private var threads: [NeedleThread]

    private static let notDeletedPredicate = #Predicate<NeedleThread> {
        $0.deletedAt == nil
    }

    @State private var viewModel = ThreadListViewModel()
    @State private var showAddThread = false

    var filteredThreads: [NeedleThread] {
        threads.filter { thread in
            if !viewModel.searchText.isEmpty {
                let search = viewModel.searchText.lowercased()
                let matches = thread.brand.lowercased().contains(search)
                    || thread.number.lowercased().contains(search)
                    || (thread.colorName?.lowercased().contains(search) ?? false)
                if !matches { return false }
            }
            if let brand = viewModel.selectedBrandFilter, thread.brand != brand {
                return false
            }
            if let fiber = viewModel.selectedFiberFilter, thread.fiberType != fiber {
                return false
            }
            return true
        }
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredThreads.isEmpty && viewModel.searchText.isEmpty {
                EmptyStateView(
                    icon: "tray",
                    title: "No threads yet",
                    message: "Tap + to add your first thread"
                )
            } else {
                List {
                    ForEach(filteredThreads, id: \.id) { thread in
                        ThreadRowView(thread: thread)
                            .listRowBackground(Color.cream)
                    }
                    .onDelete { offsets in
                        deleteThreads(at: offsets)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .searchable(text: $viewModel.searchText, prompt: "Search threads")
        .navigationTitle("Inventory")
        .toolbar {
            Button("Add", systemImage: "plus") {
                showAddThread = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showAddThread) {
            AddThreadView()
        }
    }

    private func deleteThreads(at offsets: IndexSet) {
        for index in offsets {
            let thread = filteredThreads[index]
            thread.deletedAt = Date()
            thread.updatedAt = Date()
        }
    }
}

struct ThreadRowView: View {
    @Environment(\.modelContext) private var modelContext
    let thread: NeedleThread

    var body: some View {
        HStack(spacing: Spacing.md) {
            ThreadSwatch(colorHex: thread.colorHex)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text("\(thread.brand) \(thread.number)")
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)
                if let name = thread.colorName {
                    Text("\(name) · \(thread.fiberType.rawValue.capitalized)")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.walnut)
                }
            }
            Spacer()
            HStack(spacing: Spacing.sm) {
                Button { updateQuantity(-1) } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.terracotta)
                        .frame(width: 28, height: 28)
                        .background(Color.terracottaMuted.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(thread.quantity <= 0)

                Text("\(thread.quantity)")
                    .font(.typeStyle(.data))
                    .foregroundStyle(Color.espresso)
                    .frame(minWidth: 24)

                Button { updateQuantity(1) } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.terracotta)
                        .frame(width: 28, height: 28)
                        .background(Color.terracottaMuted.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    private func updateQuantity(_ delta: Int) {
        withAnimation(.spring(duration: 0.2)) {
            thread.quantity = max(0, thread.quantity + delta)
            thread.updatedAt = Date()
            try? modelContext.save()
        }
    }
}
