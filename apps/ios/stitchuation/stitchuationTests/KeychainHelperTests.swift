import Testing
import Foundation
@testable import stitchuation

struct KeychainHelperTests {
    private let testKey = "test_key_\(UUID().uuidString)"

    @Test func saveAndLoad() {
        KeychainHelper.save(key: testKey, value: "secret")
        let loaded = KeychainHelper.load(key: testKey)
        #expect(loaded == "secret")
        KeychainHelper.delete(key: testKey)
    }

    @Test func loadReturnsNilForMissingKey() {
        let loaded = KeychainHelper.load(key: "nonexistent_\(UUID().uuidString)")
        #expect(loaded == nil)
    }

    @Test func deleteRemovesValue() {
        KeychainHelper.save(key: testKey, value: "to_delete")
        KeychainHelper.delete(key: testKey)
        let loaded = KeychainHelper.load(key: testKey)
        #expect(loaded == nil)
    }

    @Test func saveOverwritesExistingValue() {
        KeychainHelper.save(key: testKey, value: "first")
        KeychainHelper.save(key: testKey, value: "second")
        let loaded = KeychainHelper.load(key: testKey)
        #expect(loaded == "second")
        KeychainHelper.delete(key: testKey)
    }
}
