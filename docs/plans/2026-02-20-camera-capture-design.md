# Camera Capture Design

**Goal:** Allow users to take photos with the camera anywhere they can currently choose photos from the library.

**Problem:** Both AddCanvasView and AddJournalEntryView only support photo library selection via PhotosPicker. Users frequently want to photograph their canvas or stitching progress directly without leaving the app.

## Design

### Component: `CameraView`

A `UIViewControllerRepresentable` wrapping `UIImagePickerController` with `.sourceType = .camera`. Returns the captured `UIImage` and its JPEG `Data` via a callback. Shared by both views.

### Interaction Pattern

Tapping the photo area/button shows a `.confirmationDialog` (iOS action sheet) with:
- "Take Photo" — presents `CameraView` via `.fullScreenCover`
- "Choose from Library" — opens `PhotosPicker` (existing behavior)

If no camera is available (`UIImagePickerController.isSourceTypeAvailable(.camera)` is false), skip the dialog and go straight to `PhotosPicker`.

### AddCanvasView

- Current: Tapping photo area opens PhotosPicker directly
- New: Tapping photo area shows confirmationDialog, then either camera or library
- Camera result feeds into existing `selectedImageData: Data?` state
- Single image, same as current

### AddJournalEntryView

- Current: "Add Photos" button opens PhotosPicker (multi-select, up to 4)
- New: Button shows confirmationDialog, then either camera (one photo) or library (multi-select)
- Camera result appends one `SelectedImage` to `selectedImages` array
- Still max 4 images total

### Info.plist

Add `NSCameraUsageDescription`: "Take photos of your canvases and stitching progress."

### What stays the same

- Upload logic (PendingUpload, compression, caching)
- PhotosPicker behavior and multi-select
- Image display, thumbnails, viewer
- All server-side code

### Files affected

- Create: `DesignSystem/Components/CameraView.swift`
- Create: `stitchuationTests/CameraViewTests.swift`
- Modify: `Views/AddCanvasView.swift` — add dialog + camera presentation
- Modify: `Views/AddJournalEntryView.swift` — add dialog + camera presentation
- Modify: `Info.plist` — add NSCameraUsageDescription
