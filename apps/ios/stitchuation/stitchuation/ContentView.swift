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
                Text("Projects coming soon")
                    .font(.sourceSerif(17))
                    .foregroundStyle(Color.walnut)
                    .navigationTitle("Projects")
            }
            .tabItem {
                Label("Projects", systemImage: "folder")
            }

            NavigationStack {
                Text("Settings coming soon")
                    .font(.sourceSerif(17))
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
