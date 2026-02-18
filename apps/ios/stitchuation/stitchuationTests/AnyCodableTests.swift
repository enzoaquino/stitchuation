import Testing
import Foundation
@testable import stitchuation

struct AnyCodableTests {
    @Test func encodesAndDecodesString() throws {
        let original = AnyCodable("hello")
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        #expect(decoded.value as? String == "hello")
    }

    @Test func encodesAndDecodesInt() throws {
        let original = AnyCodable(42)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        #expect(decoded.value as? Int == 42)
    }

    @Test func encodesAndDecodesDouble() throws {
        let original = AnyCodable(3.14)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        #expect(decoded.value as? Double == 3.14)
    }

    @Test func encodesAndDecodesBool() throws {
        let original = AnyCodable(true)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        #expect(decoded.value as? Bool == true)
    }

    @Test func encodesAndDecodesNull() throws {
        let original = AnyCodable(NSNull())
        let data = try JSONEncoder().encode(original)
        let json = String(data: data, encoding: .utf8)
        #expect(json == "null")
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        #expect(decoded.value is NSNull)
    }

    @Test func encodesAndDecodesArray() throws {
        let original = AnyCodable([AnyCodable(1), AnyCodable("two")])
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        let array = decoded.value as? [AnyCodable]
        #expect(array?.count == 2)
        #expect(array?[0].value as? Int == 1)
        #expect(array?[1].value as? String == "two")
    }

    @Test func encodesAndDecodesDictionary() throws {
        let original = AnyCodable(["key": AnyCodable("value")])
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        let dict = decoded.value as? [String: AnyCodable]
        #expect(dict?["key"]?.value as? String == "value")
    }

    @Test func unknownTypeEncodesAsNull() throws {
        let original = AnyCodable(Date())
        let data = try JSONEncoder().encode(original)
        let json = String(data: data, encoding: .utf8)
        #expect(json == "null")
    }
}
