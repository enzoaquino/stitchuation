import SwiftUI
import SwiftData

struct ShoppingListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: ShoppingListView.notDeletedPredicate,
        sort: \StitchPiece.createdAt,
        order: .reverse
    )
    private var pieces: [StitchPiece]

    private static let notDeletedPredicate = #Predicate<StitchPiece> {
        $0.deletedAt == nil
    }

    @State private var viewModel = ShoppingListViewModel()

    private var items: [ShoppingItem] {
        viewModel.shoppingItems(from: pieces)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: 0) {
                Picker("Group By", selection: $viewModel.groupMode) {
                    ForEach(ShoppingGroupMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm)

                if items.isEmpty {
                    EmptyStateView(
                        icon: "cart",
                        title: "All shopped!",
                        message: "Nothing to buy right now"
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    switch viewModel.groupMode {
                    case .byProject:
                        projectGroupedList
                    case .byMaterial:
                        materialGroupedList
                    }
                }
            }
        }
        .navigationTitle("Shopping List")
    }

    // MARK: - By Project

    private var projectGroupedList: some View {
        let groups = viewModel.groupedByProject(from: items)
        return List {
            ForEach(groups) { group in
                Section {
                    ForEach(group.items) { item in
                        ShoppingItemRow(item: item)
                            .listRowBackground(Color.cream)
                    }
                } header: {
                    HStack {
                        VStack(alignment: .leading, spacing: Spacing.xxs) {
                            Text(group.piece.designName)
                                .font(.playfair(15, weight: .semibold))
                                .foregroundStyle(Color.walnut)
                            Text(group.piece.designer)
                                .font(.typeStyle(.footnote))
                                .foregroundStyle(Color.clay)
                        }
                        Spacer()
                        Text("\(group.items.count)")
                            .font(.typeStyle(.data))
                            .foregroundStyle(Color.clay)
                    }
                    .textCase(nil)
                }
            }
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - By Material (placeholder — implemented in Task 3)

    private var materialGroupedList: some View {
        EmptyView()
    }
}

// MARK: - Shopping Item Row

struct ShoppingItemRow: View {
    let item: ShoppingItem

    var body: some View {
        HStack(spacing: Spacing.md) {
            Button {
                withAnimation(Motion.gentle) {
                    item.material.acquired = true
                    item.material.updatedAt = Date()
                }
            } label: {
                Image(systemName: "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.slate)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(item.material.displayLine)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)

                HStack(spacing: Spacing.xs) {
                    if item.material.quantity > 0 {
                        Text("\(item.material.quantity)")
                            .font(.typeStyle(.data))
                            .foregroundStyle(Color.walnut)
                    }
                    if let unit = item.material.unit {
                        Text(unit)
                            .font(.typeStyle(.subheadline))
                            .foregroundStyle(Color.clay)
                    }
                    Text(item.material.materialType.displayName)
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.clay)
                }
            }

            Spacer()
        }
        .padding(.vertical, Spacing.sm)
        .contentShape(Rectangle())
    }
}
