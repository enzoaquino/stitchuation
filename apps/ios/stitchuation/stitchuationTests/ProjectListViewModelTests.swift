import Testing
@testable import stitchuation

@MainActor
struct ProjectListViewModelTests {
    let viewModel = ProjectListViewModel()

    private func makeProject(designer: String, designName: String, status: ProjectStatus = .wip) -> StitchProject {
        let canvas = StashCanvas(designer: designer, designName: designName)
        return StitchProject(canvas: canvas, status: status)
    }

    @Test func filteredProjectsReturnsAllWhenSearchEmpty() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 2)
    }

    @Test func filteredProjectsByDesigner() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "alice"
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 1)
        #expect(result[0].canvas.designer == "Alice")
    }

    @Test func filteredProjectsByDesignName() {
        let projects = [
            makeProject(designer: "Alice", designName: "Flowers"),
            makeProject(designer: "Bob", designName: "Trees"),
        ]
        viewModel.searchText = "tree"
        let result = viewModel.filteredProjects(from: projects)
        #expect(result.count == 1)
    }

    @Test func projectsByStatusGroupsCorrectly() {
        let projects = [
            makeProject(designer: "A", designName: "D1", status: .wip),
            makeProject(designer: "B", designName: "D2", status: .completed),
            makeProject(designer: "C", designName: "D3", status: .wip),
            makeProject(designer: "D", designName: "D4", status: .atFinishing),
        ]
        let grouped = viewModel.projectsByStatus(from: projects)
        #expect(grouped.count == 3)
        #expect(grouped[0].0 == .wip)
        #expect(grouped[0].1.count == 2)
        #expect(grouped[1].0 == .atFinishing)
        #expect(grouped[1].1.count == 1)
        #expect(grouped[2].0 == .completed)
        #expect(grouped[2].1.count == 1)
    }

    @Test func projectsByStatusOmitsEmptyGroups() {
        let projects = [
            makeProject(designer: "A", designName: "D1", status: .wip),
        ]
        let grouped = viewModel.projectsByStatus(from: projects)
        #expect(grouped.count == 1)
        #expect(grouped[0].0 == .wip)
    }

    @Test func deleteProjectSoftDeletes() {
        let project = makeProject(designer: "A", designName: "D1")
        #expect(project.deletedAt == nil)
        viewModel.deleteProject(project)
        #expect(project.deletedAt != nil)
        #expect(project.updatedAt == project.deletedAt)
    }
}
