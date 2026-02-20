import UIKit
import CryptoKit

actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskDirectory = caches.appendingPathComponent("images", isDirectory: true)
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        memoryCache.countLimit = 100
    }

    // MARK: - Public API

    /// Full lookup: memory → disk → network. Returns nil on failure.
    func image(for imageKey: String?, networkClient: NetworkClient?) async -> UIImage? {
        guard let imageKey, !imageKey.isEmpty else { return nil }

        // 1. Memory
        if let cached = cachedImage(forKey: imageKey) {
            return cached
        }

        // 2. Disk
        if let diskImage = loadFromDisk(forKey: imageKey) {
            store(diskImage, forKey: imageKey)
            return diskImage
        }

        // 3. Network
        guard let networkClient else { return nil }
        do {
            let data = try await networkClient.fetchData(path: "/images/\(imageKey)")
            guard let image = UIImage(data: data) else { return nil }
            store(image, forKey: imageKey)
            storeToDisk(data, forKey: imageKey)
            return image
        } catch {
            return nil
        }
    }

    // MARK: - Memory

    func cachedImage(forKey key: String) -> UIImage? {
        memoryCache.object(forKey: key as NSString)
    }

    func store(_ image: UIImage, forKey key: String) {
        memoryCache.setObject(image, forKey: key as NSString)
    }

    // MARK: - Disk

    func storeToDisk(_ data: Data, forKey key: String) {
        let path = diskPath(forKey: key)
        try? data.write(to: path)
    }

    func loadFromDisk(forKey key: String) -> UIImage? {
        let path = diskPath(forKey: key)
        guard let data = try? Data(contentsOf: path) else { return nil }
        return UIImage(data: data)
    }

    func evict(forKey key: String) {
        memoryCache.removeObject(forKey: key as NSString)
        let path = diskPath(forKey: key)
        try? FileManager.default.removeItem(at: path)
    }

    // MARK: - Helpers

    func diskFileName(forKey key: String) -> String {
        let hash = SHA256.hash(data: Data(key.utf8))
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func diskPath(forKey key: String) -> URL {
        diskDirectory.appendingPathComponent(diskFileName(forKey: key))
    }
}
