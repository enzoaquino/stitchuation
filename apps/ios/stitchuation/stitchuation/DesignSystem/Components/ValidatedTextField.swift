import SwiftUI

struct ValidatedTextField: View {
    let placeholder: String
    @Binding var text: String
    let isRequired: Bool

    @FocusState private var isFocused: Bool
    @State private var hasBeenTouched = false

    /// Determines whether the error state should show.
    /// Extracted as static so unit tests can verify the logic without needing @State.
    static func shouldShowError(isRequired: Bool, hasBeenTouched: Bool, text: String) -> Bool {
        isRequired && hasBeenTouched && text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var showError: Bool {
        Self.shouldShowError(isRequired: isRequired, hasBeenTouched: hasBeenTouched, text: text)
    }

    init(_ placeholder: String, text: Binding<String>, isRequired: Bool = true) {
        self.placeholder = placeholder
        self._text = text
        self.isRequired = isRequired
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            TextField(placeholder, text: $text)
                .font(.typeStyle(.body))
                .focused($isFocused)
                .onChange(of: isFocused) { wasFocused, nowFocused in
                    if wasFocused && !nowFocused {
                        hasBeenTouched = true
                    }
                }
                .padding(.vertical, Spacing.md)
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.subtle)
                        .stroke(showError ? Color.dustyRose : Color.clear, lineWidth: 1)
                )

            if showError {
                Text("Required")
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.dustyRose)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showError)
    }
}
