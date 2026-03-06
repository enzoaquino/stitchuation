# Offline Image Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make images appear immediately after the user takes/selects them, even without connectivity, by creating JournalImage records upfront with a `pending:{uuid}` key and teaching ImageCache to resolve pending keys from local PendingUpload data.

**Architecture:** Create JournalImage/set imageKey immediately on save with a `pending:` prefix key. ImageCache detects this prefix and loads image data from the PendingUpload SwiftData model. UploadQueue swaps the key to the real server URL on successful upload. Retry policy changes from hard 5-cap to exponential backoff. SyncEngine skips `pending:` keys.

**Tech Stack:** SwiftUI + SwiftData (iOS), Swift Testing (tests)

---

### Task 1: Add `pending:` key resolution to ImageCache

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/ImageCachePendingTests.swift`

**Step 1: Write the test**

Create `apps/ios/stitchuation/stitchuationTests/ImageCachePendingTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("ImageCache Pending Key Tests")
struct ImageCachePendingTests {

    @Test("isPendingKey detects pending: prefix")
    func isPendingKey() {
        #expect(ImageCache.isPendingKey("pending:abc-123") == true)
        #expect(ImageCache.isPendingKey("pending:") == true)
        #expect(ImageCache.isPendingKey("https://example.com/image.jpg") == false)
        #expect(ImageCache.isPendingKey("images/abc.jpg") == false)
        #expect(ImageCache.isPendingKey("") == false)
        #expect(ImageCache.isPendingKey(nil) == false)
    }

    @Test("pendingEntityId extracts UUID from pending key")
    func pendingEntityId() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000"
        #expect(ImageCache.pendingEntityId("pending:\(uuid)")?.uuidString.lowercased() == uuid)
        #expect(ImageCache.pendingEntityId("pending:not-a-uuid") == nil)
        #expect(ImageCache.pendingEntityId("https://example.com") == nil)
        #expect(ImageCache.pendingEntityId(nil) == nil)
    }
}
```

**Step 2: Add `isPendingKey` and `pendingEntityId` to ImageCache**

In `apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift`, add these static methods alongside the existing `isDirectURL`:

```swift
/// Returns true if the imageKey is a pending upload placeholder.
static func isPendingKey(_ imageKey: String?) -> Bool {
    guard let imageKey else { return false }
    return imageKey.hasPrefix("pending:")
}

/// Extracts the entity UUID from a pending key like "pending:{uuid}".
static func pendingEntityId(_ imageKey: String?) -> UUID? {
    guard let imageKey, isPendingKey(imageKey) else { return nil }
    let uuidString = String(imageKey.dropFirst("pending:".count))
    return UUID(uuidString: uuidString)
}
```

**Step 3: Add `modelContainer` configuration to ImageCache**

ImageCache needs access to SwiftData to query PendingUpload. Add a stored property and configure method:

```swift
private var modelContainer: ModelContainer?

func configure(modelContainer: ModelContainer) {
    self.modelContainer = modelContainer
}
```

**Step 4: Update `image(for:networkClient:)` to handle pending keys**

In the `image(for:networkClient:)` method, add a check for pending keys right after the `guard` at the top, before the memory cache check:

```swift
// 0. Pending upload — load from local PendingUpload data
if Self.isPendingKey(imageKey) {
    if let cached = cachedImage(forKey: imageKey) {
        return cached
    }
    if let entityId = Self.pendingEntityId(imageKey),
       let container = modelContainer {
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<PendingUpload>(
            predicate: #Predicate { $0.entityId == entityId }
        )
        if let upload = try? context.fetch(descriptor).first,
           let image = UIImage(data: upload.imageData) {
            store(image, forKey: imageKey)
            return image
        }
    }
    return nil
}
```

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Cache/ImageCache.swift apps/ios/stitchuation/stitchuationTests/ImageCachePendingTests.swift
git commit -m "feat(ios): add pending key resolution to ImageCache for offline images

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Configure ImageCache with ModelContainer at app startup

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`

**Step 1: Configure ImageCache in the `.task` block**

In `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`, in the `.task` block (around line 46), add this line early — before the auth/sync setup:

```swift
await ImageCache.shared.configure(modelContainer: modelContainer)
```

Place it right after the fresh-install detection block (around line 55, after `UserDefaults.standard.removeObject(forKey: "lastSyncTimestamp")`), before `let auth = AuthViewModel(...)`.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): configure ImageCache with ModelContainer at app startup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create JournalImage immediately in AddJournalEntryView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift`

**Step 1: Refactor `saveEntry()` to create JournalImage immediately**

Replace the current `saveEntry()` method. The key changes are:
1. Create `JournalImage` with `imageKey = "pending:{imageId}"` immediately
2. Still create `PendingUpload` for background upload
3. The background upload task updates the `JournalImage.imageKey` on success (already handled by `UploadQueue.updateEntity()`)
4. Remove the inline upload attempt — let `UploadQueue` handle it

The new `saveEntry()`:

```swift
private func saveEntry() {
    let entryNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
    let entry = JournalEntry(
        piece: piece,
        notes: entryNotes.isEmpty ? nil : entryNotes
    )
    modelContext.insert(entry)

    // Create JournalImage + PendingUpload for each photo immediately
    for (index, selectedImage) in selectedImages.enumerated() {
        let imageId = UUID()
        let compressed = compressImage(selectedImage.data, maxBytes: 10 * 1024 * 1024)
        let uploadPath = "/pieces/\(piece.id.uuidString)/entries/\(entry.id.uuidString)/images"

        // Create JournalImage with pending key — image shows immediately
        let journalImage = JournalImage(
            id: imageId,
            entry: entry,
            imageKey: "pending:\(imageId.uuidString)",
            sortOrder: index
        )
        modelContext.insert(journalImage)

        // Cache the image in memory so it renders instantly
        if let uiImage = UIImage(data: compressed) {
            Task {
                await ImageCache.shared.store(uiImage, forKey: "pending:\(imageId.uuidString)")
            }
        }

        // Create PendingUpload for background upload
        let pendingUpload = PendingUpload(
            entityType: "journalImage",
            entityId: imageId,
            uploadPath: uploadPath,
            imageData: compressed,
            parentEntryId: entry.id,
            sortOrder: index
        )
        modelContext.insert(pendingUpload)
    }

    try? modelContext.save()
    dismiss()
}
```

Note: Remove the old `pendingUploads` array, the `networkClient` check, and the entire inline `Task { do { ... } }` block that attempted immediate upload. The `UploadQueue` will handle all uploads.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): create JournalImage immediately with pending key for offline display

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Set piece imageKey immediately in AddCanvasView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Step 1: Read the current file**

Read `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift` to understand the current piece creation + upload flow.

**Step 2: Set imageKey to pending key immediately**

Find where the `StitchPiece` is created and `PendingUpload` is made. Currently `imageKey` is left empty and only set after upload succeeds. Change to:

1. When creating the piece, set `imageKey = "pending:{uploadId}"` where `uploadId` is the `PendingUpload`'s entity ID
2. Cache the image in memory under the pending key
3. Remove any inline upload attempt — let `UploadQueue` handle it

The pattern is the same as Task 3 but for piece cover photos instead of journal images.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): set piece imageKey immediately with pending key for offline display

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Update SyncEngine to skip pending keys

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Skip pending imageKeys when sending journal images**

In `SyncEngine.swift`, around line 223-226, where it filters unsynced images:

```swift
let unsyncedImages = allImages.filter { image in
    // Skip images with empty imageKey — upload hasn't completed yet
    !image.imageKey.isEmpty &&
    (image.syncedAt == nil || image.updatedAt > (image.syncedAt ?? .distantPast))
}
```

Add a check for pending keys:

```swift
let unsyncedImages = allImages.filter { image in
    // Skip images with empty or pending imageKey — upload hasn't completed yet
    !image.imageKey.isEmpty &&
    !ImageCache.isPendingKey(image.imageKey) &&
    (image.syncedAt == nil || image.updatedAt > (image.syncedAt ?? .distantPast))
}
```

**Step 2: Skip pending imageKeys when sending piece data**

In the piece sync changes mapping, if `piece.imageKey` starts with `pending:`, send `nil` for `imageKey` so the server doesn't store a pending key. Find where piece data is built (around line 171-175) and add:

```swift
let imageKeyForSync: String? = if let key = piece.imageKey, !ImageCache.isPendingKey(key) {
    key
} else {
    nil
}
```

Use `imageKeyForSync` instead of `piece.imageKey` in the data dictionary (it's fine to pass nil — the server already handles optional imageKey).

Wait — actually, piece imageKey is resolved via `resolveImageKey` on the server side and isn't sent by the client during sync. Let me check... The piece sync in the client sends piece data with imageKey, and the sync allowlist has `imageKey` commented out:

```typescript
// imageKey is managed by upload endpoints, not sync — clients send resolved
// SAS URLs which would corrupt the plain key stored in the DB
```

So `imageKey` is NOT sent by the client in sync changes. It's only received from the server. This means we only need to filter journal images — pieces are fine because `imageKey` isn't in the sync payload.

So only the journal image filter change is needed.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): skip pending imageKeys in sync to avoid sending placeholder keys

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Improve retry policy with exponential backoff

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`

**Step 1: Remove hard retry cap from PendingUpload**

In `apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift`:

Replace the `maxRetries` and `hasFailed` logic:

```swift
// Old:
static let maxRetries = 5

var hasFailed: Bool {
    retryCount >= Self.maxRetries
}
```

With exponential backoff readiness check:

```swift
/// Minimum seconds to wait before next retry: 2^retryCount, capped at 1 hour.
var backoffSeconds: TimeInterval {
    min(pow(2.0, Double(retryCount)), 3600)
}

/// Whether enough time has passed since last attempt to retry.
var isReadyForRetry: Bool {
    guard let lastAttempt = lastAttemptAt else { return true }
    return Date().timeIntervalSince(lastAttempt) >= backoffSeconds
}
```

**Step 2: Update UploadQueue to use backoff instead of hasFailed**

In `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`, change the filter in `processQueue()`:

```swift
// Old:
for upload in uploads where !upload.hasFailed {

// New:
for upload in uploads where upload.isReadyForRetry {
```

**Step 3: Update PendingUpload tests**

In `apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift`, the existing tests reference `hasFailed` and `maxRetries`. Read the file and update:

- Remove any test that checks `hasFailed` after 5 retries
- Add tests for `backoffSeconds` (retryCount 0 → 1s, retryCount 3 → 8s, retryCount 20 → 3600s cap)
- Add tests for `isReadyForRetry` (no lastAttemptAt → true, recent attempt → false, old attempt → true)

```swift
@Test("backoff seconds doubles with retry count")
func backoffSeconds() {
    let upload = PendingUpload(entityType: "test", entityId: UUID(), uploadPath: "/test", imageData: Data())
    #expect(upload.backoffSeconds == 1.0) // 2^0

    upload.retryCount = 3
    #expect(upload.backoffSeconds == 8.0) // 2^3

    upload.retryCount = 10
    #expect(upload.backoffSeconds == 1024.0) // 2^10
}

@Test("backoff caps at 1 hour")
func backoffCap() {
    let upload = PendingUpload(entityType: "test", entityId: UUID(), uploadPath: "/test", imageData: Data())
    upload.retryCount = 20
    #expect(upload.backoffSeconds == 3600.0)
}

@Test("isReadyForRetry returns true with no lastAttemptAt")
func readyNoLastAttempt() {
    let upload = PendingUpload(entityType: "test", entityId: UUID(), uploadPath: "/test", imageData: Data())
    #expect(upload.isReadyForRetry == true)
}

@Test("isReadyForRetry returns false when recently attempted")
func notReadyRecentAttempt() {
    let upload = PendingUpload(entityType: "test", entityId: UUID(), uploadPath: "/test", imageData: Data())
    upload.retryCount = 5  // backoff = 32 seconds
    upload.lastAttemptAt = Date()  // just now
    #expect(upload.isReadyForRetry == false)
}

@Test("isReadyForRetry returns true when backoff has elapsed")
func readyAfterBackoff() {
    let upload = PendingUpload(entityType: "test", entityId: UUID(), uploadPath: "/test", imageData: Data())
    upload.retryCount = 1  // backoff = 2 seconds
    upload.lastAttemptAt = Date(timeIntervalSinceNow: -10)  // 10 seconds ago
    #expect(upload.isReadyForRetry == true)
}
```

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/PendingUpload.swift apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift apps/ios/stitchuation/stitchuationTests/PendingUploadTests.swift
git commit -m "feat(ios): replace hard retry cap with exponential backoff for uploads

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Clean up UploadQueue.updateEntity for pending key flow

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift`

**Step 1: Review updateEntity logic**

The existing `updateEntity` method in `UploadQueue.swift` already handles both cases:
- **journalImage**: Finds `JournalImage` by `entityId`, updates `imageKey`. If not found, creates one (retry path).
- **piece**: Finds `StitchPiece` by `entityId`, updates `imageKey`.

With the new pending key flow:
- `JournalImage` always exists (created immediately with `pending:` key)
- `StitchPiece` already has `imageKey` set to `pending:` key

So `updateEntity` should always find the entity and update its key. The "retry path" (creating JournalImage if not found) is now a safety net rather than the primary path.

**Step 2: Evict the pending key from ImageCache after swap**

When the key changes from `pending:{uuid}` to the real key, the old pending key is stale in memory cache. Add eviction in `processUpload` after `updateEntity`:

After `updateEntity(upload:imageKey:context:)` and before `context.delete(upload)`, add:

```swift
// Evict the old pending key from memory cache
let pendingKey = "pending:\(upload.entityId.uuidString)"
await ImageCache.shared.evict(forKey: pendingKey)
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/UploadQueue.swift
git commit -m "feat(ios): evict pending key from cache after successful upload

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Build and test

**Step 1: Build iOS project**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -quiet 2>&1 | tail -5`
Expected: `BUILD SUCCEEDED`

**Step 2: Run iOS tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:stitchuationTests 2>&1 | grep -E '(passed|failed)' | tail -30`
Expected: All tests pass, including new `ImageCachePendingTests` and updated `PendingUploadTests`.

**Step 3: Run API tests (sanity check — no API changes but verify nothing broke)**

Run: `cd apps/api && npx vitest run`
Expected: All 365 tests pass.

**Step 4: Fix any issues and commit if needed**
