import Testing
import Foundation
@testable import stitchuation

struct APIErrorTests {
    @Test func equalityWorks() {
        #expect(APIError.unauthorized == APIError.unauthorized)
        #expect(APIError.badRequest("test") == APIError.badRequest("test"))
        #expect(APIError.badRequest("a") != APIError.badRequest("b"))
        #expect(APIError.serverError(500) == APIError.serverError(500))
        #expect(APIError.serverError(500) != APIError.serverError(404))
        #expect(APIError.network("timeout") == APIError.network("timeout"))
        #expect(APIError.decoding("bad json") == APIError.decoding("bad json"))
    }

    @Test func differentCasesAreNotEqual() {
        #expect(APIError.unauthorized != APIError.serverError(401))
        #expect(APIError.badRequest("msg") != APIError.network("msg"))
    }

    @Test func conformsToError() {
        let error: Error = APIError.unauthorized
        #expect(error is APIError)
    }
}
