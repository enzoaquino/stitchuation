import Testing
import UIKit
@testable import stitchuation

@Suite("ImageCache Tests")
struct ImageCacheTests {
    @Test("stores and retrieves image from memory")
    func memoryCache() async {
        let cache = ImageCache()
        let image = UIImage(systemName: "star")!
        await cache.store(image, forKey: "test-key")
        let retrieved = await cache.cachedImage(forKey: "test-key")
        #expect(retrieved != nil)
    }

    @Test("stores and retrieves image from disk")
    func diskCache() async {
        let cache = ImageCache()
        let image = UIImage(systemName: "star")!
        let data = image.jpegData(compressionQuality: 0.8)!
        await cache.storeToDisk(data, forKey: "disk-test-key")
        let retrieved = await cache.loadFromDisk(forKey: "disk-test-key")
        #expect(retrieved != nil)
    }

    @Test("evicts image from both memory and disk")
    func eviction() async {
        let cache = ImageCache()
        let image = UIImage(systemName: "star")!
        let data = image.jpegData(compressionQuality: 0.8)!
        await cache.store(image, forKey: "evict-key")
        await cache.storeToDisk(data, forKey: "evict-key")
        await cache.evict(forKey: "evict-key")
        let memoryResult = await cache.cachedImage(forKey: "evict-key")
        let diskResult = await cache.loadFromDisk(forKey: "evict-key")
        #expect(memoryResult == nil)
        #expect(diskResult == nil)
    }

    @Test("SHA256 hash is deterministic for same key")
    func hashDeterminism() async {
        let cache = ImageCache()
        let hash1 = await cache.diskFileName(forKey: "same-key")
        let hash2 = await cache.diskFileName(forKey: "same-key")
        #expect(hash1 == hash2)
    }
}
