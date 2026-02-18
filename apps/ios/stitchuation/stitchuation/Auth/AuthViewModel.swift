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
    let displayName: String
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

    func logout() async {
        await networkClient.clearTokens()
        isAuthenticated = false
        email = ""
        password = ""
        displayName = ""
    }
}
