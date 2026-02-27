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
