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
                    VStack(spacing: Spacing.lg) {
                        Image(systemName: "square.stack.3d.up.slash")
                            .font(.system(size: 48))
                            .foregroundStyle(Color.clay)
                        Text("No available canvases")
                            .font(.playfair(22, weight: .semibold))
                            .foregroundStyle(Color.espresso)
                        Text("All canvases are already linked to projects. Add a new canvas first.")
                            .font(.sourceSerif(17))
                            .foregroundStyle(Color.walnut)
                            .multilineTextAlignment(.center)
                    }
                    .padding(Spacing.xxxl)
                } else {
                    List {
                        ForEach(availableCanvases, id: \.id) { canvas in
                            Button {
                                startProject(with: canvas)
                            } label: {
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
