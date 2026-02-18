import Testing
import Foundation
@testable import stitchuation

struct FiberTypeTests {
    @Test func allCasesExist() {
        let cases = FiberType.allCases
        #expect(cases.count == 6)
        #expect(cases.contains(.wool))
        #expect(cases.contains(.cotton))
        #expect(cases.contains(.silk))
        #expect(cases.contains(.synthetic))
        #expect(cases.contains(.blend))
        #expect(cases.contains(.other))
    }

    @Test func rawValuesAreCorrect() {
        #expect(FiberType.wool.rawValue == "wool")
        #expect(FiberType.cotton.rawValue == "cotton")
        #expect(FiberType.silk.rawValue == "silk")
        #expect(FiberType.synthetic.rawValue == "synthetic")
        #expect(FiberType.blend.rawValue == "blend")
        #expect(FiberType.other.rawValue == "other")
    }

    @Test func initFromRawValue() {
        #expect(FiberType(rawValue: "wool") == .wool)
        #expect(FiberType(rawValue: "cotton") == .cotton)
        #expect(FiberType(rawValue: "invalid") == nil)
    }

    @Test func encodesAndDecodes() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        let data = try encoder.encode(FiberType.silk)
        let decoded = try decoder.decode(FiberType.self, from: data)
        #expect(decoded == .silk)
    }
}
