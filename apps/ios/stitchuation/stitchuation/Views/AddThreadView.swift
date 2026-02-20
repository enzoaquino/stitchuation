import SwiftUI
import SwiftData

struct AddThreadView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var brand = ""
    @State private var number = ""
    @State private var colorName = ""
    @State private var colorHex = ""
    @State private var fiberType: FiberType = .wool
    @State private var quantity = 1
    @State private var barcode = ""
    @State private var weightOrLength = ""
    @State private var notes = ""
    @State private var addAnother = false

    private var isValidHex: Bool {
        colorHex.isEmpty || colorHex.range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Brand (e.g. DMC)", text: $brand)
                    TextField("Number (e.g. 310)", text: $number)
                    TextField("Color Name", text: $colorName)
                    HStack {
                        TextField("Color Hex (#000000)", text: $colorHex)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                        if !colorHex.isEmpty && isValidHex {
                            let hex = colorHex.hasPrefix("#") ? colorHex : "#\(colorHex)"
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 24, height: 24)
                                .overlay(Circle().stroke(Color.clay.opacity(0.3), lineWidth: 0.5))
                        }
                    }
                    if !isValidHex {
                        Text("Enter a valid 6-digit hex color")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.terracotta)
                    }
                    Picker("Fiber Type", selection: $fiberType) {
                        ForEach(FiberType.allCases, id: \.self) { type in
                            Text(type.rawValue.capitalized).tag(type)
                        }
                    }
                } header: {
                    Text("Thread Info")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    Stepper("\(quantity)", value: $quantity, in: 0...999)
                } header: {
                    Text("Quantity")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Section {
                    TextField("Barcode / UPC", text: $barcode)
                    TextField("Weight or Length", text: $weightOrLength)
                    TextField("Notes", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Optional")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }

                Toggle("Add Another", isOn: $addAnother)
            }
            .font(.typeStyle(.body))
            .scrollContentBackground(.hidden)
            .background(Color.linen)
            .navigationTitle("Add Thread")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveThread() }
                        .disabled(brand.isEmpty || number.isEmpty || !isValidHex)
                        .foregroundStyle(Color.terracotta)
                }
            }
        }
    }

    private func saveThread() {
        let normalizedHex: String? = {
            guard !colorHex.isEmpty else { return nil }
            return colorHex.hasPrefix("#") ? colorHex : "#\(colorHex)"
        }()

        let thread = NeedleThread(
            brand: brand,
            number: number,
            colorName: colorName.isEmpty ? nil : colorName,
            colorHex: normalizedHex,
            fiberType: fiberType,
            quantity: quantity,
            barcode: barcode.isEmpty ? nil : barcode,
            weightOrLength: weightOrLength.isEmpty ? nil : weightOrLength,
            notes: notes.isEmpty ? nil : notes
        )
        modelContext.insert(thread)

        if addAnother {
            number = ""
            colorName = ""
            colorHex = ""
            quantity = 1
            barcode = ""
            weightOrLength = ""
            notes = ""
        } else {
            dismiss()
        }
    }
}
