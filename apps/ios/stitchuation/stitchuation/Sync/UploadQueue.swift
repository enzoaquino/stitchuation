import Foundation
import Network
import SwiftData
import UIKit

@MainActor
final class UploadQueue {
    private let modelContainer: ModelContainer
    private let networkClient: NetworkClient

    init(modelContainer: ModelContainer, networkClient: NetworkClient) {
        self.modelContainer = modelContainer
        self.networkClient = networkClient
    }

    /// Process all pending uploads oldest-first. Skips permanently failed ones.
    /// Skips entirely if no network connectivity (to avoid burning retry attempts).
    func processQueue() async {
        guard await hasNetworkConnectivity() else { return }

        let context = modelContainer.mainContext
        let descriptor = FetchDescriptor<PendingUpload>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        guard let uploads = try? context.fetch(descriptor) else { return }

        for upload in uploads where !upload.hasFailed {
            await processUpload(upload, context: context)
        }
    }

    private func hasNetworkConnectivity() async -> Bool {
        await withCheckedContinuation { continuation in
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { path in
                monitor.cancel()
                continuation.resume(returning: path.status == .satisfied)
            }
            monitor.start(queue: DispatchQueue(label: "uploadqueue.connectivity"))
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
                // Update or create the entity with the imageKey
                updateEntity(upload: upload, imageKey: imageKey, context: context)
                // Write to ImageCache (only if data decodes to a valid image)
                if let image = UIImage(data: upload.imageData) {
                    await ImageCache.shared.store(image, forKey: imageKey)
                }
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
            } else if let parentEntryId = upload.parentEntryId {
                // Retry path: JournalImage wasn't created on first attempt, create it now
                let entryDescriptor = FetchDescriptor<JournalEntry>(
                    predicate: #Predicate { $0.id == parentEntryId }
                )
                if let entry = try? context.fetch(entryDescriptor).first {
                    let journalImage = JournalImage(
                        id: entityId,
                        entry: entry,
                        imageKey: imageKey,
                        sortOrder: upload.sortOrder ?? 0
                    )
                    context.insert(journalImage)
                }
            }
        }
    }
}
