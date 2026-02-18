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
    private let modelContainer: ModelContainer

    init() {
        do {
            modelContainer = try ModelContainer(for: NeedleThread.self)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            contentView
                .task {
                    let auth = AuthViewModel(networkClient: networkClient)
                    await auth.checkExistingSession()
                    authViewModel = auth

                    let engine = SyncEngine(
                        networkClient: networkClient,
                        modelContainer: modelContainer
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
