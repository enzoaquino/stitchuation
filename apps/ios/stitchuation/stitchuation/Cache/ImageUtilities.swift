import UIKit

/// Compresses image data to JPEG, iteratively reducing quality until under maxBytes.
func compressImage(_ data: Data, maxBytes: Int) -> Data {
    guard let uiImage = UIImage(data: data) else { return data }
    var quality: CGFloat = 0.8
    var compressed = uiImage.jpegData(compressionQuality: quality) ?? data
    while compressed.count > maxBytes && quality > 0.1 {
        quality -= 0.1
        compressed = uiImage.jpegData(compressionQuality: quality) ?? data
    }
    return compressed
}
