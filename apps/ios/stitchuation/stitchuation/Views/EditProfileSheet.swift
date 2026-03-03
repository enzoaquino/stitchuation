import SwiftUI

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Bindable var profileViewModel: ProfileViewModel

    @State private var draftName: String = ""
    @State private var draftBio: String = ""
    @State private var draftLevel: String = ""
    @State private var isSaving = false

    init(profileViewModel: ProfileViewModel) {
        self.profileViewModel = profileViewModel
        _draftName = State(initialValue: profileViewModel.displayName)
        _draftBio = State(initialValue: profileViewModel.bio)
        _draftLevel = State(initialValue: profileViewModel.experienceLevel)
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
                            ValidatedTextField("Display Name", text: $draftName)

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
                    Button {
                        isSaving = true
                        Task {
                            await profileViewModel.saveProfile(
                                displayName: draftName,
                                bio: draftBio,
                                experienceLevel: draftLevel
                            )
                            isSaving = false
                            dismiss()
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(Color.terracotta)
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(draftName.isEmpty || isSaving)
                    .foregroundStyle(Color.terracotta)
                }
            }
        }
    }
}
