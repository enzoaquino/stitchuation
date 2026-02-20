# Image Caching & Sync Reliability Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix image persistence across app relaunches, add retry for failed uploads, and close sync reliability gaps so the offline-first promise actually holds for images.

**Architecture:** Layered image pipeline — file-based disk cache (NSCache + Caches directory), persistent upload queue (SwiftData PendingUpload model), server cache headers. See `docs/plans/2026-02-20-image-caching-sync-fix-design.md` for full design.

**Tech Stack:** Swift/SwiftUI/SwiftData (iOS), TypeScript/Hono/Drizzle (API), Vitest (API tests), Swift Testing (iOS tests)

**Key context:**
- iOS project uses File System Synchronization — new `.swift` files are auto-discovered by Xcode, no pbxproj edits needed.
- iOS tests use Swift Testing framework (`import Testing`, `@Test`, `#expect()`), NOT XCTest.
- Build/test commands: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO` and `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO`
- API tests: `cd apps/api && npx vitest run`
- SourceKit may show false positive errors on newly created files — if xcodebuild succeeds, trust it over SourceKit.

---

### Task 1: API — Add Cache-Control Headers to Image Routes

**Files:**
- Modify: `apps/api/src/storage/image-routes.ts:36-38`
- Test: `apps/api/tests/storage/image-routes.test.ts`

**Step 1: Write the failing test**

Add to `apps/api/tests/storage/image-routes.test.ts`, after the existing "GET /images/* serves an uploaded image" test:

```typescript
it("GET /images/* returns immutable cache-control headers", async () => {
  // Upload an image first
  const formData = new FormData();
  const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const blob = new Blob([imageData], { type: "image/jpeg" });
  formData.append("image", blob, "cache-test.jpg");

  const uploadRes = await app.request(`/canvases/${canvasId}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const uploadBody = await uploadRes.json();

  // Fetch and check headers
  const res = await app.request(`/images/${uploadBody.imageKey}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run tests/storage/image-routes.test.ts`
Expected: FAIL — `Cache-Control` header is null.

**Step 3: Write minimal implementation**

In `apps/api/src/storage/image-routes.ts`, change the response construction (line 36-38) from:

```typescript
return new Response(content, {
    headers: { "Content-Type": contentType },
});
```

to:

```typescript
return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
});
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run tests/storage/image-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/storage/image-routes.ts apps/api/tests/storage/image-routes.test.ts
git commit -m "feat(api): add immutable cache-control headers to image routes"
```

---

### Task 2: API — Image Cleanup on Soft-Delete in Sync Service

When a canvas or journal image is soft-deleted via sync, delete the associated image file on the server.

**Files:**
- Modify: `apps/api/src/sync/sync-service.ts:153-170` (processCanvasChange delete block) and `:328-357` (processJournalImageChange delete block)
- Modify: `apps/api/src/sync/sync-service.ts:1` (add import for storage)
- Test: `apps/api/tests/sync/sync-service.test.ts`

**Step 1: Write the failing tests**

Add to `apps/api/tests/sync/sync-service.test.ts`:

```typescript
import { getStorage } from "../../src/storage/index.js";
```

Then add these tests:

```typescript
it("deletes canvas image file on soft-delete via sync", async () => {
  const storage = getStorage();

  // Create canvas via sync
  const canvasId = crypto.randomUUID();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [{
      type: "canvas",
      action: "upsert",
      id: canvasId,
      data: {
        designer: "Delete Test",
        designName: "Delete Canvas",
        imageKey: `canvases/${userId}/${canvasId}.jpg`,
      },
      updatedAt: new Date().toISOString(),
    }],
  });

  // Upload a fake image file
  await storage.upload(Buffer.from([0xff, 0xd8]), `canvases/${userId}/${canvasId}.jpg`);

  // Verify file exists
  const fileBefore = await storage.getFilePath(`canvases/${userId}/${canvasId}.jpg`);
  expect(fileBefore).not.toBeNull();

  // Delete canvas via sync
  const deleteTime = new Date(Date.now() + 1000).toISOString();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [{
      type: "canvas",
      action: "delete",
      id: canvasId,
      updatedAt: deleteTime,
      deletedAt: deleteTime,
    }],
  });

  // Verify file is deleted
  const fileAfter = await storage.getFilePath(`canvases/${userId}/${canvasId}.jpg`);
  expect(fileAfter).toBeNull();
});

it("deletes journal image file on soft-delete via sync", async () => {
  const storage = getStorage();

  // Create canvas, project, entry, and image via sync
  const canvasId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  const now = new Date().toISOString();

  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "canvas",
        action: "upsert",
        id: canvasId,
        data: { designer: "JI Delete", designName: "JI Canvas" },
        updatedAt: now,
      },
      {
        type: "project",
        action: "upsert",
        id: projectId,
        data: { canvasId, status: "wip" },
        updatedAt: now,
      },
      {
        type: "journalEntry",
        action: "upsert",
        id: entryId,
        data: { projectId, notes: "test" },
        updatedAt: now,
      },
      {
        type: "journalImage",
        action: "upsert",
        id: imageId,
        data: { entryId, imageKey: `journals/${userId}/${entryId}/${imageId}.jpg`, sortOrder: 0 },
        updatedAt: now,
      },
    ],
  });

  // Upload a fake image file
  await storage.upload(Buffer.from([0xff, 0xd8]), `journals/${userId}/${entryId}/${imageId}.jpg`);
  const fileBefore = await storage.getFilePath(`journals/${userId}/${entryId}/${imageId}.jpg`);
  expect(fileBefore).not.toBeNull();

  // Delete journal image via sync
  const deleteTime = new Date(Date.now() + 1000).toISOString();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [{
      type: "journalImage",
      action: "delete",
      id: imageId,
      updatedAt: deleteTime,
      deletedAt: deleteTime,
    }],
  });

  // Verify file is deleted
  const fileAfter = await storage.getFilePath(`journals/${userId}/${entryId}/${imageId}.jpg`);
  expect(fileAfter).toBeNull();
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run tests/sync/sync-service.test.ts`
Expected: FAIL — image files are not deleted.

**Step 3: Write minimal implementation**

In `apps/api/src/sync/sync-service.ts`:

1. Add import at the top:
```typescript
import { getStorage } from "../storage/index.js";
```

2. In `processCanvasChange`, after the soft-delete update succeeds (after the `await tx.update(canvases)...` call in the delete block), add image cleanup:

```typescript
// Clean up image file
if (existing.imageKey) {
  try {
    const storage = getStorage();
    await storage.delete(existing.imageKey);
  } catch {
    // Best-effort cleanup — don't fail sync
  }
}
```

3. In `processJournalImageChange`, after the soft-delete update succeeds (after the `await tx.update(journalImages)...` call in the delete block), add image cleanup:

```typescript
// Clean up image file
if (existing.imageKey) {
  try {
    const storage = getStorage();
    await storage.delete(existing.imageKey);
  } catch {
    // Best-effort cleanup — don't fail sync
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run tests/sync/sync-service.test.ts`
Expected: PASS

**Step 5: Run all API tests**

Run: `cd apps/api && npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add apps/api/src/sync/sync-service.ts apps/api/tests/sync/sync-service.test.ts
git commit -m "feat(api): delete image files on soft-delete via sync"
```

---

### Task 3: iOS — ImageCache Actor (Disk + Memory)

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift`

**Step 1: Write the failing test**

Create `apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift`:

```swift
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
```

**Step 2: Run test to verify it fails**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: FAIL — `ImageCache` does not exist.

**Step 3: Write minimal implementation**

Create `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift`:

```swift
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
```

**Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift apps/ios/stitchuation/stitchuationTests/ImageCacheTests.swift
git commit -m "feat(ios): add ImageCache actor with memory and disk layers"
```

---

### Task 4: iOS — PendingUpload SwiftData Model

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift`
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift:22` (add PendingUpload to ModelContainer)
- Test: `apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift`

**Step 1: Write the failing test**

Create `apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("PendingUpload Tests")
struct PendingUploadTests {
    @Test("initializes with correct defaults")
    func defaults() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.entityType == "canvas")
        #expect(upload.retryCount == 0)
        #expect(upload.lastAttemptAt == nil)
        #expect(!upload.imageData.isEmpty)
    }

    @Test("supports journal image entity type")
    func journalImageType() {
        let entryId = UUID()
        let imageId = UUID()
        let upload = PendingUpload(
            entityType: "journalImage",
            entityId: imageId,
            uploadPath: "/projects/p1/entries/\(entryId.uuidString)/images",
            imageData: Data([0xFF, 0xD8])
        )
        #expect(upload.entityType == "journalImage")
        #expect(upload.entityId == imageId)
    }

    @Test("retryCount increments")
    func retryIncrement() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount += 1
        upload.lastAttemptAt = Date()
        #expect(upload.retryCount == 1)
        #expect(upload.lastAttemptAt != nil)
    }

    @Test("max retries threshold is 5")
    func maxRetries() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = 5
        #expect(upload.hasFailed)
    }
}
```

**Step 2: Run test to verify it fails**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: FAIL — `PendingUpload` does not exist.

**Step 3: Write minimal implementation**

Create `apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift`:

```swift
import Foundation
import SwiftData

@Model
final class PendingUpload {
    @Attribute(.unique) var id: UUID
    var entityType: String
    var entityId: UUID
    var uploadPath: String
    @Attribute(.externalStorage) var imageData: Data
    var createdAt: Date
    var retryCount: Int
    var lastAttemptAt: Date?

    static let maxRetries = 5

    var hasFailed: Bool {
        retryCount >= Self.maxRetries
    }

    init(
        id: UUID = UUID(),
        entityType: String,
        entityId: UUID,
        uploadPath: String,
        imageData: Data
    ) {
        self.id = id
        self.entityType = entityType
        self.entityId = entityId
        self.uploadPath = uploadPath
        self.imageData = imageData
        self.createdAt = Date()
        self.retryCount = 0
    }
}
```

**Step 4: Add PendingUpload to ModelContainer**

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, change line 22 from:

```swift
modelContainer = try ModelContainer(for: NeedleThread.self, StashCanvas.self, StitchProject.self, JournalEntry.self, JournalImage.self)
```

to:

```swift
modelContainer = try ModelContainer(for: NeedleThread.self, StashCanvas.self, StitchProject.self, JournalEntry.self, JournalImage.self, PendingUpload.self)
```

**Step 5: Run test to verify it passes**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): add PendingUpload SwiftData model for upload retry queue"
```

---

### Task 5: iOS — UploadQueue Processor

The upload queue processor fetches pending uploads oldest-first, attempts each one, updates retry count on failure, and deletes on success.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/UploadQueueTests.swift`

**Step 1: Write the failing test**

Create `apps/ios/stitchuation/stitchuationTests/UploadQueueTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("UploadQueue Tests")
struct UploadQueueTests {
    @Test("skips permanently failed uploads")
    func skipsFailedUploads() {
        let upload = PendingUpload(
            entityType: "canvas",
            entityId: UUID(),
            uploadPath: "/canvases/abc/image",
            imageData: Data([0xFF, 0xD8])
        )
        upload.retryCount = PendingUpload.maxRetries
        #expect(upload.hasFailed)
    }

    @Test("max retries is 5")
    func maxRetriesValue() {
        #expect(PendingUpload.maxRetries == 5)
    }
}
```

**Step 2: Run test to verify it fails**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: FAIL — `UploadQueue` does not exist (though these specific tests should pass since they test `PendingUpload` which exists from Task 4 — the real test is compilation of UploadQueue).

**Step 3: Write minimal implementation**

Create `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`:

```swift
import Foundation
import SwiftData

@MainActor
final class UploadQueue {
    private let modelContainer: ModelContainer
    private let networkClient: NetworkClient

    init(modelContainer: ModelContainer, networkClient: NetworkClient) {
        self.modelContainer = modelContainer
        self.networkClient = networkClient
    }

    /// Process all pending uploads oldest-first. Skips permanently failed ones.
    func processQueue() async {
        let context = modelContainer.mainContext
        let descriptor = FetchDescriptor<PendingUpload>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        guard let uploads = try? context.fetch(descriptor) else { return }

        for upload in uploads where !upload.hasFailed {
            await processUpload(upload, context: context)
        }
    }

    private func processUpload(_ upload: PendingUpload, context: ModelContext) async {
        do {
            let responseData = try await networkClient.uploadImage(
                path: upload.uploadPath,
                imageData: upload.imageData,
                filename: "\(upload.entityId.uuidString).jpg"
            )

            // Parse imageKey from response
            if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
               let imageKey = json["imageKey"] as? String {
                // Update the entity with the imageKey
                updateEntity(upload: upload, imageKey: imageKey, context: context)
                // Write to ImageCache
                await ImageCache.shared.store(
                    UIImage(data: upload.imageData) ?? UIImage(),
                    forKey: imageKey
                )
                await ImageCache.shared.storeToDisk(upload.imageData, forKey: imageKey)
            }

            // Success — delete the pending upload
            context.delete(upload)
            try? context.save()
        } catch {
            // Failure — increment retry count
            upload.retryCount += 1
            upload.lastAttemptAt = Date()
            try? context.save()
        }
    }

    private func updateEntity(upload: PendingUpload, imageKey: String, context: ModelContext) {
        if upload.entityType == "canvas" {
            let entityId = upload.entityId
            let descriptor = FetchDescriptor<StashCanvas>(
                predicate: #Predicate { $0.id == entityId }
            )
            if let canvas = try? context.fetch(descriptor).first {
                canvas.imageKey = imageKey
                canvas.updatedAt = Date()
            }
        } else if upload.entityType == "journalImage" {
            let entityId = upload.entityId
            let descriptor = FetchDescriptor<JournalImage>(
                predicate: #Predicate { $0.id == entityId }
            )
            if let journalImage = try? context.fetch(descriptor).first {
                journalImage.imageKey = imageKey
                journalImage.updatedAt = Date()
            }
        }
    }
}
```

**Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift apps/ios/stitchuation/stitchuationTests/UploadQueueTests.swift
git commit -m "feat(ios): add UploadQueue processor for pending image uploads"
```

---

### Task 6: iOS — Refactor CanvasThumbnail to Use ImageCache

Replace raw `networkClient.fetchData()` with `ImageCache.shared.image(for:networkClient:)`.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift`

**Step 1: Refactor implementation**

Replace the entire `loadImage()` method and remove `@State private var isLoading`:

Current `CanvasThumbnail.swift` lines 65-79:
```swift
private func loadImage() async {
    loadedImage = nil
    guard let imageKey, let networkClient else { return }
    isLoading = true
    defer { isLoading = false }

    do {
        let data = try await networkClient.fetchData(path: "/images/\(imageKey)")
        if let image = UIImage(data: data) {
            loadedImage = image
        }
    } catch {
        // Failed to load image — placeholder remains
    }
}
```

Replace with:
```swift
private func loadImage() async {
    loadedImage = nil
    guard let imageKey, !imageKey.isEmpty else { return }
    isLoading = true
    defer { isLoading = false }

    let image = await ImageCache.shared.image(for: imageKey, networkClient: networkClient)
    loadedImage = image
}
```

**Step 2: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Run tests to verify nothing breaks**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: TEST SUCCEEDED

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/CanvasThumbnail.swift
git commit -m "feat(ios): refactor CanvasThumbnail to use ImageCache"
```

---

### Task 7: iOS — Refactor ImageViewerView to Use ImageCache

Replace raw `networkClient.fetchData()` with `ImageCache.shared.image(for:networkClient:)`.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ImageViewerView.swift:74-85`

**Step 1: Refactor implementation**

Replace the `loadImage` method (lines 74-85):

```swift
private func loadImage(_ journalImage: JournalImage) async {
    guard loadedImages[journalImage.id] == nil,
          let networkClient else { return }
    do {
        let data = try await networkClient.fetchData(path: "/images/\(journalImage.imageKey)")
        if let image = UIImage(data: data) {
            loadedImages[journalImage.id] = image
        }
    } catch {
        // Failed to load — stays as spinner
    }
}
```

With:
```swift
private func loadImage(_ journalImage: JournalImage) async {
    guard loadedImages[journalImage.id] == nil else { return }
    let image = await ImageCache.shared.image(for: journalImage.imageKey, networkClient: networkClient)
    if let image {
        loadedImages[journalImage.id] = image
    }
}
```

**Step 2: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ImageViewerView.swift
git commit -m "feat(ios): refactor ImageViewerView to use ImageCache"
```

---

### Task 8: iOS — Refactor AddCanvasView Upload Flow with PendingUpload

Replace the fire-and-forget upload with PendingUpload persistence. On photo selection, compress immediately and write a PendingUpload to SwiftData before attempting upload.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift:145-189`

**Step 1: Refactor the saveCanvas() method**

Replace the current `saveCanvas()` (lines 145-204) with:

```swift
private func saveCanvas() {
    let canvas = StashCanvas(
        designer: designer,
        designName: designName,
        acquiredAt: showDatePicker ? acquiredAt : nil,
        size: size.isEmpty ? nil : size,
        meshCount: meshCountValue,
        notes: notes.isEmpty ? nil : notes
    )
    modelContext.insert(canvas)

    if let imageData = selectedImageData {
        let compressed = compressImage(imageData, maxBytes: 10 * 1024 * 1024)
        let uploadPath = "/canvases/\(canvas.id.uuidString)/image"

        // Persist PendingUpload before attempting network
        let pendingUpload = PendingUpload(
            entityType: "canvas",
            entityId: canvas.id,
            uploadPath: uploadPath,
            imageData: compressed
        )
        modelContext.insert(pendingUpload)

        if let networkClient {
            let canvasId = canvas.id
            let canvasDesigner = canvas.designer
            let canvasDesignName = canvas.designName
            Task {
                do {
                    // Ensure canvas exists on server
                    let body: [String: Any] = [
                        "id": canvasId.uuidString,
                        "designer": canvasDesigner,
                        "designName": canvasDesignName,
                    ]
                    let jsonData = try JSONSerialization.data(withJSONObject: body)
                    _ = try await networkClient.postJSON(path: "/canvases", body: jsonData)

                    let responseData = try await networkClient.uploadImage(
                        path: uploadPath,
                        imageData: compressed,
                        filename: "\(canvasId.uuidString).jpg"
                    )
                    if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                       let imageKey = json["imageKey"] as? String {
                        await MainActor.run {
                            canvas.imageKey = imageKey
                            canvas.updatedAt = Date()
                            // Upload succeeded — delete PendingUpload
                            modelContext.delete(pendingUpload)
                        }
                        // Cache the image immediately
                        await ImageCache.shared.store(
                            UIImage(data: compressed) ?? UIImage(),
                            forKey: imageKey
                        )
                        await ImageCache.shared.storeToDisk(compressed, forKey: imageKey)
                    }
                } catch {
                    // Network failed — PendingUpload persists for retry
                }
            }
        }
    }

    if addAnother {
        designName = ""
        acquiredAt = nil
        showDatePicker = false
        size = ""
        meshCount = ""
        notes = ""
        selectedPhoto = nil
        selectedImageData = nil
    } else {
        dismiss()
    }
}
```

**Step 2: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): refactor AddCanvasView to use PendingUpload queue"
```

---

### Task 9: iOS — Refactor AddJournalEntryView Upload Flow with PendingUpload

Replace the fire-and-forget journal image upload with PendingUpload persistence. Stop creating JournalImage records with empty imageKey — PendingUpload holds the image data until upload succeeds.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift:117-175`

**Step 1: Refactor the saveEntry() method**

Replace the current `saveEntry()` (lines 117-178) with:

```swift
private func saveEntry() {
    let entryNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
    let entry = JournalEntry(
        project: project,
        notes: entryNotes.isEmpty ? nil : entryNotes
    )
    modelContext.insert(entry)

    // Create PendingUploads for each selected image — no JournalImage records yet
    var pendingUploads: [PendingUpload] = []
    for (index, selectedImage) in selectedImages.enumerated() {
        let imageId = UUID()
        let compressed = compressImage(selectedImage.data, maxBytes: 10 * 1024 * 1024)
        let uploadPath = "/projects/\(project.id.uuidString)/entries/\(entry.id.uuidString)/images"

        let pendingUpload = PendingUpload(
            entityType: "journalImage",
            entityId: imageId,
            uploadPath: uploadPath,
            imageData: compressed
        )
        modelContext.insert(pendingUpload)
        pendingUploads.append(pendingUpload)
    }

    if let networkClient, !pendingUploads.isEmpty {
        let projectIdString = project.id.uuidString
        let canvasIdString = project.canvas.id.uuidString
        let entryIdString = entry.id.uuidString
        let entryNotesForServer = entryNotes.isEmpty ? nil : entryNotes

        Task {
            do {
                // Ensure project exists on server
                let projectBody: [String: Any] = ["id": projectIdString, "canvasId": canvasIdString]
                let projectJSON = try JSONSerialization.data(withJSONObject: projectBody)
                _ = try? await networkClient.postJSON(path: "/projects", body: projectJSON)

                // Ensure entry exists on server
                var entryBody: [String: Any] = ["id": entryIdString]
                if let notes = entryNotesForServer { entryBody["notes"] = notes }
                let entryJSON = try JSONSerialization.data(withJSONObject: entryBody)
                _ = try? await networkClient.postJSON(path: "/projects/\(projectIdString)/entries", body: entryJSON)

                // Upload each image
                for (index, pendingUpload) in pendingUploads.enumerated() {
                    let responseData = try await networkClient.uploadImage(
                        path: pendingUpload.uploadPath,
                        imageData: pendingUpload.imageData,
                        filename: "\(pendingUpload.entityId.uuidString).jpg"
                    )
                    if let json = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any],
                       let imageKey = json["imageKey"] as? String {
                        await MainActor.run {
                            // Now create the JournalImage with a real imageKey
                            let journalImage = JournalImage(
                                id: pendingUpload.entityId,
                                entry: entry,
                                imageKey: imageKey,
                                sortOrder: index
                            )
                            modelContext.insert(journalImage)
                            // Upload succeeded — delete PendingUpload
                            modelContext.delete(pendingUpload)
                        }
                        // Cache the image
                        await ImageCache.shared.store(
                            UIImage(data: pendingUpload.imageData) ?? UIImage(),
                            forKey: imageKey
                        )
                        await ImageCache.shared.storeToDisk(pendingUpload.imageData, forKey: imageKey)
                    }
                }
            } catch {
                // Network failed — PendingUploads persist for retry
            }
        }
    }

    dismiss()
}
```

**Step 2: Remove unused `index` variable warning**

The `selectedImages.enumerated()` loop used `index` for sortOrder — now we use `pendingUploads.enumerated()` index instead. Make sure the `selectedImages` loop doesn't reference `index`.

**Step 3: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): refactor AddJournalEntryView to use PendingUpload queue

Stops creating JournalImage records with empty imageKey.
JournalImage is only created after successful upload."
```

---

### Task 10: iOS — SyncEngine Additions (Upload Queue + Cache Eviction)

After sync completes, process the PendingUpload queue. When processing deletes from server, evict images from ImageCache.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Add UploadQueue to SyncEngine**

In `SyncEngine.swift`, add `uploadQueue` property after `modelContainer`:

```swift
private var uploadQueue: UploadQueue?
```

In the `init`, after setting `self.modelContainer`:

```swift
self.uploadQueue = UploadQueue(modelContainer: modelContainer, networkClient: networkClient)
```

**Step 2: Process upload queue after sync**

At the end of the `sync()` method, after `lastSyncTimestamp = response.serverTimestamp` (line 473), add:

```swift
// Process pending uploads after successful sync
await uploadQueue?.processQueue()
```

**Step 3: Evict cached images on delete**

In the sync response processing loop, when a canvas delete is applied (around line 309), after `canvas.syncedAt = Date()`, add:

```swift
// Evict image from cache
if let imageKey = canvas.imageKey {
    await ImageCache.shared.evict(forKey: imageKey)
}
```

When a journalImage delete is applied (around line 420), after `image.syncedAt = Date()`, add:

```swift
// Evict image from cache
if !image.imageKey.isEmpty {
    await ImageCache.shared.evict(forKey: image.imageKey)
}
```

**Step 4: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 5: Run all tests**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: TEST SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): add upload queue processing and cache eviction to SyncEngine"
```

---

### Task 11: iOS — Wire Upload Queue to App Lifecycle

Process pending uploads on app foreground (alongside sync) and pass upload queue context.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`

**Step 1: Add upload queue foreground trigger**

In `stitchuationApp.swift`, add `@State private var uploadQueue: UploadQueue?` after `syncEngine`.

In the `.task` modifier, after creating `syncEngine`, create the upload queue:

```swift
let queue = UploadQueue(modelContainer: modelContainer, networkClient: networkClient)
uploadQueue = queue
```

In the `.onReceive` for `willEnterForegroundNotification`, add upload queue processing:

After `Task { try? await syncEngine.sync() }`, add:

```swift
Task { await uploadQueue?.processQueue() }
```

**Step 2: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): process upload queue on app foreground"
```

---

### Task 12: iOS — JournalImage Model Fix (Optional imageKey)

Change `imageKey: String` to `imageKey: String` remaining non-optional but update all filtering to handle empty strings (which is what the existing code already does). The design said to make it optional, but since the existing codebase consistently uses `!image.imageKey.isEmpty` checks and the SyncEngine already skips empty imageKeys, keep it as `String` for backward compatibility. The real fix was in Task 9 — stopping creation of JournalImage records with empty imageKey.

**Files:**
- No changes needed — the zombie fix is already implemented in Task 9.

**Step 1: Verify existing guards**

Confirm these guards exist:
- `SyncEngine.swift:233`: `!image.imageKey.isEmpty` — skips empty imageKey during sync
- `JournalImageGrid.swift:9`: `!$0.imageKey.isEmpty` — filters empty imageKey from display
- `ProjectDetailView.swift:205`: `!$0.imageKey.isEmpty` — filters empty imageKey in JournalEntryCard

All three are already in place. No code changes needed.

**Step 2: Commit (skip — no changes)**

No commit needed. The zombie fix is part of Task 9's commit.

---

### Task 13: iOS — Cleanup PendingUploads on Entity Delete

When a canvas or journal entry is deleted locally, clean up associated PendingUpload records.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift:133-139` (project delete)
- Modify: `apps/ios/stitchuation/stitchuation/Views/StashListView.swift` (canvas delete, if swipe-to-delete exists)

**Step 1: Find canvas delete locations**

Search for `deletedAt = now` or `deletedAt =` patterns in view files to find all delete locations.

**Step 2: Add PendingUpload cleanup on canvas delete**

Wherever a canvas is soft-deleted, add cleanup:

```swift
// Clean up pending uploads for this canvas
let canvasId = canvas.id
let uploadDescriptor = FetchDescriptor<PendingUpload>(
    predicate: #Predicate { $0.entityType == "canvas" && $0.entityId == canvasId }
)
if let pendingUploads = try? modelContext.fetch(uploadDescriptor) {
    for upload in pendingUploads {
        modelContext.delete(upload)
    }
}
```

**Step 3: Add PendingUpload cleanup on project delete (which cascades to entries/images)**

In `ProjectDetailView.swift`, in the delete confirmation block (lines 133-139), after setting `project.deletedAt`, add:

```swift
// Clean up pending uploads for journal images in this project
let entries = project.entries.filter { $0.deletedAt == nil }
for entry in entries {
    entry.deletedAt = now
    entry.updatedAt = now
    let entryImages = entry.images
    for image in entryImages {
        let imageId = image.id
        let uploadDescriptor = FetchDescriptor<PendingUpload>(
            predicate: #Predicate { $0.entityType == "journalImage" && $0.entityId == imageId }
        )
        if let uploads = try? modelContext.fetch(uploadDescriptor) {
            for upload in uploads {
                modelContext.delete(upload)
            }
        }
    }
}
```

**Step 4: Build to verify it compiles**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectDetailView.swift apps/ios/stitchuation/stitchuation/Views/StashListView.swift
git commit -m "feat(ios): clean up PendingUpload records on entity delete"
```

---

### Task 14: Final Verification — Full Build + Test Suite

**Step 1: Run full iOS build**

Run: `xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -10`
Expected: BUILD SUCCEEDED

**Step 2: Run full iOS test suite**

Run: `xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO 2>&1 | tail -20`
Expected: TEST SUCCEEDED

**Step 3: Run full API test suite**

Run: `cd apps/api && npx vitest run`
Expected: All PASS

**Step 4: Verify no SourceKit false positives block compilation**

If SourceKit shows errors but xcodebuild succeeds, trust xcodebuild.

**Step 5: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix(ios): address final build issues from image caching implementation"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | API | Cache-Control headers on image routes |
| 2 | API | Image file cleanup on soft-delete via sync |
| 3 | iOS | ImageCache actor (NSCache + disk) |
| 4 | iOS | PendingUpload SwiftData model |
| 5 | iOS | UploadQueue processor |
| 6 | iOS | CanvasThumbnail → ImageCache |
| 7 | iOS | ImageViewerView → ImageCache |
| 8 | iOS | AddCanvasView → PendingUpload flow |
| 9 | iOS | AddJournalEntryView → PendingUpload flow (zombie fix) |
| 10 | iOS | SyncEngine: queue processing + cache eviction |
| 11 | iOS | App lifecycle: foreground queue trigger |
| 12 | iOS | JournalImage model verification (no-op) |
| 13 | iOS | PendingUpload cleanup on entity delete |
| 14 | Both | Final verification (build + all tests) |
