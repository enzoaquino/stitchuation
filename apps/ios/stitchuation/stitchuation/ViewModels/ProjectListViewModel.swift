import Foundation

@MainActor
@Observable
final class ProjectListViewModel {
    var searchText = ""

    func filteredProjects(from projects: [StitchProject]) -> [StitchProject] {
        guard !searchText.isEmpty else { return projects }
        let query = searchText.lowercased()
        return projects.filter { project in
            project.canvas.designName.lowercased().contains(query) ||
            project.canvas.designer.lowercased().contains(query)
        }
    }

    func projectsByStatus(from projects: [StitchProject]) -> [(ProjectStatus, [StitchProject])] {
        let grouped = Dictionary(grouping: projects) { $0.status }
        return ProjectStatus.allCases.compactMap { status in
            guard let items = grouped[status], !items.isEmpty else { return nil }
            return (status, items)
        }
    }

    func deleteProject(_ project: StitchProject) {
        let now = Date()
        project.deletedAt = now
        project.updatedAt = now
    }
}
