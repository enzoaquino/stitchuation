import SwiftUI
import SwiftData

struct StartProjectView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(
        filter: StartProjectView.notDeletedPredicate,
        sort: \StashCanvas.createdAt,
        order: .reverse
    )
    private var allCanvases: [StashCanvas]

    private static let notDeletedPredicate = #Predicate<StashCanvas> {
        $0.deletedAt == nil
    }

    private var availableCanvases: [StashCanvas] {
        allCanvases.filter { $0.project == nil }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.linen.ignoresSafeArea()
                if availableCanvases.isEmpty {
                    EmptyStateView(
                        icon: "square.stack.3d.up.slash",
                        title: "No available canvases",
                        message: "All canvases are already linked to projects. Add a new canvas first."
                    )
                } else {
                    List {
                        ForEach(availableCanvases, id: \.id) { canvas in
                            Button {
                                startProject(with: canvas)
                            } label: {
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
                                }
                                .padding(.vertical, Spacing.sm)
                            }
                            .listRowBackground(Color.cream)
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
        }
    }

    private func startProject(with canvas: StashCanvas) {
        let project = StitchProject(canvas: canvas)
        modelContext.insert(project)
        dismiss()
    }
}
