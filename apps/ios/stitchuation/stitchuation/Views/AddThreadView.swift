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
    @State private var format: ThreadFormat? = .card
    @State private var pickerColor: Color = .white
    @State private var quantity = 1
    @State private var barcode = ""
    @State private var weightOrLength = ""
    @State private var lotNumber = ""
    @State private var notes = ""
    @State private var addAnother = false
    @State private var showColorSampler = false

    private var isValidHex: Bool {
        colorHex.isEmpty || colorHex.range(of: "^#?[0-9A-Fa-f]{6}$", options: .regularExpression) != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    BrandPicker(text: $brand)
                    ValidatedTextField("Number (e.g. 310)", text: $number)
                    TextField("Color Name", text: $colorName)
                    HStack {
                        TextField("Color Hex (#000000)", text: $colorHex)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .onChange(of: colorHex) { _, newValue in
                                guard !newValue.isEmpty else { return }
                                let hex = newValue.hasPrefix("#") ? newValue : "#\(newValue)"
                                if hex.range(of: "^#[0-9A-Fa-f]{6}$", options: .regularExpression) != nil {
                                    pickerColor = Color(hex: hex)
                                }
                            }
                        ColorPicker("", selection: $pickerColor, supportsOpacity: false)
                            .labelsHidden()
                            .frame(width: 30, height: 30)
                            .onChange(of: pickerColor) { _, newColor in
                                colorHex = newColor.hexString
                            }
                        Button {
                            showColorSampler = true
                        } label: {
                            Image(systemName: "eyedropper")
                                .foregroundStyle(Color.terracotta)
                        }
                        .buttonStyle(.plain)
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
                    Picker("Format", selection: $format) {
                        Text("None").tag(ThreadFormat?.none)
                        ForEach(ThreadFormat.allCases, id: \.self) { fmt in
                            Text(fmt.displayName).tag(ThreadFormat?.some(fmt))
                        }
                    }
                    TextField("Lot #", text: $lotNumber)
                } header: {
                    Text("Thread Info")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
                .listRowBackground(Color.parchment)

                Section {
                    Stepper("\(quantity)", value: $quantity, in: 0...999)
                } header: {
                    Text("Quantity")
                        .font(.playfair(15, weight: .semibold))
                        .foregroundStyle(Color.walnut)
                        .textCase(nil)
                }
                .listRowBackground(Color.parchment)

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
                .listRowBackground(Color.parchment)

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
            .sheet(isPresented: $showColorSampler) {
                ColorSamplerView { hex in
                    colorHex = hex
                    pickerColor = Color(hex: hex)
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
            format: format,
            quantity: quantity,
            barcode: barcode.isEmpty ? nil : barcode,
            weightOrLength: weightOrLength.isEmpty ? nil : weightOrLength,
            lotNumber: lotNumber.isEmpty ? nil : lotNumber,
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
            lotNumber = ""
            notes = ""
        } else {
            dismiss()
        }
    }
}
