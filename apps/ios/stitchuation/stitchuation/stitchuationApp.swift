import SwiftUI
import SwiftData
#if canImport(UIKit)
import UIKit
#endif

@main
struct stitchuationApp: App {
    #if targetEnvironment(simulator)
    private static let apiBaseURL = URL(string: "http://localhost:3000")!
    #else
    private static let apiBaseURL = URL(string: "https://api.dev.stitchuation.app")!
    #endif

    private let networkClient = NetworkClient(baseURL: apiBaseURL)
    @State private var authViewModel: AuthViewModel?
    @State private var syncEngine: SyncEngine?
    @State private var uploadQueue: UploadQueue?
    private let modelContainer: ModelContainer

    init() {
        let schema = Schema([NeedleThread.self, StitchPiece.self, JournalEntry.self, JournalImage.self, PendingUpload.self, PieceMaterial.self])
        let config = ModelConfiguration(schema: schema)
        do {
            modelContainer = try ModelContainer(for: schema, configurations: [config])
        } catch {
            // Schema changed (status → statusRaw migration) — destroy and recreate store
            let storeURL = config.url
            try? FileManager.default.removeItem(at: storeURL)
            // Also remove WAL/SHM files
            try? FileManager.default.removeItem(at: storeURL.appendingPathExtension("wal"))
            try? FileManager.default.removeItem(at: storeURL.appendingPathExtension("shm"))
            do {
                modelContainer = try ModelContainer(for: schema, configurations: [config])
            } catch {
                fatalError("Failed to create ModelContainer after reset: \(error)")
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            contentView
                .environment(\.networkClient, networkClient)
                .task {
                    // Detect fresh install: empty DB means any persisted state is stale
                    // (Simulator may clear Keychain but keep UserDefaults across reinstalls)
                    let context = modelContainer.mainContext
                    let threadCount = (try? context.fetchCount(FetchDescriptor<NeedleThread>())) ?? 0
                    let pieceCount = (try? context.fetchCount(FetchDescriptor<StitchPiece>())) ?? 0
                    if threadCount == 0 && pieceCount == 0 {
                        await networkClient.clearTokens()
                        UserDefaults.standard.removeObject(forKey: "lastSyncTimestamp")
                    }

                    let auth = AuthViewModel(networkClient: networkClient)
                    await auth.checkExistingSession()

                    let queue = UploadQueue(modelContainer: modelContainer, networkClient: networkClient)
                    uploadQueue = queue

                    let engine = SyncEngine(
                        networkClient: networkClient,
                        modelContainer: modelContainer,
                        uploadQueue: queue
                    )
                    syncEngine = engine

                    // Set authViewModel LAST so syncEngine is ready when ContentView appears
                    authViewModel = auth
                }
                #if canImport(UIKit)
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.willEnterForegroundNotification
                )) { _ in
                    guard let syncEngine, authViewModel?.isAuthenticated == true else { return }
                    Task { try? await syncEngine.sync() }
                }
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.didEnterBackgroundNotification
                )) { _ in
                    guard let syncEngine, authViewModel?.isAuthenticated == true else { return }
                    // Push pending changes before the app is suspended
                    Task { try? await syncEngine.sync() }
                }
                #endif
        }
        .modelContainer(modelContainer)
    }

    @ViewBuilder
    private var contentView: some View {
        if let authViewModel {
            if authViewModel.isAuthenticated {
                ContentView(networkClient: networkClient, authViewModel: authViewModel)
                    .task {
                        guard let syncEngine else { return }
                        try? await syncEngine.sync()
                    }
            } else {
                LoginView(networkClient: networkClient, authViewModel: authViewModel)
            }
        } else {
            ZStack {
                Color.linen.ignoresSafeArea()
                ProgressView()
                    .tint(Color.terracotta)
            }
        }
    }
}
