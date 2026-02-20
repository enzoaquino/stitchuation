import SwiftUI
import SwiftData
#if canImport(UIKit)
import UIKit
#endif

@main
struct stitchuationApp: App {
    #if DEBUG
    private static let apiBaseURL = URL(string: "http://localhost:3000")!
    #else
    private static let apiBaseURL = URL(string: "https://api.stitchuation.com")!
    #endif

    private let networkClient = NetworkClient(baseURL: apiBaseURL)
    @State private var authViewModel: AuthViewModel?
    @State private var syncEngine: SyncEngine?
    @State private var uploadQueue: UploadQueue?
    private let modelContainer: ModelContainer

    init() {
        do {
            modelContainer = try ModelContainer(for: NeedleThread.self, StashCanvas.self, StitchProject.self, JournalEntry.self, JournalImage.self, PendingUpload.self)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            contentView
                .environment(\.networkClient, networkClient)
                .task {
                    let auth = AuthViewModel(networkClient: networkClient)
                    await auth.checkExistingSession()
                    authViewModel = auth

                    let queue = UploadQueue(modelContainer: modelContainer, networkClient: networkClient)
                    uploadQueue = queue

                    let engine = SyncEngine(
                        networkClient: networkClient,
                        modelContainer: modelContainer,
                        uploadQueue: queue
                    )
                    syncEngine = engine

                    if auth.isAuthenticated {
                        try? await engine.sync()
                    }
                }
                #if canImport(UIKit)
                .onReceive(NotificationCenter.default.publisher(
                    for: UIApplication.willEnterForegroundNotification
                )) { _ in
                    guard let syncEngine, authViewModel?.isAuthenticated == true else { return }
                    // SyncEngine.sync() processes the upload queue after completing
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
