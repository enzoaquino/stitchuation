import Foundation

actor NetworkClient {
    private static let accessTokenKey = "accessToken"
    private static let refreshTokenKey = "refreshToken"

    private let baseURL: URL
    private var accessToken: String?
    private var refreshToken: String?
    private var isRefreshing = false

    init(baseURL: URL) {
        self.baseURL = baseURL
        // Restore tokens from Keychain
        self.accessToken = KeychainHelper.load(key: Self.accessTokenKey)
        self.refreshToken = KeychainHelper.load(key: Self.refreshTokenKey)
    }

    func setTokens(access: String, refresh: String) {
        self.accessToken = access
        self.refreshToken = refresh
        KeychainHelper.save(key: Self.accessTokenKey, value: access)
        KeychainHelper.save(key: Self.refreshTokenKey, value: refresh)
    }

    func clearTokens() {
        self.accessToken = nil
        self.refreshToken = nil
        KeychainHelper.delete(key: Self.accessTokenKey)
        KeychainHelper.delete(key: Self.refreshTokenKey)
    }

    var isAuthenticated: Bool {
        accessToken != nil
    }

    func request<T: Decodable>(
        method: String,
        path: String,
        body: (any Encodable)? = nil
    ) async throws -> T {
        do {
            return try await performRequest(method: method, path: path, body: body)
        } catch APIError.unauthorized {
            // Attempt token refresh, then retry once
            guard try await attemptTokenRefresh() else {
                throw APIError.unauthorized
            }
            return try await performRequest(method: method, path: path, body: body)
        }
    }

    private func performRequest<T: Decodable>(
        method: String,
        path: String,
        body: (any Encodable)?
    ) async throws -> T {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            urlRequest.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch {
            throw APIError.network(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError(0)
        }

        switch httpResponse.statusCode {
        case 200...299:
            do {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error.localizedDescription)
            }
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }

    private struct RefreshRequest: Encodable {
        let refreshToken: String
    }

    private struct RefreshResponse: Decodable {
        let accessToken: String
        let refreshToken: String
    }

    func fetchData(path: String) async throws -> Data {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = "GET"

        if let token = accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch {
            throw APIError.network(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError(0)
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }

    /// Uploads image data as multipart/form-data.
    /// Always sends as image/jpeg since the client compresses to JPEG via `compressImage`.
    func uploadImage(path: String, imageData: Data, filename: String) async throws -> Data {
        let boundary = UUID().uuidString
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        urlRequest.httpBody = body

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch {
            throw APIError.network(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError(0)
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.badRequest(String(data: data, encoding: .utf8) ?? "")
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }

    private func attemptTokenRefresh() async throws -> Bool {
        guard !isRefreshing, let refresh = refreshToken else {
            clearTokens()
            return false
        }

        isRefreshing = true
        defer { isRefreshing = false }

        do {
            var urlRequest = URLRequest(url: baseURL.appendingPathComponent("/auth/refresh"))
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder().encode(RefreshRequest(refreshToken: refresh))

            let (data, response) = try await URLSession.shared.data(for: urlRequest)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                clearTokens()
                return false
            }

            let refreshResponse = try JSONDecoder().decode(RefreshResponse.self, from: data)
            setTokens(access: refreshResponse.accessToken, refresh: refreshResponse.refreshToken)
            return true
        } catch {
            clearTokens()
            return false
        }
    }
}
