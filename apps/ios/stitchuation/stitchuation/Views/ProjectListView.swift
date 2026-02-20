import SwiftUI
import SwiftData

struct ProjectListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(
        filter: ProjectListView.notDeletedPredicate,
        sort: \StitchProject.createdAt,
        order: .reverse
    )
    private var projects: [StitchProject]

    private static let notDeletedPredicate = #Predicate<StitchProject> {
        $0.deletedAt == nil
    }

    @State private var viewModel = ProjectListViewModel()
    @State private var showStartProject = false

    var filteredProjects: [StitchProject] {
        viewModel.filteredProjects(from: projects)
    }

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()
            if filteredProjects.isEmpty && viewModel.searchText.isEmpty {
                EmptyStateView(
                    icon: "paintbrush.pointed",
                    title: "No projects yet",
                    message: "Tap + to start a new project"
                )
            } else {
                List {
                    ForEach(viewModel.projectsByStatus(from: filteredProjects), id: \.0) { status, statusProjects in
                        Section {
                            ForEach(statusProjects, id: \.id) { project in
                                NavigationLink(value: project.id) {
                                    ProjectRowView(project: project)
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
        .searchable(text: $viewModel.searchText, prompt: "Search projects")
        .navigationTitle("Projects")
        .navigationDestination(for: UUID.self) { projectId in
            ProjectDetailView(projectId: projectId)
        }
        .toolbar {
            Button("Add", systemImage: "plus") {
                showStartProject = true
            }
            .tint(Color.terracotta)
        }
        .sheet(isPresented: $showStartProject) {
            StartProjectView()
        }
    }
}

struct ProjectRowView: View {
    let project: StitchProject

    var body: some View {
        HStack(spacing: Spacing.md) {
            CanvasThumbnail(imageKey: project.canvas.imageKey, size: .fixed(48))

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(project.canvas.designName)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)
                Text(project.canvas.designer)
                    .font(.typeStyle(.subheadline))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()

            ProjectStatusBadge(status: project.status)
        }
        .padding(.vertical, Spacing.sm)
    }
}
