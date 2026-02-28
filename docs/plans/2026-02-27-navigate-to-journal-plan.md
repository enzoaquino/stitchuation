# Navigate to Journal After Starting Project — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user starts a project (from Stash detail or Journal's "Start Project" sheet), switch to the Journal tab and navigate into ProjectDetailView for that piece.

**Architecture:** An `@Observable` `NavigationCoordinator` holds a `pendingProjectId`. Views that start projects set it. `ContentView` reacts by switching tabs, and `ProjectListView` reacts by pushing into its NavigationStack via a `NavigationPath`.

**Tech Stack:** SwiftUI, Swift Observation (`@Observable`), SwiftData

---

### Task 1: Create NavigationCoordinator

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Navigation/NavigationCoordinator.swift`

**Step 1: Create the coordinator**

```swift
import SwiftUI

@Observable
final class NavigationCoordinator {
    var pendingProjectId: UUID?
}
```

That's the entire file. No environment key needed — we'll pass it via `.environment()` since `@Observable` works directly.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Navigation/NavigationCoordinator.swift
git commit -m "feat(ios): add NavigationCoordinator for cross-tab navigation"
```

---

### Task 2: Wire NavigationCoordinator into ContentView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift`

**Step 1: Add coordinator state and inject into environment**

Add a `@State private var navigationCoordinator = NavigationCoordinator()` property to `ContentView`.

Inject it into the TabView's environment: `.environment(navigationCoordinator)`.

Add an `.onChange(of: navigationCoordinator.pendingProjectId)` modifier that switches `selectedTab = .journal` when a pending ID is set.

The full updated `ContentView`:

```swift
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
            if newValue != nil {
                selectedTab = .journal
            }
        }
        .task {
            let vm = ProfileViewModel(networkClient: networkClient)
            profileViewModel = vm
            await vm.loadProfile()
        }
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): wire NavigationCoordinator into ContentView with tab switching"
```

---

### Task 3: ProjectListView consumes pending navigation

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift`

**Step 1: Add NavigationPath and consume pendingProjectId**

Replace the implicit navigation with a `NavigationPath` so we can programmatically push. The `ProjectListView` is inside a `NavigationStack` in `ContentView`, but to use programmatic navigation we need to move the `NavigationStack` here (or use `navigationDestination(isPresented:)`).

Simplest approach: add `@State private var navigationPath = NavigationPath()` and have `ContentView` pass it, OR use `.onChange` to react. Since `ProjectListView` is inside the `NavigationStack` already (defined in `ContentView`), we need the `NavigationStack` in `ContentView` to use the path.

**Better approach:** Move the `NavigationStack(path:)` binding to `ContentView` for the journal tab, and pass the path down. But that couples them.

**Simplest approach:** Use `navigationDestination(item:)` with a binding. Since `NavigationCoordinator` is in the environment, `ProjectListView` can read it and use `.navigationDestination(item:)`.

Actually the cleanest SwiftUI pattern: keep the `NavigationStack` in `ContentView` but give it a `path` binding owned by the coordinator. Here's the approach:

**Update NavigationCoordinator** to also hold `journalPath`:

```swift
import SwiftUI

@Observable
final class NavigationCoordinator {
    var pendingProjectId: UUID?
    var journalPath = NavigationPath()
}
```

**Update ContentView** journal tab to use `NavigationStack(path:)`:

Change:
```swift
NavigationStack {
    ProjectListView()
}
```
To:
```swift
NavigationStack(path: $navigationCoordinator.journalPath) {
    ProjectListView()
}
```

**Update ContentView** `.onChange` to also push the ID onto the path:

```swift
.onChange(of: navigationCoordinator.pendingProjectId) { _, newValue in
    if let pieceId = newValue {
        selectedTab = .journal
        // Small delay to let tab switch complete before pushing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            navigationCoordinator.journalPath.append(pieceId)
            navigationCoordinator.pendingProjectId = nil
        }
    }
}
```

**Full updated files:**

`NavigationCoordinator.swift`:
```swift
import SwiftUI

@Observable
final class NavigationCoordinator {
    var pendingProjectId: UUID?
    var journalPath = NavigationPath()
}
```

`ContentView.swift` — the journal `NavigationStack` becomes:
```swift
NavigationStack(path: $navigationCoordinator.journalPath) {
    ProjectListView()
}
```

And the `.onChange`:
```swift
.onChange(of: navigationCoordinator.pendingProjectId) { _, newValue in
    if let pieceId = newValue {
        selectedTab = .journal
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            navigationCoordinator.journalPath.append(pieceId)
            navigationCoordinator.pendingProjectId = nil
        }
    }
}
```

No changes needed to `ProjectListView` itself — it already has `.navigationDestination(for: UUID.self)` which handles the pushed value.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Navigation/NavigationCoordinator.swift apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): programmatic journal navigation via NavigationPath"
```

---

### Task 4: CanvasDetailView triggers navigation on "Start Project"

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift`

**Step 1: Read coordinator from environment and set pendingProjectId**

Add `@Environment(NavigationCoordinator.self) private var navigationCoordinator` to `CanvasDetailView`.

Update the "Start Project" button action (lines 72-74) to also trigger navigation and dismiss:

```swift
Button {
    piece.status = .kitting
    piece.startedAt = Date()
    piece.updatedAt = Date()
    navigationCoordinator.pendingProjectId = piece.id
    dismiss()
} label: {
    Text("Start Project")
        .font(.typeStyle(.headline))
        .fontWeight(.semibold)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.md)
        .background(Color.terracotta)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/CanvasDetailView.swift
git commit -m "feat(ios): Start Project button navigates to journal"
```

---

### Task 5: StartProjectSheet triggers navigation

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift` (contains `StartProjectSheet`)

**Step 1: Update StartProjectSheet to set pendingProjectId**

Add `@Environment(NavigationCoordinator.self) private var navigationCoordinator` to `StartProjectSheet`.

Update the `startProject` function:

```swift
private func startProject(_ piece: StitchPiece) {
    piece.status = .kitting
    piece.startedAt = Date()
    piece.updatedAt = Date()
    dismiss()
    navigationCoordinator.pendingProjectId = piece.id
}
```

Note: the sheet dismiss happens first, then the coordinator triggers the push. Since the sheet is presented from ProjectListView (which is already on the Journal tab), the `.onChange` in ContentView won't switch tabs (already on journal) but will push the ProjectDetailView.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ProjectListView.swift
git commit -m "feat(ios): StartProjectSheet navigates to project detail after starting"
```

---

### Task 6: Test on device and verify

**Step 1: Build and run**

Build the project in Xcode. Verify no compilation errors.

**Step 2: Test flow from Stash tab**

1. Open Stash tab
2. Tap a canvas in `.stash` status
3. Tap "Start Project"
4. Verify: app switches to Journal tab and navigates into ProjectDetailView for that piece
5. Tap back — should return to ProjectListView on the Journal tab

**Step 3: Test flow from Journal tab**

1. Open Journal tab
2. Tap "+" to open StartProjectSheet
3. Pick a stash piece
4. Verify: sheet dismisses and navigates into ProjectDetailView for that piece
5. Tap back — should return to ProjectListView

**Step 4: Test edge case — no stash items**

1. If all pieces are already projects, verify both flows handle this gracefully (no crash)

**Step 5: Final commit (squash or leave as-is)**

All changes should already be committed from Tasks 1-5.
