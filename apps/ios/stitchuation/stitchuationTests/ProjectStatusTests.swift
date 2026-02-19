import Testing
import Foundation
@testable import stitchuation

struct ProjectStatusTests {
    @Test func allCasesCountIsThree() {
        #expect(ProjectStatus.allCases.count == 3)
    }

    @Test func rawValuesAreCorrect() {
        #expect(ProjectStatus.wip.rawValue == "wip")
        #expect(ProjectStatus.atFinishing.rawValue == "at_finishing")
        #expect(ProjectStatus.completed.rawValue == "completed")
    }

    @Test func displayNamesAreCorrect() {
        #expect(ProjectStatus.wip.displayName == "WIP")
        #expect(ProjectStatus.atFinishing.displayName == "At Finishing")
        #expect(ProjectStatus.completed.displayName == "Completed")
    }

    @Test func initFromRawValue() {
        #expect(ProjectStatus(rawValue: "wip") == .wip)
        #expect(ProjectStatus(rawValue: "at_finishing") == .atFinishing)
        #expect(ProjectStatus(rawValue: "completed") == .completed)
        #expect(ProjectStatus(rawValue: "invalid") == nil)
    }

    @Test func encodesAndDecodes() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        let data = try encoder.encode(ProjectStatus.atFinishing)
        let decoded = try decoder.decode(ProjectStatus.self, from: data)
        #expect(decoded == .atFinishing)
    }
}
