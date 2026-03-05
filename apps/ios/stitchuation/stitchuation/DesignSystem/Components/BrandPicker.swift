import SwiftUI
import SwiftData

struct BrandPicker: View {
    @Binding var text: String
    @Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
    private var threads: [NeedleThread]

    @FocusState private var isFocused: Bool
    @State private var hasBeenTouched = false

    private static let knownBrands: [String] = [
        "Access Commodities", "Brenda Stofft", "Brown Paper Packages",
        "Burmilana", "Caron", "Caron Collection", "DMC",
        "DebBee's Designs", "Dinky Dyes", "EdMar",
        "Enriched Threads", "Fleur de Paris", "Gloriana Threads",
        "Gone Stitching", "KC Needlepoint", "Kreinik",
        "Little House Needleworks", "Love MHB Studio",
        "Nashville Needleworks", "Needlepoint Inc.",
        "Planet Earth Fiber", "Rainbow Gallery", "River Silks",
        "Silk & Ivory", "Silk Road Fibers", "Stitching Fox",
        "The Collection", "The Gentle Arts", "The Meredith Collection",
        "The Needle Works", "ThreadworX", "Tilli Tomas",
        "Treenway Silks", "Weeks Dye Works", "Wiltex Threads",
        "Yarn Tree",
    ]

    private var allBrands: [String] {
        let userBrands = Set(threads.map(\.brand))
        let combined = Set(Self.knownBrands).union(userBrands)
        return combined.sorted()
    }

    private var suggestions: [String] {
        guard isFocused, !text.isEmpty else { return [] }
        let query = text.lowercased()
        return allBrands.filter { $0.lowercased().contains(query) && $0 != text }
    }

    private var showError: Bool {
        hasBeenTouched && text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                TextField("Brand (e.g. DMC)", text: $text)
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

            if !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(suggestions.prefix(5), id: \.self) { brand in
                        Button {
                            text = brand
                            isFocused = false
                        } label: {
                            Text(brand)
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.espresso)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, Spacing.sm)
                                .padding(.horizontal, Spacing.md)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Color.parchment)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
            }
        }
    }
}
