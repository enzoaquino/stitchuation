import Foundation

enum APIError: Error, Equatable {
    case unauthorized
    case badRequest(String)
    case serverError(Int)
    case network(String)
    case decoding(String)

    static func == (lhs: APIError, rhs: APIError) -> Bool {
        switch (lhs, rhs) {
        case (.unauthorized, .unauthorized):
            return true
        case (.badRequest(let a), .badRequest(let b)):
            return a == b
        case (.serverError(let a), .serverError(let b)):
            return a == b
        case (.network(let a), .network(let b)):
            return a == b
        case (.decoding(let a), .decoding(let b)):
            return a == b
        default:
            return false
        }
    }
}
