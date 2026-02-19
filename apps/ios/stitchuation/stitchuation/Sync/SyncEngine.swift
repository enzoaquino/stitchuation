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
    private static let lastSyncKey = "lastSyncTimestamp"

    private(set) var isSyncing = false
    private(set) var lastSyncTimestamp: String? {
        didSet { UserDefaults.standard.set(lastSyncTimestamp, forKey: Self.lastSyncKey) }
    }

    init(networkClient: NetworkClient, modelContainer: ModelContainer) {
        self.networkClient = networkClient
        self.modelContainer = modelContainer
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

        // Gather unsynced canvases
        let allCanvasDescriptor = FetchDescriptor<StashCanvas>()
        let allCanvases = try context.fetch(allCanvasDescriptor)
        let unsyncedCanvases = allCanvases.filter { canvas in
            canvas.syncedAt == nil || canvas.updatedAt > (canvas.syncedAt ?? .distantPast)
        }

        let canvasChanges: [SyncChange] = unsyncedCanvases.map { canvas in
            let isDeleted = canvas.deletedAt != nil
            var data: [String: AnyCodable]?
            if !isDeleted {
                data = [
                    "designer": AnyCodable(canvas.designer),
                    "designName": AnyCodable(canvas.designName),
                    "acquiredAt": AnyCodable(canvas.acquiredAt.map { formatter.string(from: $0) } ?? NSNull()),
                    "imageKey": AnyCodable(canvas.imageKey ?? NSNull()),
                    "size": AnyCodable(canvas.size ?? NSNull()),
                    "meshCount": AnyCodable(canvas.meshCount ?? NSNull()),
                    "notes": AnyCodable(canvas.notes ?? NSNull()),
                ]
            }
            return SyncChange(
                type: "canvas",
                action: isDeleted ? "delete" : "upsert",
                id: canvas.id.uuidString,
                data: data,
                updatedAt: formatter.string(from: canvas.updatedAt),
                deletedAt: canvas.deletedAt.map { formatter.string(from: $0) }
            )
        }

        let request = SyncRequest(lastSync: lastSyncTimestamp, changes: threadChanges + canvasChanges)
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
            } else if change.type == "canvas" {
                let fetchDescriptor = FetchDescriptor<StashCanvas>(
                    predicate: #Predicate { $0.id == uuid }
                )
                let existing = try context.fetch(fetchDescriptor).first

                if change.action == "delete" {
                    if let canvas = existing {
                        guard serverUpdatedAt >= canvas.updatedAt else { continue }
                        canvas.deletedAt = formatter.date(from: change.deletedAt ?? change.updatedAt)
                        canvas.updatedAt = serverUpdatedAt
                        canvas.syncedAt = Date()
                    }
                } else if change.action == "upsert" {
                    if let canvas = existing {
                        guard serverUpdatedAt >= canvas.updatedAt else { continue }
                        applyCanvasData(change.data, to: canvas)
                        canvas.updatedAt = serverUpdatedAt
                        canvas.syncedAt = Date()
                    } else {
                        let canvas = StashCanvas(
                            id: uuid,
                            designer: stringValue(change.data, key: "designer") ?? "",
                            designName: stringValue(change.data, key: "designName") ?? ""
                        )
                        applyCanvasData(change.data, to: canvas)
                        canvas.updatedAt = serverUpdatedAt
                        canvas.syncedAt = Date()
                        context.insert(canvas)
                    }
                }
            }
        }

        // Mark all pushed changes as synced
        for thread in unsynced {
            thread.syncedAt = Date()
        }
        for canvas in unsyncedCanvases {
            canvas.syncedAt = Date()
        }

        try context.save()
        lastSyncTimestamp = response.serverTimestamp
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

    private func applyCanvasData(_ data: [String: AnyCodable]?, to canvas: StashCanvas) {
        guard let data else { return }
        if let designer = data["designer"]?.value as? String { canvas.designer = designer }
        if let designName = data["designName"]?.value as? String { canvas.designName = designName }
        if let v = data["acquiredAt"] {
            if v.value is NSNull {
                canvas.acquiredAt = nil
            } else if let str = v.value as? String {
                canvas.acquiredAt = Self.dateFormatter.date(from: str)
            }
        }
        if let v = data["imageKey"] {
            canvas.imageKey = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["size"] {
            canvas.size = v.value is NSNull ? nil : v.value as? String
        }
        if let v = data["meshCount"] {
            if v.value is NSNull {
                canvas.meshCount = nil
            } else if let num = v.value as? Int {
                canvas.meshCount = num
            }
        }
        if let v = data["notes"] {
            canvas.notes = v.value is NSNull ? nil : v.value as? String
        }
    }

    private func stringValue(_ data: [String: AnyCodable]?, key: String) -> String? {
        data?[key]?.value as? String
    }
}
