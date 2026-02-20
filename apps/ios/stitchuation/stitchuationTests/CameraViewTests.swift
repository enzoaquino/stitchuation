import Testing
import UIKit
@testable import stitchuation

@Suite("CameraView Tests")
struct CameraViewTests {
    @Test("coordinator is created with onCapture callback")
    func coordinatorCreation() {
        var capturedImage: UIImage?
        var capturedData: Data?
        let view = CameraView { image, data in
            capturedImage = image
            capturedData = data
        }
        let coordinator = view.makeCoordinator()
        #expect(coordinator.parent != nil)
    }

    @Test("camera availability check returns bool")
    func cameraAvailabilityCheck() {
        let available = CameraView.isCameraAvailable
        #expect(type(of: available) == Bool.self)
    }
}
