import SwiftUI

enum AppTab: Hashable {
    case journal
    case stash
    case threads
    case settings
}

struct ContentView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var profileViewModel: ProfileViewModel?
    @State private var selectedTab: AppTab = .journal
    @State private var navigationCoordinator = NavigationCoordinator()

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $navigationCoordinator.journalPath) {
                ProjectListView()
            }
            .tag(AppTab.journal)
            .tabItem {
                Label("Journal", systemImage: "paintbrush.pointed")
            }

            NavigationStack {
                StashListView()
            }
            .tag(AppTab.stash)
            .tabItem {
                Label("Stash", systemImage: "square.stack.3d.up")
            }

            NavigationStack {
                ThreadListView()
            }
            .tag(AppTab.threads)
            .tabItem {
                Label("Threads", systemImage: "tray.full")
            }

            NavigationStack {
                if let profileViewModel {
                    SettingsView(authViewModel: authViewModel, profileViewModel: profileViewModel)
                }
            }
            .tag(AppTab.settings)
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
        .environment(navigationCoordinator)
        .tint(Color.terracotta)
        .onChange(of: navigationCoordinator.pendingProjectId) { _, newValue in
            if let pieceId = newValue {
                selectedTab = .journal
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    navigationCoordinator.journalPath.append(pieceId)
                    navigationCoordinator.pendingProjectId = nil
                }
            }
        }
        .task {
            let vm = ProfileViewModel(networkClient: networkClient)
            profileViewModel = vm
            await vm.loadProfile()
        }
    }
}
