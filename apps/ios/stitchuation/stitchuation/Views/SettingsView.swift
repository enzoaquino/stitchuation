import SwiftUI
import SwiftData

struct SettingsView: View {
    @Bindable var authViewModel: AuthViewModel
    @Bindable var profileViewModel: ProfileViewModel

    @Query(filter: #Predicate<StitchPiece> { $0.deletedAt == nil })
    private var allPieces: [StitchPiece]

    @Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
    private var allThreads: [NeedleThread]

    @State private var showEditProfile = false

    static let experienceLevels = ["Beginner", "Intermediate", "Advanced", "Expert"]

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
        Self.computeInitials(from: profileViewModel.displayName)
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
            EditProfileSheet(profileViewModel: profileViewModel)
        }
    }

    // MARK: - Profile Card

    private var profileCard: some View {
        VStack(spacing: Spacing.md) {
            Text(initials)
                .font(.playfair(24, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 64, height: 64)
                .background(Color.terracotta)
                .clipShape(Circle())

            if !profileViewModel.displayName.isEmpty {
                Text(profileViewModel.displayName)
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)
            } else {
                Text("Set Your Name")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.clay)
            }

            if !profileViewModel.bio.isEmpty {
                Text(profileViewModel.bio)
                    .font(.typeStyle(.body))
                    .foregroundStyle(Color.walnut)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }

            Text(profileViewModel.experienceLevel)
                .font(.typeStyle(.footnote))
                .fontWeight(.medium)
                .foregroundStyle(Color.walnut)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.xs)
                .background(Color.terracottaMuted.opacity(0.4))
                .clipShape(Capsule())

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
