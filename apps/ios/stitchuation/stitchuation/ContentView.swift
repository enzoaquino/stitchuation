import SwiftUI

struct ContentView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    var body: some View {
        TabView {
            NavigationStack {
                ThreadListView()
            }
            .tabItem {
                Label("Inventory", systemImage: "tray.full")
            }

            NavigationStack {
                StashListView()
            }
            .tabItem {
                Label("Stitch Stash", systemImage: "square.stack.3d.up")
            }

            NavigationStack {
                ProjectListView()
            }
            .tabItem {
                Label("Projects", systemImage: "paintbrush.pointed")
            }

            NavigationStack {
                Text("Settings coming soon")
                    .font(.typeStyle(.body))
                    .foregroundStyle(Color.walnut)
                    .navigationTitle("Settings")
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
        }
        .tint(Color.terracotta)
    }
}
