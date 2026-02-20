# Camera Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add camera photo capture alongside the existing photo library picker in both AddCanvasView and AddJournalEntryView.

**Architecture:** A reusable `CameraView` wraps `UIImagePickerController` (.camera) as a `UIViewControllerRepresentable`. Both form views replace their direct PhotosPicker trigger with a `.confirmationDialog` offering "Take Photo" or "Choose from Library". If no camera is available, the dialog is skipped and the library opens directly.

**Tech Stack:** SwiftUI, UIKit (UIImagePickerController), Swift Testing framework

**Build command:** `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

**Test command:** `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

**Design doc:** `docs/plans/2026-02-20-camera-capture-design.md`

**Note:** SourceKit may show false positive errors on new/modified files. Trust xcodebuild output.

---

## Task 1: CameraView Component + Tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CameraView.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/CameraViewTests.swift`

**Step 1: Write the test file**

Create `apps/ios/stitchuation/stitchuationTests/CameraViewTests.swift`:

```swift
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
        // On simulator this returns false, on device true — either way it should not crash
        let available = CameraView.isCameraAvailable
        #expect(type(of: available) == Bool.self)
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: FAIL — `CameraView` type not found.

**Step 3: Implement CameraView**

Create `apps/ios/stitchuation/stitchuation/DesignSystem/Components/CameraView.swift`:

```swift
import SwiftUI
import UIKit

struct CameraView: UIViewControllerRepresentable {
    let onCapture: (UIImage, Data) -> Void

    static var isCameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView?

        init(parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage,
               let data = image.jpegData(compressionQuality: 0.8) {
                parent?.onCapture(image, data)
            }
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: All CameraView tests PASS

**Step 5: Build to verify UI compiles**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/CameraView.swift apps/ios/stitchuation/stitchuationTests/CameraViewTests.swift
git commit -m "feat(ios): add CameraView UIImagePickerController wrapper with tests"
```

---

## Task 2: Add NSCameraUsageDescription to Info.plist

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Info.plist`

**Step 1: Add the camera usage description**

The current Info.plist contains font entries and NSAppTransportSecurity. Add `NSCameraUsageDescription` key inside the top-level `<dict>`:

```xml
	<key>NSCameraUsageDescription</key>
	<string>Take photos of your canvases and stitching progress.</string>
```

Add it after the `NSAppTransportSecurity` closing `</dict>` tag, before the final `</dict></plist>`.

The resulting file should look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>UIAppFonts</key>
	<array>
		<string>PlayfairDisplay-Variable.ttf</string>
		<string>SourceSerif4-Variable.ttf</string>
	</array>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
	<key>NSCameraUsageDescription</key>
	<string>Take photos of your canvases and stitching progress.</string>
</dict>
</plist>
```

**Step 2: Build to verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Info.plist
git commit -m "feat(ios): add NSCameraUsageDescription to Info.plist"
```

---

## Task 3: Add Camera Option to AddCanvasView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift`

**Step 1: Add state properties**

Add two new `@State` properties after line 21 (`@State private var addAnother = false`):

```swift
    @State private var showPhotoOptions = false
    @State private var showCamera = false
```

**Step 2: Replace PhotosPicker with tappable area + dialog**

Replace lines 35-70 (the entire photo Section) with:

```swift
                Section {
                    Button {
                        if CameraView.isCameraAvailable {
                            showPhotoOptions = true
                        } else {
                            showLibraryPicker = true
                        }
                    } label: {
                        if let selectedImageData, let uiImage = UIImage(data: selectedImageData) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(height: 200)
                                .frame(maxWidth: .infinity)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        } else {
                            VStack(spacing: Spacing.md) {
                                Image(systemName: "photo.badge.plus")
                                    .font(.system(size: 32))
                                    .foregroundStyle(Color.terracotta)
                                Text("Add Photo")
                                    .font(.typeStyle(.subheadline))
                                    .foregroundStyle(Color.walnut)
                            }
                            .frame(height: 140)
                            .frame(maxWidth: .infinity)
                            .background(Color.parchment)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        }
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                }
```

**Step 3: Add one more state property and modifiers**

Add another state property alongside the ones from Step 1:

```swift
    @State private var showLibraryPicker = false
```

Then add modifiers to the `NavigationStack` (after the `.toolbar { ... }` closing brace, before the closing brace of `NavigationStack`):

```swift
            .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                Button("Take Photo") { showCamera = true }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImageData = data
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhoto, matching: .images)
```

**Step 4: Keep the existing `.onChange(of: selectedPhoto)` handler**

The existing `onChange` handler on `selectedPhoto` (which was previously on the `PhotosPicker` view) needs to move to the `NavigationStack` level since the `PhotosPicker` is now presented via the `.photosPicker` modifier. Add this modifier alongside the others on the `NavigationStack`:

```swift
            .onChange(of: selectedPhoto) { _, newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self) {
                        selectedImageData = data
                    }
                }
            }
```

**Important:** Remove the old `.onChange(of: selectedPhoto)` that was on the `PhotosPicker` view (it no longer exists).

**Step 5: Build to verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 6: Run tests**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: All tests pass

**Step 7: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddCanvasView.swift
git commit -m "feat(ios): add camera capture option to AddCanvasView"
```

---

## Task 4: Add Camera Option to AddJournalEntryView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift`

**Step 1: Add state properties**

Add three new `@State` properties after line 14 (`@State private var selectedImages: [SelectedImage] = []`):

```swift
    @State private var showPhotoOptions = false
    @State private var showCamera = false
    @State private var showLibraryPicker = false
```

**Step 2: Replace the PhotosPicker button with a plain button + dialog**

Replace lines 64-78 (the `if selectedImages.count < 4 { PhotosPicker(...) }` block) with:

```swift
                    if selectedImages.count < 4 {
                        Button {
                            if CameraView.isCameraAvailable {
                                showPhotoOptions = true
                            } else {
                                showLibraryPicker = true
                            }
                        } label: {
                            HStack(spacing: Spacing.sm) {
                                Image(systemName: "photo.badge.plus")
                                    .foregroundStyle(Color.terracotta)
                                Text(selectedImages.isEmpty ? "Add Photos" : "Add More Photos")
                                    .font(.typeStyle(.subheadline))
                                    .foregroundStyle(Color.walnut)
                            }
                        }
                        .buttonStyle(.plain)
                    }
```

**Step 3: Add modifiers to the NavigationStack**

After the `.toolbar { ... }` closing brace and the existing `.onChange(of: selectedPhotos)` modifier, add:

```swift
            .confirmationDialog("Add Photo", isPresented: $showPhotoOptions) {
                Button("Take Photo") { showCamera = true }
                Button("Choose from Library") { showLibraryPicker = true }
                Button("Cancel", role: .cancel) { }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraView { image, data in
                    selectedImages.append(SelectedImage(image: image, data: data))
                    showCamera = false
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showLibraryPicker, selection: $selectedPhotos, maxSelectionCount: 4 - selectedImages.count, matching: .images)
```

**Important:** The existing `.onChange(of: selectedPhotos)` handler stays exactly where it is — it still processes library picks. The camera callback directly appends to `selectedImages` (since it already has the UIImage and Data).

**Step 4: Build to verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 5: Run tests**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: All tests pass

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddJournalEntryView.swift
git commit -m "feat(ios): add camera capture option to AddJournalEntryView"
```

---

## Task 5: Final Build & Test Verification

**Step 1: Build the project**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -3`

Expected: BUILD SUCCEEDED

**Step 2: Run all tests**

Run: `xcodebuild test -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -20`

Expected: All tests pass (2 pre-existing KeychainHelperTests failures in simulator are expected)

**Step 3: Fix any issues found**

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | CameraView wrapper + tests | CameraView.swift (new), CameraViewTests.swift (new) |
| 2 | Info.plist camera permission | Info.plist |
| 3 | AddCanvasView camera option | AddCanvasView.swift |
| 4 | AddJournalEntryView camera option | AddJournalEntryView.swift |
| 5 | Final build & test verification | — |
