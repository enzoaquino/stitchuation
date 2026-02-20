import Foundation
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
