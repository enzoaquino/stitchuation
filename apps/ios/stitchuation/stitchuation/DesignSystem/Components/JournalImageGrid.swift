import SwiftUI

struct JournalImageGrid: View {
    let images: [JournalImage]
    let onTap: (Int) -> Void

    private var sortedImages: [JournalImage] {
        images
            .filter { $0.deletedAt == nil && !$0.imageKey.isEmpty }
            .sorted { $0.sortOrder < $1.sortOrder }
    }

    var body: some View {
        let count = sortedImages.count
        if count == 0 { EmptyView() }
        else if count == 1 { singleLayout }
        else if count == 2 { doubleLayout }
        else if count == 3 { tripleLayout }
        else { quadLayout }
    }

    // MARK: - Layouts

    private var singleLayout: some View {
        gridCell(index: 0)
            .frame(height: 200)
            .frame(maxWidth: .infinity)
            .clipped()
    }

    private var doubleLayout: some View {
        HStack(spacing: Spacing.xs) {
            gridCell(index: 0)
            gridCell(index: 1)
        }
        .frame(height: 160)
        .clipped()
    }

    private var tripleLayout: some View {
        HStack(spacing: Spacing.xs) {
            gridCell(index: 0)
                .frame(maxWidth: .infinity)

            VStack(spacing: Spacing.xs) {
                gridCell(index: 1)
                gridCell(index: 2)
            }
            .frame(maxWidth: .infinity)
        }
        .frame(height: 200)
        .clipped()
    }

    private var quadLayout: some View {
        VStack(spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                gridCell(index: 0)
                gridCell(index: 1)
            }
            HStack(spacing: Spacing.xs) {
                gridCell(index: 2)
                gridCell(index: 3)
            }
        }
        .frame(height: 200)
        .clipped()
    }

    // MARK: - Grid Cell

    @ViewBuilder
    private func gridCell(index: Int) -> some View {
        let image = sortedImages[index]
        Button {
            onTap(index)
        } label: {
            CanvasThumbnail(imageKey: image.imageKey, size: .fill)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
        }
        .buttonStyle(.plain)
    }
}
