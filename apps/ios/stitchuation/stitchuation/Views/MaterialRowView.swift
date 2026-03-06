import SwiftUI

struct MaterialRowView: View {
    @Bindable var material: PieceMaterial

    var body: some View {
        HStack(spacing: Spacing.md) {
            Button {
                material.acquired.toggle()
                material.updatedAt = Date()
            } label: {
                Image(systemName: material.acquired ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(material.acquired ? Color.sage : Color.slate)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(material.displayLine)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(material.acquired ? Color.clay : Color.espresso)
                    .strikethrough(material.acquired, color: Color.clay)

                if material.quantity > 0 || material.unit != nil {
                    HStack(spacing: Spacing.xs) {
                        if material.quantity > 0 {
                            Text("\(material.quantity)")
                                .font(.typeStyle(.data))
                                .foregroundStyle(Color.walnut)
                        }
                        if let unit = material.unit {
                            Text(unit)
                                .font(.typeStyle(.subheadline))
                                .foregroundStyle(Color.clay)
                        }
                    }
                }

                if material.threadId != nil {
                    Text("In your stash")
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.sage)
                }
            }

            Spacer()
        }
        .padding(.vertical, Spacing.sm)
        .contentShape(Rectangle())
    }
}
