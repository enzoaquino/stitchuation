import Foundation
import Observation
import AuthenticationServices

struct AuthResponse: Decodable {
    let user: AuthUser
    let accessToken: String
    let refreshToken: String
}

struct AuthUser: Decodable {
    let id: String
    let email: String
    let displayName: String?
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let displayName: String
}

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct ProviderAuthRequest: Encodable {
    let provider: String
    let identityToken: String
    let fullName: FullName?

    struct FullName: Encodable {
        let givenName: String?
        let familyName: String?
    }
}

struct ProviderAuthResponse: Decodable {
    let user: AuthUser
    let accessToken: String
    let refreshToken: String
    let isNewUser: Bool
}

@MainActor
@Observable
final class AuthViewModel {
    var email = ""
    var password = ""
    var displayName = ""
    var isRegistering = false
    var isLoading = false
    var isAuthenticated = false
    var errorMessage: String?
    var needsDisplayName = false

    private let networkClient: NetworkClient

    init(networkClient: NetworkClient) {
        self.networkClient = networkClient
    }

    func checkExistingSession() async {
        isAuthenticated = await networkClient.isAuthenticated
    }

    func login() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AuthResponse = try await networkClient.request(
                method: "POST",
                path: "/auth/login",
                body: LoginRequest(email: email, password: password)
            )
            await networkClient.setTokens(access: response.accessToken, refresh: response.refreshToken)
            isAuthenticated = true
        } catch let error as APIError {
            switch error {
            case .unauthorized, .badRequest:
                errorMessage = "Invalid email or password"
            default:
                errorMessage = "Something went wrong. Please try again."
            }
        } catch {
            errorMessage = "Network error. Please check your connection."
        }
    }

    func register() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: AuthResponse = try await networkClient.request(
                method: "POST",
                path: "/auth/register",
                body: RegisterRequest(email: email, password: password, displayName: displayName)
            )
            await networkClient.setTokens(access: response.accessToken, refresh: response.refreshToken)
            isAuthenticated = true
        } catch let error as APIError {
            switch error {
            case .badRequest(let message) where message.contains("duplicate") || message.contains("already"):
                errorMessage = "Email already registered"
            case .badRequest:
                errorMessage = "Please check your input and try again"
            default:
                errorMessage = "Something went wrong. Please try again."
            }
        } catch {
            errorMessage = "Network error. Please check your connection."
        }
    }

    func handleAppleSignIn(result: Result<ASAuthorization, any Error>) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        guard case .success(let authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            errorMessage = "Apple sign-in failed. Please try again."
            return
        }

        let fullName: ProviderAuthRequest.FullName?
        if let name = credential.fullName,
           (name.givenName != nil || name.familyName != nil) {
            fullName = ProviderAuthRequest.FullName(
                givenName: name.givenName,
                familyName: name.familyName
            )
        } else {
            fullName = nil
        }

        do {
            let response: ProviderAuthResponse = try await networkClient.request(
                method: "POST",
                path: "/auth/provider",
                body: ProviderAuthRequest(
                    provider: "apple",
                    identityToken: identityToken,
                    fullName: fullName
                )
            )
            await networkClient.setTokens(access: response.accessToken, refresh: response.refreshToken)

            if response.isNewUser && response.user.displayName == nil {
                needsDisplayName = true
            }

            isAuthenticated = true
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                errorMessage = "Apple sign-in verification failed"
            default:
                errorMessage = "Something went wrong. Please try again."
            }
        } catch {
            errorMessage = "Network error. Please check your connection."
        }
    }

    func updateDisplayName() async {
        guard !displayName.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let _: AuthUser = try await networkClient.request(
                method: "PATCH",
                path: "/users/me",
                body: ["displayName": displayName]
            )
            needsDisplayName = false
        } catch {
            errorMessage = "Could not save name. Please try again."
        }
    }

    func logout() async {
        await networkClient.clearTokens()
        isAuthenticated = false
        email = ""
        password = ""
        displayName = ""
    }
}
