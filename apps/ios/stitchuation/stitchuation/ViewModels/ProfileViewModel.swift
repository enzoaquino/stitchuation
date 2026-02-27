import Foundation
import Observation

struct UserProfile: Codable {
    let id: String
    let email: String
    let displayName: String
    let bio: String?
    let experienceLevel: String?
}

struct UpdateProfileRequest: Encodable {
    var displayName: String?
    var bio: String?
    var experienceLevel: String?
}

@MainActor
@Observable
final class ProfileViewModel {
    var displayName = ""
    var bio = ""
    var experienceLevel = "Beginner"
    var isLoading = false
    var errorMessage: String?

    private let networkClient: NetworkClient

    init(networkClient: NetworkClient) {
        self.networkClient = networkClient
    }

    func loadProfile() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let profile: UserProfile = try await networkClient.request(
                method: "GET",
                path: "/users/me"
            )
            displayName = profile.displayName
            bio = profile.bio ?? ""
            experienceLevel = profile.experienceLevel ?? "Beginner"
        } catch {
            // Silently fail — view shows whatever is in memory
        }
    }

    func saveProfile(displayName: String, bio: String, experienceLevel: String) async {
        do {
            let request = UpdateProfileRequest(
                displayName: displayName,
                bio: bio.isEmpty ? nil : bio,
                experienceLevel: experienceLevel
            )
            let profile: UserProfile = try await networkClient.request(
                method: "PATCH",
                path: "/users/me",
                body: request
            )
            self.displayName = profile.displayName
            self.bio = profile.bio ?? ""
            self.experienceLevel = profile.experienceLevel ?? "Beginner"
        } catch {
            errorMessage = "Failed to save profile. Please try again."
        }
    }
}
