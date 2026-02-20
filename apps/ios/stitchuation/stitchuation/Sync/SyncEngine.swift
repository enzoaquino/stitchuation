import Foundation
import SwiftData

// MARK: - Sync DTOs

struct SyncRequest: Encodable, Sendable {
    let lastSync: String?
    let changes: [SyncChange]
}

struct SyncChange: Codable, Sendable {
    let type: String
    let action: String
    let id: String
    let data: [String: AnyCodable]?
    let updatedAt: String
    let deletedAt: String?
}

struct SyncResponse: Decodable, Sendable {
    let serverTimestamp: String
    let changes: [SyncChange]
}

/// Type-erased Codable wrapper for sync data values
struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if container.decodeNil() {
            value = NSNull()
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array
        } else {
            value = try container.decode([String: AnyCodable].self)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let bool as Bool:
            try container.encode(bool)
        case is NSNull:
            try container.encodeNil()
        case let array as [AnyCodable]:
            try container.encode(array)
        case let dict as [String: AnyCodable]:
            try container.encode(dict)
        default:
            try container.encodeNil()
        }
    }
}

// MARK: - Sync Engine

@MainActor
@Observable
final class SyncEngine {
    private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private let networkClient: NetworkClient
    private let modelContainer: ModelContainer
    private let uploadQueue: UploadQueue
    private static let lastSyncKey = "lastSyncTimestamp"

    private(set) var isSyncing = false
    private(set) var lastSyncTimestamp: String? {
        didSet { UserDefaults.standard.set(lastSyncTimestamp, forKey: Self.lastSyncKey) }
    }

    init(networkClient: NetworkClient, modelContainer: ModelContainer, uploadQueue: UploadQueue) {
        self.networkClient = networkClient
        self.modelContainer = modelContainer
        self.uploadQueue = uploadQueue
        self.lastSyncTimestamp = UserDefaults.standard.string(forKey: Self.lastSyncKey)
    }

    func sync() async throws {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        let context = modelContainer.mainContext
        let formatter = Self.dateFormatter

        // Gather local changes (unsynced threads)
        let allDescriptor = FetchDescriptor<NeedleThread>()
        let allThreads = try context.fetch(allDescriptor)
        let unsynced = allThreads.filter { thread in
            thread.syncedAt == nil || thread.updatedAt > (thread.syncedAt ?? .distantPast)
        }

        let threadChanges: [SyncChange] = unsynced.map { thread in
            let isDeleted = thread.deletedAt != nil
            var data: [String: AnyCodable]?
            if !isDeleted {
                data = [
                    "brand": AnyCodable(thread.brand),
                    "number": AnyCodable(thread.number),
                    "colorName": AnyCodable(thread.colorName ?? NSNull()),
                    "colorHex": AnyCodable(thread.colorHex ?? NSNull()),
                    "fiberType": AnyCodable(thread.fiberType.rawValue),
                    "quantity": AnyCodable(thread.quantity),
                    "barcode": AnyCodable(thread.barcode ?? NSNull()),
                    "weightOrLength": AnyCodable(thread.weightOrLength ?? NSNull()),
                    "notes": AnyCodable(thread.notes ?? NSNull()),
                ]
            }
            return SyncChange(
                type: "thread",
                action: isDeleted ? "delete" : "upsert",
                id: thread.id.uuidString,
                data: data,
                updatedAt: formatter.string(from: thread.updatedAt),
                deletedAt: thread.deletedAt.map { formatter.string(from: $0) }
            )
        }

        // Gather unsynced pieces
        let allPieceDescriptor = FetchDescriptor<StitchPiece>()
        let allPieces = try context.fetch(allPieceDescriptor)
        let unsyncedPieces = allPieces.filter { piece in
            piece.syncedAt == nil || piece.updatedAt > (piece.syncedAt ?? .distantPast)
        }

        let pieceChanges: [SyncChange] = unsyncedPieces.map { piece in
            let isDeleted = piece.deletedAt != nil
            var data: [String: AnyCodable]?
            if !isDeleted {
                data = [
                    "designer": AnyCodable(piece.designer),
                    "designName": AnyCodable(piece.designName),
                    "status": AnyCodable(piece.status.rawValue),
                    "imageKey": AnyCodable(piece.imageKey ?? NSNull()),
                    "size": AnyCodable(piece.size ?? NSNull()),
                    "meshCount": AnyCodable(piece.meshCount ?? NSNull()),
                    "notes": AnyCodable(piece.notes ?? NSNull()),
                    "acquiredAt": AnyCodable(piece.acquiredAt.map { formatter.string(from: $0) } ?? NSNull()),
                    "startedAt": AnyCodable(piece.startedAt.map { formatter.string(from: $0) } ?? NSNull()),
                    "stitchedAt": AnyCodable(piece.stitchedAt.map { formatter.string(from: $0) } ?? NSNull()),
                    "finishingAt": AnyCodable(piece.finishingAt.map { formatter.string(from: $0) } ?? NSNull()),
                    "completedAt": AnyCodable(piece.completedAt.map { formatter.string(from: $0) } ?? NSNull()),
                ]
            }
            return SyncChange(
                type: "piece",
                action: isDeleted ? "delete" : "upsert",
                id: piece.id.uuidString,
                data: data,
                updatedAt: formatter.string(from: piece.updatedAt),
                deletedAt: piece.deletedAt.map { formatter.string(from: $0) }
            )
        }

        // Gather unsynced journal entries
        let allEntryDescriptor = FetchDescriptor<JournalEntry>()
        let allEntries = try context.fetch(allEntryDescriptor)
        let unsyncedEntries = allEntries.filter { entry in
            entry.syncedAt == nil || entry.updatedAt > (entry.syncedAt ?? .distantPast)
        }

        let entryChanges: [SyncChange] = unsyncedEntries.map { entry in
            let isDeleted = entry.deletedAt != nil
            var data: [String: AnyCodable]?
            if !isDeleted {
                data = [
                    "pieceId": AnyCodable(entry.piece.id.uuidString),
                    "notes": AnyCodable(entry.notes ?? NSNull()),
                ]
            }
            return SyncChange(
                type: "journalEntry",
                action: isDeleted ? "delete" : "upsert",
                id: entry.id.uuidString,
                data: data,
                updatedAt: formatter.string(from: entry.updatedAt),
                deletedAt: entry.deletedAt.map { formatter.string(from: $0) }
            )
        }

        // Gather unsynced journal images
        let allImageDescriptor = FetchDescriptor<JournalImage>()
        let allImages = try context.fetch(allImageDescriptor)
        let unsyncedImages = allImages.filter { image in
            // Skip images with empty imageKey — upload hasn't completed yet
            !image.imageKey.isEmpty &&
            (image.syncedAt == nil || image.updatedAt > (image.syncedAt ?? .distantPast))
        }

        let imageChanges: [SyncChange] = unsyncedImages.map { image in
            let isDeleted = image.deletedAt != nil
            var data: [String: AnyCodable]?
            if !isDeleted {
                data = [
                    "entryId": AnyCodable(image.entry.id.uuidString),
                    "imageKey": AnyCodable(image.imageKey),
                    "sortOrder": AnyCodable(image.sortOrder),
                ]
            }
            return SyncChange(
                type: "journalImage",
                action: isDeleted ? "delete" : "upsert",
                id: image.id.uuidString,
                data: data,
                updatedAt: formatter.string(from: image.updatedAt),
                deletedAt: image.deletedAt.map { formatter.string(from: $0) }
            )
        }

        let request = SyncRequest(lastSync: lastSyncTimestamp, changes: threadChanges + pieceChanges + entryChanges + imageChanges)
        let response: SyncResponse = try await networkClient.request(
            method: "POST",
            path: "/sync",
            body: request
        )

        // Apply server changes with last-write-wins
        for change in response.changes {
            guard let uuid = UUID(uuidString: change.id) else { continue }
            let serverUpdatedAt = formatter.date(from: change.updatedAt) ?? Date()

            if change.type == "thread" {
                let fetchDescriptor = FetchDescriptor<NeedleThread>(
                    predicate: #Predicate { $0.id == uuid }
                )
                let existing = try context.fetch(fetchDescriptor).first

                if change.action == "delete" {
                    if let thread = existing {
                        guard serverUpdatedAt >= thread.updatedAt else { continue }
                        thread.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                        thread.updatedAt = serverUpdatedAt
                        thread.syncedAt = Date()
                    }
                } else if change.action == "upsert" {
                    if let thread = existing {
                        guard serverUpdatedAt >= thread.updatedAt else { continue }
                        applyData(change.data, to: thread)
                        thread.updatedAt = serverUpdatedAt
                        thread.syncedAt = Date()
                    } else {
                        let thread = NeedleThread(
                            id: uuid,
                            brand: stringValue(change.data, key: "brand") ?? "",
                            number: stringValue(change.data, key: "number") ?? ""
                        )
                        applyData(change.data, to: thread)
                        thread.updatedAt = serverUpdatedAt
                        thread.syncedAt = Date()
                        context.insert(thread)
                    }
                }
            } else if change.type == "piece" {
                let fetchDescriptor = FetchDescriptor<StitchPiece>(
                    predicate: #Predicate { $0.id == uuid }
                )
                let existing = try context.fetch(fetchDescriptor).first

                if change.action == "delete" {
                    if let piece = existing {
                        guard serverUpdatedAt >= piece.updatedAt else { continue }
                        piece.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                        piece.updatedAt = serverUpdatedAt
                        piece.syncedAt = Date()
                        // Evict image from cache
                        if let imageKey = piece.imageKey {
                            await ImageCache.shared.evict(forKey: imageKey)
                        }
                    }
                } else if change.action == "upsert" {
                    if let piece = existing {
                        guard serverUpdatedAt >= piece.updatedAt else { continue }
                        applyPieceData(change.data, to: piece)
                        piece.updatedAt = serverUpdatedAt
                        piece.syncedAt = Date()
                    } else {
                        let piece = StitchPiece(
                            id: uuid,
                            designer: stringValue(change.data, key: "designer") ?? "",
                            designName: stringValue(change.data, key: "designName") ?? ""
                        )
                        applyPieceData(change.data, to: piece)
                        piece.updatedAt = serverUpdatedAt
                        piece.syncedAt = Date()
                        context.insert(piece)
                    }
                }
            } else if change.type == "journalEntry" {
                let fetchDescriptor = FetchDescriptor<JournalEntry>(
                    predicate: #Predicate { $0.id == uuid }
                )
                let existing = try context.fetch(fetchDescriptor).first

                if change.action == "delete" {
                    if let entry = existing {
                        guard serverUpdatedAt >= entry.updatedAt else { continue }
                        entry.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                        entry.updatedAt = serverUpdatedAt
                        entry.syncedAt = Date()
                    }
                } else if change.action == "upsert" {
                    if let entry = existing {
                        guard serverUpdatedAt >= entry.updatedAt else { continue }
                        applyJournalEntryData(change.data, to: entry)
                        entry.updatedAt = serverUpdatedAt
                        entry.syncedAt = Date()
                    } else {
                        let pieceIdStr = stringValue(change.data, key: "pieceId")
                        let pieceUUID = UUID(uuidString: pieceIdStr ?? "")
                        var piece: StitchPiece?
                        if let pieceUUID {
                            let pieceFetch = FetchDescriptor<StitchPiece>(
                                predicate: #Predicate { $0.id == pieceUUID }
                            )
                            piece = try context.fetch(pieceFetch).first
                        }
                        guard let piece else { continue }
                        let entry = JournalEntry(
                            id: uuid,
                            piece: piece
                        )
                        applyJournalEntryData(change.data, to: entry)
                        entry.updatedAt = serverUpdatedAt
                        entry.syncedAt = Date()
                        context.insert(entry)
                    }
                }
            } else if change.type == "journalImage" {
                let fetchDescriptor = FetchDescriptor<JournalImage>(
                    predicate: #Predicate { $0.id == uuid }
                )
                let existing = try context.fetch(fetchDescriptor).first

                if change.action == "delete" {
                    if let image = existing {
                        guard serverUpdatedAt >= image.updatedAt else { continue }
                        image.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                        image.updatedAt = serverUpdatedAt
                        image.syncedAt = Date()
                        // Evict image from cache
                        if !image.imageKey.isEmpty {
                            await ImageCache.shared.evict(forKey: image.imageKey)
                        }
                    }
                } else if change.action == "upsert" {
                    if let image = existing {
                        guard serverUpdatedAt >= image.updatedAt else { continue }
                        applyJournalImageData(change.data, to: image)
                        image.updatedAt = serverUpdatedAt
                        image.syncedAt = Date()
                    } else {
                        let entryIdStr = stringValue(change.data, key: "entryId")
                        let entryUUID = UUID(uuidString: entryIdStr ?? "")
                        var entry: JournalEntry?
                        if let entryUUID {
                            let entryFetch = FetchDescriptor<JournalEntry>(
                                predicate: #Predicate { $0.id == entryUUID }
                            )
                            entry = try context.fetch(entryFetch).first
                        }
                        guard let entry else { continue }
                        let image = JournalImage(
                            id: uuid,
                            entry: entry,
                            imageKey: stringValue(change.data, key: "imageKey") ?? ""
                        )
                        applyJournalImageData(change.data, to: image)
                        image.updatedAt = serverUpdatedAt
                        image.syncedAt = Date()
                        context.insert(image)
                    }
                }
            }
        }

        // Mark all pushed changes as synced
        for thread in unsynced {
            thread.syncedAt = Date()
        }
        for piece in unsyncedPieces {
            piece.syncedAt = Date()
        }
        for entry in unsyncedEntries {
            entry.syncedAt = Date()
        }
        for image in unsyncedImages {
            image.syncedAt = Date()
        }

        try context.save()
        lastSyncTimestamp = response.serverTimestamp

        // Process pending uploads after successful sync
        await uploadQueue.processQueue()
    }

    private func applyData(_ data: [String: AnyCodable]?, to thread: NeedleThread) {
        guard let data else { return }

        if let brand = data["brand"]?.value as? String { thread.brand = brand }
        if let number = data["number"]?.value as? String { thread.number = number }

        // Handle nullable fields — clear when server sends null
        if let v = data["colorName"] {
            thread.colorName = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["colorHex"] {
            thread.colorHex = v.value is NSNull ? nil : v.value as? String
        }
        if let fiberType = data["fiberType"]?.value as? String {
            thread.fiberType = FiberType(rawValue: fiberType) ?? .wool
        }
        if let quantity = data["quantity"]?.value as? Int { thread.quantity = quantity }
        if let v = data["barcode"] {
            thread.barcode = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["weightOrLength"] {
            thread.weightOrLength = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["notes"] {
            thread.notes = v.value is NSNull ? nil : v.value as? String
        }
    }

    private func applyPieceData(_ data: [String: AnyCodable]?, to piece: StitchPiece) {
        guard let data else { return }
        if let designer = data["designer"]?.value as? String { piece.designer = designer }
        if let designName = data["designName"]?.value as? String { piece.designName = designName }
        if let statusStr = data["status"]?.value as? String,
           let status = PieceStatus(rawValue: statusStr) {
            piece.status = status
        }
        if let v = data["imageKey"] {
            piece.imageKey = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["size"] {
            piece.size = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["meshCount"] {
            if v.value is NSNull {
                piece.meshCount = nil
            } else if let num = v.value as? Int {
                piece.meshCount = num
            }
        }
        if let v = data["notes"] {
            piece.notes = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["acquiredAt"] {
            if v.value is NSNull { piece.acquiredAt = nil }
            else if let str = v.value as? String { piece.acquiredAt = Self.dateFormatter.date(from: str) }
        }
        if let v = data["startedAt"] {
            if v.value is NSNull { piece.startedAt = nil }
            else if let str = v.value as? String { piece.startedAt = Self.dateFormatter.date(from: str) }
        }
        if let v = data["stitchedAt"] {
            if v.value is NSNull { piece.stitchedAt = nil }
            else if let str = v.value as? String { piece.stitchedAt = Self.dateFormatter.date(from: str) }
        }
        if let v = data["finishingAt"] {
            if v.value is NSNull { piece.finishingAt = nil }
            else if let str = v.value as? String { piece.finishingAt = Self.dateFormatter.date(from: str) }
        }
        if let v = data["completedAt"] {
            if v.value is NSNull { piece.completedAt = nil }
            else if let str = v.value as? String { piece.completedAt = Self.dateFormatter.date(from: str) }
        }
    }

    private func applyJournalEntryData(_ data: [String: AnyCodable]?, to entry: JournalEntry) {
        guard let data else { return }
        if let v = data["notes"] {
            if v.value is NSNull { entry.notes = nil }
            else if let str = v.value as? String { entry.notes = str }
        }
    }

    private func applyJournalImageData(_ data: [String: AnyCodable]?, to image: JournalImage) {
        guard let data else { return }
        if let key = data["imageKey"]?.value as? String { image.imageKey = key }
        if let order = data["sortOrder"]?.value as? Int { image.sortOrder = order }
    }

    private func stringValue(_ data: [String: AnyCodable]?, key: String) -> String? {
        data?[key]?.value as? String
    }
}
