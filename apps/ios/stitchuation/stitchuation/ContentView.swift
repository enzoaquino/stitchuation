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

    @State private var selectedTab: AppTab = .journal

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
                ThreadListView()
            }
            .tag(AppTab.threads)
            .tabItem {
                Label("Threads", systemImage: "tray.full")
            }

            NavigationStack {
                SettingsView(authViewModel: authViewModel)
            }
            .tag(AppTab.settings)
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
        .tint(Color.terracotta)
    }
}
