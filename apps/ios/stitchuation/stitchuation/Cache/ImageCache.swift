import UIKit
import CryptoKit
import SwiftData

actor ImageCache {
    static let shared = ImageCache()

    private let memoryCache = NSCache<NSString, UIImage>()
    private let diskDirectory: URL
    private var modelContainer: ModelContainer?

    init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskDirectory = caches.appendingPathComponent("images", isDirectory: true)
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        memoryCache.countLimit = 100
    }

    // MARK: - Configuration

    /// Configures the cache with a SwiftData model container for pending upload lookups.
    func configure(modelContainer: ModelContainer) {
        self.modelContainer = modelContainer
    }

    // MARK: - URL Detection

    /// Returns true if the imageKey is a full URL (Azure SAS URL) rather than a relative path.
    static func isDirectURL(_ imageKey: String?) -> Bool {
        guard let imageKey else { return false }
        return imageKey.hasPrefix("http://") || imageKey.hasPrefix("https://")
    }

    // MARK: - Pending Key Detection

    /// Returns true if the imageKey uses the `pending:{uuid}` scheme for locally-stored images.
    static func isPendingKey(_ imageKey: String?) -> Bool {
        guard let imageKey, !imageKey.isEmpty else { return false }
        return imageKey.hasPrefix("pending:")
    }

    /// Extracts the entity UUID from a `pending:{uuid}` key, or returns nil if invalid.
    static func pendingEntityId(_ imageKey: String?) -> UUID? {
        guard let imageKey, isPendingKey(imageKey) else { return nil }
        let uuidString = String(imageKey.dropFirst("pending:".count))
        return UUID(uuidString: uuidString)
    }

    // MARK: - Public API

    /// Full lookup: memory → disk → network. Returns nil on failure.
    /// For `pending:{uuid}` keys, resolves from PendingUpload in SwiftData.
    func image(for imageKey: String?, networkClient: NetworkClient?) async -> UIImage? {
        guard let imageKey, !imageKey.isEmpty else { return nil }

        // 0. Pending key — resolve from memory cache or SwiftData PendingUpload
        if Self.isPendingKey(imageKey) {
            if let cached = cachedImage(forKey: imageKey) {
                return cached
            }
            guard let entityId = Self.pendingEntityId(imageKey),
                  let container = modelContainer else { return nil }
            let context = ModelContext(container)
            let predicate = #Predicate<PendingUpload> { $0.entityId == entityId }
            var descriptor = FetchDescriptor<PendingUpload>(predicate: predicate)
            descriptor.fetchLimit = 1
            if let pending = try? context.fetch(descriptor).first,
               let image = UIImage(data: pending.imageData) {
                store(image, forKey: imageKey)
                return image
            }
            return nil
        }

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
        let data: Data?
        if Self.isDirectURL(imageKey) {
            // Azure SAS URL — fetch directly, no auth needed
            data = try? await fetchDirectURL(imageKey)
        } else {
            // Relative path — fetch via API proxy (backward compat)
            guard let networkClient else { return nil }
            data = try? await networkClient.fetchData(path: "/images/\(imageKey)")
        }

        guard let data, let image = UIImage(data: data) else { return nil }
        store(image, forKey: imageKey)
        storeToDisk(data, forKey: imageKey)
        return image
    }

    // MARK: - Direct URL Fetching

    private func fetchDirectURL(_ urlString: String) async throws -> Data {
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        return data
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
