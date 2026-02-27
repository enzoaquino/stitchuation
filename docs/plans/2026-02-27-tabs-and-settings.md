# Tabs Reorder & Settings Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorder and rename the bottom tab bar (Journal/Stash/Threads/Settings), default to Journal on launch, and build a Settings page with profile card, stats grid, and account actions.

**Architecture:** Tab reorder is a single-file edit in ContentView. Settings is a new `SettingsView` with profile data stored in `@AppStorage`, stats computed from SwiftData `@Query` results, and logout via the existing `AuthViewModel`. Profile editing is a sheet. No new models or API changes.

**Tech Stack:** SwiftUI, SwiftData, @AppStorage, design system tokens (Colors, Spacing, CornerRadius, Typography, Shadows)

---

### Task 1: Reorder and Rename Tabs in ContentView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift:1-42`

**Step 1: Rewrite ContentView with new tab order, names, and selection state**

Replace the entire contents of `ContentView.swift` with:

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
```

Key changes from the original:
- Added `AppTab` enum for tab selection
- `@State private var selectedTab: AppTab = .journal` — app opens to Journal
- Tab order: Journal (ProjectListView), Stash, Threads, Settings
- Renamed: "Projects" → "Journal", "Stitch Stash" → "Stash", "Inventory" → "Threads"
- Settings tab now references `SettingsView` (created in Task 2) instead of placeholder text
- Passes `authViewModel` to `SettingsView` for logout

**Note:** This will not compile until Task 2 creates `SettingsView`. If building incrementally, temporarily keep the placeholder `Text("Settings coming soon")` wrapped in a `NavigationStack` and replace it after Task 2.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): reorder tabs to Journal/Stash/Threads/Settings, default to Journal"
```

---

### Task 2: Create SettingsView with Profile Card

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/SettingsView.swift`

**Step 1: Create SettingsView**

Create the file at `apps/ios/stitchuation/stitchuation/Views/SettingsView.swift`:

```swift
import SwiftUI
import SwiftData

struct SettingsView: View {
    @Bindable var authViewModel: AuthViewModel

    @AppStorage("profileDisplayName") private var displayName = ""
    @AppStorage("profileBio") private var bio = ""
    @AppStorage("profileExperienceLevel") private var experienceLevel = "Beginner"

    @Query(filter: #Predicate<StitchPiece> { $0.deletedAt == nil })
    private var allPieces: [StitchPiece]

    @Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
    private var allThreads: [NeedleThread]

    @State private var showEditProfile = false

    static let experienceLevels = ["Beginner", "Intermediate", "Advanced", "Expert"]

    private var initials: String {
        let words = displayName.split(separator: " ")
        if words.count >= 2 {
            return String(words[0].prefix(1) + words[1].prefix(1)).uppercased()
        } else if let first = words.first {
            return String(first.prefix(2)).uppercased()
        }
        return "?"
    }

    // MARK: - Stats

    private var completedCount: Int {
        allPieces.filter { $0.statusRaw == "finished" }.count
    }

    private var activeCount: Int {
        allPieces.filter { $0.status.isActive }.count
    }

    private var stashCount: Int {
        allPieces.filter { $0.statusRaw == "stash" }.count
    }

    private var threadCount: Int {
        allThreads.count
    }

    private var completedThisYear: Int {
        let calendar = Calendar.current
        let startOfYear = calendar.date(from: calendar.dateComponents([.year], from: Date()))!
        return allPieces.filter { piece in
            piece.statusRaw == "finished" &&
            piece.completedAt != nil &&
            piece.completedAt! >= startOfYear
        }.count
    }

    private var memberSince: Date? {
        allPieces.map(\.createdAt).min()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                profileCard
                statsSection
                accountSection
            }
            .padding(.vertical, Spacing.lg)
        }
        .background(Color.linen)
        .navigationTitle("Settings")
        .sheet(isPresented: $showEditProfile) {
            EditProfileSheet(
                displayName: $displayName,
                bio: $bio,
                experienceLevel: $experienceLevel
            )
        }
    }

    // MARK: - Profile Card

    private var profileCard: some View {
        VStack(spacing: Spacing.md) {
            // Initials circle
            Text(initials)
                .font(.playfair(24, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(Color.terracotta)
                .clipShape(Circle())

            // Name
            if !displayName.isEmpty {
                Text(displayName)
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)
            } else {
                Text("Set Your Name")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.clay)
            }

            // Bio
            if !bio.isEmpty {
                Text(bio)
                    .font(.typeStyle(.body))
                    .foregroundStyle(Color.walnut)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }

            // Experience badge
            Text(experienceLevel)
                .font(.typeStyle(.footnote))
                .fontWeight(.medium)
                .foregroundStyle(Color.walnut)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(Color.terracottaMuted.opacity(0.4))
                .clipShape(Capsule())

            // Edit button
            Button {
                showEditProfile = true
            } label: {
                Text("Edit Profile")
                    .font(.typeStyle(.subheadline))
                    .fontWeight(.medium)
                    .foregroundStyle(Color.terracotta)
            }
            .padding(.top, Spacing.xs)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.xl)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
        .padding(.horizontal, Spacing.lg)
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Your Stitching")
                .font(.playfair(15, weight: .semibold))
                .foregroundStyle(Color.walnut)
                .padding(.horizontal, Spacing.lg)

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: Spacing.md),
                    GridItem(.flexible(), spacing: Spacing.md)
                ],
                spacing: Spacing.md
            ) {
                StatCard(value: "\(completedCount)", label: "Completed")
                StatCard(value: "\(activeCount)", label: "In Progress")
                StatCard(value: "\(stashCount)", label: "In Stash")
                StatCard(value: "\(threadCount)", label: "Threads")
                StatCard(value: "\(completedThisYear)", label: "This Year")
                if let memberSince {
                    StatCard(
                        value: memberSince.formatted(.dateTime.month(.abbreviated).year()),
                        label: "Member Since"
                    )
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        VStack(spacing: Spacing.md) {
            Button(role: .destructive) {
                Task { await authViewModel.logout() }
            } label: {
                HStack {
                    Spacer()
                    Text("Log Out")
                        .font(.typeStyle(.body))
                        .fontWeight(.medium)
                    Spacer()
                }
            }
            .padding(Spacing.lg)
            .background(Color.cream)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
            .warmShadow(.subtle)
            .padding(.horizontal, Spacing.lg)

            Text("Stitchuation v1.0")
                .font(.typeStyle(.footnote))
                .foregroundStyle(Color.clay)
                .padding(.bottom, Spacing.xl)
        }
    }
}

// MARK: - StatCard

struct StatCard: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Text(value)
                .font(.playfair(22, weight: .semibold))
                .foregroundStyle(Color.espresso)
            Text(label)
                .font(.typeStyle(.footnote))
                .foregroundStyle(Color.clay)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.lg)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
    }
}
```

**Step 2: Build and verify in simulator**

Navigate to Settings tab. Confirm:
- Profile card shows initials circle, "Set Your Name" placeholder, experience badge
- Stats section shows grid of stat cards with counts
- Log Out button at bottom
- Linen background, cream cards, design system typography throughout

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/SettingsView.swift
git commit -m "feat(ios): add SettingsView with profile card, stats grid, and logout"
```

---

### Task 3: Create EditProfileSheet

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift`

**Step 1: Create EditProfileSheet**

Create the file at `apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift`:

```swift
import SwiftUI

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Binding var displayName: String
    @Binding var bio: String
    @Binding var experienceLevel: String

    @State private var draftName: String = ""
    @State private var draftBio: String = ""
    @State private var draftLevel: String = ""

    init(displayName: Binding<String>, bio: Binding<String>, experienceLevel: Binding<String>) {
        _displayName = displayName
        _bio = bio
        _experienceLevel = experienceLevel
        _draftName = State(initialValue: displayName.wrappedValue)
        _draftBio = State(initialValue: bio.wrappedValue)
        _draftLevel = State(initialValue: experienceLevel.wrappedValue)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Name card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Profile")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            TextField("Display Name", text: $draftName)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            TextField("Bio (e.g. Needlepoint lover from Austin)", text: $draftBio, axis: .vertical)
                                .lineLimit(2...4)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Experience level card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Experience Level")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        HStack(spacing: Spacing.sm) {
                            ForEach(SettingsView.experienceLevels, id: \.self) { level in
                                Button {
                                    draftLevel = level
                                } label: {
                                    Text(level)
                                        .font(draftLevel == level
                                            ? .typeStyle(.footnote).weight(.medium)
                                            : .typeStyle(.footnote))
                                        .foregroundStyle(draftLevel == level ? .white : Color.walnut)
                                        .padding(.horizontal, Spacing.md)
                                        .padding(.vertical, Spacing.sm)
                                        .background(draftLevel == level ? Color.terracotta : Color.linen)
                                        .clipShape(Capsule())
                                        .overlay(
                                            Capsule()
                                                .stroke(
                                                    draftLevel == level ? Color.clear : Color.slate.opacity(0.3),
                                                    lineWidth: 1
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle("Edit Profile")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        displayName = draftName
                        bio = draftBio
                        experienceLevel = draftLevel
                        dismiss()
                    }
                    .disabled(draftName.isEmpty)
                    .foregroundStyle(Color.terracotta)
                }
            }
        }
    }
}
```

**Step 2: Build and verify in simulator**

- Tap "Edit Profile" on Settings page
- Sheet opens with name, bio fields and experience level chips
- Edit name, bio, select a level, tap Save
- Profile card updates with new values
- Cancel discards changes
- Kill and relaunch app — values persist via @AppStorage

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift
git commit -m "feat(ios): add EditProfileSheet with name, bio, and experience level"
```

---

### Task 4: Write Tests for SettingsView Stats Logic

**Files:**
- Create: `apps/ios/stitchuation/stitchuationTests/SettingsStatsTests.swift`

The stats logic in SettingsView is tightly coupled to `@Query` and `@AppStorage`, which aren't easily testable in isolation. Instead, we'll extract the initials computation and test that — it has the most non-trivial logic.

We'll also write a test for the experience levels constant.

**Step 1: Write the tests**

Create the file at `apps/ios/stitchuation/stitchuationTests/SettingsStatsTests.swift`:

```swift
import Testing
@testable import stitchuation

struct SettingsStatsTests {

    // MARK: - Initials

    @Test func initialsFromTwoWords() {
        let result = SettingsView.computeInitials(from: "Jane Doe")
        #expect(result == "JD")
    }

    @Test func initialsFromOneWord() {
        let result = SettingsView.computeInitials(from: "Jane")
        #expect(result == "JA")
    }

    @Test func initialsFromEmpty() {
        let result = SettingsView.computeInitials(from: "")
        #expect(result == "?")
    }

    @Test func initialsFromThreeWords() {
        let result = SettingsView.computeInitials(from: "Mary Jane Watson")
        #expect(result == "MJ")
    }

    @Test func initialsLowercaseNormalized() {
        let result = SettingsView.computeInitials(from: "jane doe")
        #expect(result == "JD")
    }

    // MARK: - Experience Levels

    @Test func experienceLevelsIncludeAllFour() {
        #expect(SettingsView.experienceLevels == ["Beginner", "Intermediate", "Advanced", "Expert"])
    }
}
```

**Step 2: Extract initials as a static function in SettingsView**

In `apps/ios/stitchuation/stitchuation/Views/SettingsView.swift`, replace the `initials` computed property with a static function and a computed property that calls it:

Find the `private var initials: String` block and replace it with:

```swift
    static func computeInitials(from name: String) -> String {
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return String(words[0].prefix(1) + words[1].prefix(1)).uppercased()
        } else if let first = words.first {
            return String(first.prefix(2)).uppercased()
        }
        return "?"
    }

    private var initials: String {
        Self.computeInitials(from: displayName)
    }
```

**Step 3: Build and run tests**

Run tests in Xcode (Cmd+U) or:
```bash
xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:stitchuationTests/SettingsStatsTests 2>&1 | tail -20
```

Expected: All 6 tests pass.

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuationTests/SettingsStatsTests.swift apps/ios/stitchuation/stitchuation/Views/SettingsView.swift
git commit -m "test(ios): add SettingsView initials computation tests"
```

---

### Task 5: Visual QA and Push

**Step 1: Full flow test in simulator**

1. Launch app — lands on Journal tab (not Inventory)
2. Tab bar shows: Journal, Stash, Threads, Settings (left to right)
3. Tap Settings — profile card with initials circle, experience badge, edit button
4. Tap "Edit Profile" — sheet with name, bio, experience chips
5. Fill in name "Jane Doe", bio "Needlepoint addict", select "Intermediate", save
6. Profile card shows "JD" initials, "Jane Doe", bio, "Intermediate" badge
7. Stats grid shows correct counts (may be 0 if no data)
8. Tap "Log Out" — returns to login screen
9. Log back in, go to Settings — profile persists (AppStorage)
10. Kill and relaunch — still lands on Journal, profile still there

**Step 2: Push**

```bash
git push
```
