import SwiftUI

struct AddMaterialView: View {
    let piece: StitchPiece
    var editing: PieceMaterial? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("Coming soon")
                .navigationTitle(editing != nil ? "Edit Material" : "Add Material")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                            .foregroundStyle(Color.terracotta)
                    }
                }
        }
    }
}
