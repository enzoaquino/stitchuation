# Color Sampler Design

Add an eyedropper tool to AddThreadView that lets users sample a thread's color from a photo or camera.

## Behavior

1. User taps an eyedropper button next to the ColorPicker in AddThreadView
2. A sheet opens with options to take a photo or pick from library (reusing existing CameraView and PhotosPicker patterns)
3. The image displays full-width
4. User taps anywhere on the image to sample the color at that point
5. A swatch previews the sampled color with the hex value
6. "Use This Color" sets the hex value on AddThreadView and dismisses

## Implementation

**New file:** `ColorSamplerView.swift` — a sheet view containing:
- Photo source selection (camera / photo library)
- Image display with tap gesture
- Color preview swatch + hex label
- "Use This Color" confirmation button

**Color extraction:** `UIImage` extension with a `pixelColor(at:)` method that:
- Converts tap coordinates to pixel coordinates accounting for image scale
- Reads RGB values from the `CGImage` bitmap data
- Averages a 5x5 pixel region around the tap point for noise reduction
- Returns a `Color` and hex string

**Integration:** Add an eyedropper button in the color hex HStack in AddThreadView. On selection, set both `colorHex` and `pickerColor`.

All on-device — no API calls, works offline, instant response.
