# Image Caching & Sync Reliability Fix

**Goal:** Fix image persistence across app relaunches, add retry for failed uploads, and close sync reliability gaps so the offline-first promise actually holds for images.

**Approach:** Layered image pipeline — file-based disk cache, persistent upload queue, server cache headers.

**Scope:** iOS client (ImageCache, PendingUpload, view refactors, SyncEngine additions) + API server (cache headers, image cleanup on delete).

---

## Section 1: ImageCache — File-Based Disk Cache

A singleton `ImageCache` actor with two layers:

- **Memory layer** — `NSCache<NSString, UIImage>` for hot images. Auto-evicts under memory pressure.
- **Disk layer** — files in `{appCaches}/images/`, filenames derived from `imageKey` via SHA256 hash.

**Lookup flow:**
1. Check NSCache (memory) — hit? Return immediately.
2. Check disk file — hit? Decode, store in NSCache, return.
3. Fetch from network — store on disk, store in NSCache, return.
4. Network fails — return nil (show placeholder).

**Invalidation:** Images are immutable (imageKey is content-addressed — same key = same image). No invalidation needed. System reclaims Caches directory under storage pressure.

**Integration:** `CanvasThumbnail` and `ImageViewerView` both use `ImageCache` instead of raw `networkClient.fetchData()`.

---

## Section 2: PendingUpload Queue — Persistent Upload Retry

New SwiftData model `PendingUpload`:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `entityType` | String | "canvas" or "journalImage" |
| `entityId` | UUID | ID of the canvas or journal image |
| `parentPath` | String | API upload path (e.g. `/canvases/{id}/image`) |
| `imageData` | Data | Compressed JPEG, stored in external storage |
| `createdAt` | Date | When the upload was first attempted |
| `retryCount` | Int | Number of retry attempts |
| `lastAttemptAt` | Date? | Last retry timestamp |

**Flow on image selection:**
1. User picks photo — compress to JPEG.
2. Save `PendingUpload` to SwiftData **before** attempting network upload.
3. Attempt upload immediately.
4. On success — delete `PendingUpload`, set `imageKey` on entity.
5. On failure — `PendingUpload` persists, increment `retryCount`.

**Retry triggers:**
- App enters foreground (scene phase `.active`)
- After successful sync cycle completes
- Manual retry (future: pull-to-refresh or retry button)

**Retry logic:**
- Process queue oldest-first.
- Max 5 retries per upload (after that, mark as permanently failed).
- Skip if no network connectivity.

**Cleanup:** When a canvas or journal entry is deleted, also delete associated `PendingUpload` records.

**JournalImage zombie fix:** Stop creating `JournalImage` records with empty `imageKey`. Create them only after successful upload. The `PendingUpload` holds the image data until then.

---

## Section 3: Server Cache Headers + Image Cleanup

**Cache headers on `/images/*` route:**
```
Cache-Control: public, max-age=31536000, immutable
```
Images are content-addressed (key includes entity ID, never changes). Tells URLSession and proxies to cache aggressively. `immutable` means don't revalidate.

**Image cleanup on soft-delete:** When a canvas or journal image is soft-deleted via sync, delete the associated image file on the server:
- Canvas delete — delete `uploads/canvases/{userId}/{canvasId}.*`
- JournalImage delete — delete `uploads/journals/{userId}/{entryId}/{imageId}.*`

**Client-side cache cleanup:** When sync engine processes a delete, evict that `imageKey` from `ImageCache` disk cache.

---

## Section 4: Integration Changes

**CanvasThumbnail refactor:**
- Replace `networkClient.fetchData()` with `ImageCache.shared.image(for:networkClient:)`
- Remove `@State private var loadedImage` — cache is source of truth
- Keep `@State` for displayed image but populate from cache (memory hit is synchronous)

**ImageViewerView refactor:**
- Same pattern — check `ImageCache` first, fall back to network
- Full-res images also cached on disk (same `imageKey`)

**AddCanvasView / AddJournalEntryView refactor:**
- On photo selection: compress immediately, write `PendingUpload` to SwiftData
- Attempt upload in background task
- On success: delete `PendingUpload`, set `imageKey`, write image to `ImageCache` (instantly available without network round-trip)
- On failure: `PendingUpload` persists for retry

**SyncEngine additions:**
- After sync completes, process the `PendingUpload` queue
- On processing deletes: evict from `ImageCache`

**JournalImage model fix:**
- Change `imageKey: String` to `imageKey: String?` (optional)
- Don't create `JournalImage` records until upload succeeds — `PendingUpload` holds data in the interim
- SyncEngine continues to skip journal images with nil/empty imageKey (already does this)

---

## Success Criteria

- Images survive app relaunch (disk cache)
- Images survive app kill during upload (persistent queue retries)
- No more JournalImage zombie records with empty imageKey
- Server returns cache headers on images
- Deleted entities clean up their image files
- Scrolling a list of 50 canvases loads images from disk, not network
