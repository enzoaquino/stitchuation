import UIKit

extension UIImage {
    /// Samples the average color from a region around the given point.
    /// Coordinates are in the image's point space (0...size.width, 0...size.height).
    /// Averages a small region around the point for noise reduction.
    func averageColor(at point: CGPoint, radius: Int = 2) -> (color: UIColor, hex: String)? {
        guard let cgImage else { return nil }

        let pixelX = Int(point.x * scale)
        let pixelY = Int(point.y * scale)
        let width = cgImage.width
        let height = cgImage.height

        guard pixelX >= 0, pixelX < width, pixelY >= 0, pixelY < height else { return nil }

        let bytesPerPixel = 4
        let bytesPerRow = width * bytesPerPixel
        var pixelData = [UInt8](repeating: 0, count: width * height * bytesPerPixel)

        guard let context = CGContext(
            data: &pixelData,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        var totalR = 0.0, totalG = 0.0, totalB = 0.0
        var count = 0

        let minX = max(0, pixelX - radius)
        let maxX = min(width - 1, pixelX + radius)
        let minY = max(0, pixelY - radius)
        let maxY = min(height - 1, pixelY + radius)

        for y in minY...maxY {
            for x in minX...maxX {
                let offset = (y * bytesPerRow) + (x * bytesPerPixel)
                totalR += Double(pixelData[offset])
                totalG += Double(pixelData[offset + 1])
                totalB += Double(pixelData[offset + 2])
                count += 1
            }
        }

        guard count > 0 else { return nil }

        let r = Int(totalR / Double(count))
        let g = Int(totalG / Double(count))
        let b = Int(totalB / Double(count))

        let color = UIColor(red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: 1)
        let hex = String(format: "#%02X%02X%02X", r, g, b)

        return (color, hex)
    }
}
