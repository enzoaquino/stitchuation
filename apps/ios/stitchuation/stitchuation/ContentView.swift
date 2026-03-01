import SwiftUI

enum AppTab: Hashable {
    case journal
    case stash
    case shopping
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
            NavigationStack {
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
                ShoppingListView()
            }
            .tag(AppTab.shopping)
            .tabItem {
                Label("Shopping", systemImage: "cart")
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
        .fullScreenCover(item: $navigationCoordinator.presentedProjectId) { identifier in
            NavigationStack {
                ProjectDetailView(pieceId: identifier.id)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") {
                                navigationCoordinator.presentedProjectId = nil
                                selectedTab = .journal
                            }
                            .foregroundStyle(Color.terracotta)
                        }
                    }
            }
            .environment(navigationCoordinator)
        }
        .onChange(of: navigationCoordinator.switchToTab) { _, newValue in
            if let tab = newValue {
                selectedTab = tab
                navigationCoordinator.switchToTab = nil
            }
        }
        .task {
            let vm = ProfileViewModel(networkClient: networkClient)
            profileViewModel = vm
            await vm.loadProfile()
        }
    }
}
