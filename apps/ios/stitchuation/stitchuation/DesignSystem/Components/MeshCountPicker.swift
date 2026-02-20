import SwiftUI

struct MeshCountPicker: View {
    @Binding var meshCount: String

    static let standardCounts = [10, 12, 13, 14, 18, 24]

    enum Selection: Equatable {
        case none
        case preset(Int)
        case custom
    }

    /// Exposed for testing — the selection derived from the initial meshCount value.
    let initialSelection: Selection

    @State private var selection: Selection
    @State private var chipScale: [Int: CGFloat] = [:]
    @State private var otherChipScale: CGFloat = 1.0
    @FocusState private var isCustomFieldFocused: Bool

    init(meshCount: Binding<String>) {
        self._meshCount = meshCount
        let value = Int(meshCount.wrappedValue)
        if let value, Self.standardCounts.contains(value) {
            self.initialSelection = .preset(value)
            self._selection = State(initialValue: .preset(value))
        } else if !meshCount.wrappedValue.isEmpty {
            self.initialSelection = .custom
            self._selection = State(initialValue: .custom)
        } else {
            self.initialSelection = .none
            self._selection = State(initialValue: .none)
        }
    }

    private var isCustomMode: Bool {
        selection == .custom
    }

    private var selectedPreset: Int? {
        if case .preset(let count) = selection { return count }
        return nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Mesh Count")
                .font(.typeStyle(.subheadline))
                .foregroundStyle(Color.walnut)

            chipRow

            if isCustomMode {
                HStack {
                    TextField("Enter mesh count", text: $meshCount)
                        .keyboardType(.numberPad)
                        .focused($isCustomFieldFocused)
                    Text("mesh")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.clay)
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    isCustomFieldFocused = true
                }
            }
        }
        .animation(Motion.gentle, value: isCustomMode)
    }

    private var chipRow: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(Self.standardCounts, id: \.self) { count in
                chipButton(for: count)
            }
            otherChipButton
        }
    }

    private func chipButton(for count: Int) -> some View {
        Button {
            selection = .preset(count)
            meshCount = "\(count)"
            withAnimation(Motion.bouncy) {
                chipScale[count] = 1.05
            }
            withAnimation(Motion.bouncy.delay(0.1)) {
                chipScale[count] = 1.0
            }
        } label: {
            Text("\(count)")
                .font(selectedPreset == count
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(selectedPreset == count ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(selectedPreset == count ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            selectedPreset == count ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(chipScale[count] ?? 1.0)
    }

    private var otherChipButton: some View {
        Button {
            selection = .custom
            meshCount = ""
            withAnimation(Motion.bouncy) {
                otherChipScale = 1.05
            }
            withAnimation(Motion.bouncy.delay(0.1)) {
                otherChipScale = 1.0
            }
        } label: {
            Text("Other")
                .font(isCustomMode
                    ? .typeStyle(.subheadline).weight(.medium)
                    : .typeStyle(.subheadline))
                .foregroundStyle(isCustomMode ? Color.cream : Color.walnut)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xs)
                .background(isCustomMode ? Color.terracotta : Color.linen)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isCustomMode ? Color.clear : Color.clay.opacity(0.3),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(otherChipScale)
    }
}
