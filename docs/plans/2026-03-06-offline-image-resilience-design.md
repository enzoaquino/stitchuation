# Offline Image Resilience Design

Images should appear immediately after the user takes/selects them, even without connectivity. Uploads happen in the background; the user never sees a "missing image."

## Problem

Currently, `JournalImage` records (which drive display) are only created after the upload succeeds. When offline:
1. User saves a journal entry with photos
2. `PendingUpload` is created with image data, but no `JournalImage` exists
3. The entry appears with no images
4. If upload eventually fails 5 times, data is permanently abandoned

Same issue for piece cover photos — `imageKey` stays empty until upload completes.

## Solution

**Create `JournalImage` and set `StitchPiece.imageKey` immediately using a `pending:{uuid}` key.** Teach `ImageCache` to resolve `pending:` keys from local `PendingUpload` data. On successful upload, swap the key to the real server URL.

## Changes

### 1. Immediate entity creation

**AddJournalEntryView.saveEntry():**
- Create `JournalImage` immediately with `imageKey = "pending:{imageId}"`
- Create `PendingUpload` as before (image data persisted to disk)
- Dismiss immediately — user sees images right away

**AddCanvasView (piece cover photo):**
- Set `StitchPiece.imageKey = "pending:{uploadId}"` immediately
- Create `PendingUpload` as before

### 2. ImageCache resolves pending keys

**ImageCache.image(for:networkClient:):**
- Detect `pending:` prefix on imageKey
- Extract the UUID from the key
- Query `PendingUpload` by `entityId` matching that UUID
- Return `UIImage(data: pendingUpload.imageData)`
- Cache in memory (not disk — disk already has it via `.externalStorage`)

This requires passing a `ModelContainer` to `ImageCache` so it can query `PendingUpload`. Since `ImageCache` is an actor, we pass the container at init or via a configure method.

### 3. Upload success swaps key

**UploadQueue.processUpload():**
- On success, update `JournalImage.imageKey` from `pending:{uuid}` to the real server key (already does this via `updateEntity`)
- Cache the image under the new key (already does this)
- Delete `PendingUpload` (already does this)
- Post `.journalImagesDidChange` notification so views refresh

**UploadQueue.updateEntity():**
- For `journalImage`: Find `JournalImage` by `entityId`, update `imageKey` — this already works
- For `piece`: Find `StitchPiece` by `entityId`, update `imageKey` — this already works

### 4. Better retry policy

- Remove the hard 5-retry cap
- Use exponential backoff: wait `min(2^retryCount, 3600)` seconds between attempts
- Keep retrying indefinitely as long as `PendingUpload` exists
- Only mark as failed if the server returns a permanent error (4xx, not 5xx/timeout)

### 5. SyncEngine skips pending keys

**SyncEngine** already skips images with empty `imageKey`. Update to also skip `pending:` keys — these shouldn't sync to the server until the upload completes and the key is swapped to a real URL.

## Flow

```
User takes photo → saves entry
  → JournalImage created with imageKey = "pending:{uuid}"
  → PendingUpload created with image data
  → dismiss() — user sees images immediately via ImageCache pending: resolution

Later (when online):
  → UploadQueue processes PendingUpload
  → Server returns real imageKey
  → JournalImage.imageKey updated to real key
  → Image cached under real key
  → PendingUpload deleted
  → journalImagesDidChange notification posted
  → Views re-render with real key (seamless — image was already visible)
```

## Edge Cases

- **App killed before upload**: `PendingUpload` persists in SwiftData. On next launch, `UploadQueue.processQueue()` retries. `JournalImage` already exists with `pending:` key, so images still display.
- **Image data corrupted**: If `PendingUpload.imageData` is empty/corrupt, `ImageCache` returns nil → placeholder shown. Upload will fail on server too. Could add a cleanup job later.
- **Multiple devices**: `pending:` keys only exist on the originating device. Other devices won't see the image until upload completes and syncs. This is acceptable — you can only take photos on one device at a time.
