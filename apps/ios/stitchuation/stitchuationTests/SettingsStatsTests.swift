import Testing
@testable import stitchuation

struct SettingsStatsTests {

    // MARK: - Initials

    @Test func initialsFromTwoWords() {
        let result = SettingsView.computeInitials(from: "Jane Doe")
        #expect(result == "JD")
    }

    @Test func initialsFromOneWord() {
        let result = SettingsView.computeInitials(from: "Jane")
        #expect(result == "JA")
    }

    @Test func initialsFromEmpty() {
        let result = SettingsView.computeInitials(from: "")
        #expect(result == "?")
    }

    @Test func initialsFromThreeWords() {
        let result = SettingsView.computeInitials(from: "Mary Jane Watson")
        #expect(result == "MJ")
    }

    @Test func initialsLowercaseNormalized() {
        let result = SettingsView.computeInitials(from: "jane doe")
        #expect(result == "JD")
    }

    // MARK: - Experience Levels

    @Test func experienceLevelsIncludeAllFour() {
        #expect(SettingsView.experienceLevels == ["Beginner", "Intermediate", "Advanced", "Expert"])
    }
}
