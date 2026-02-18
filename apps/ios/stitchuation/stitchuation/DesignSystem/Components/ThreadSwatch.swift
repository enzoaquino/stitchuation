import SwiftUI

struct ThreadSwatch: View {
    let colorHex: String?
    var size: CGFloat = 24

    var body: some View {
        if let hex = colorHex {
            Circle()
                .fill(Color(hex: hex))
                .overlay(Circle().stroke(Color.slate, lineWidth: 0.5))
                .frame(width: size, height: size)
        } else {
            Circle()
                .fill(Color.parchment)
                .overlay {
                    Image(systemName: "questionmark")
                        .font(.system(size: size * 0.4))
                        .foregroundStyle(Color.clay)
                }
                .overlay(Circle().stroke(Color.slate, lineWidth: 0.5))
                .frame(width: size, height: size)
        }
    }
}
