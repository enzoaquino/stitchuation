import Testing
import SwiftUI
@testable import stitchuation

@Suite("MeshCountPicker Tests")
struct MeshCountPickerTests {
    @Test("standard presets are 10, 12, 13, 14, 18, 24")
    func standardPresets() {
        #expect(MeshCountPicker.standardCounts == [10, 12, 13, 14, 18, 24])
    }

    @Test("initializes with preset selected when value matches standard")
    func initWithPresetValue() {
        var meshCount = "13"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .preset(13))
    }

    @Test("initializes with custom mode when value is non-standard")
    func initWithCustomValue() {
        var meshCount = "16"
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .custom)
    }

    @Test("initializes with no selection when value is empty")
    func initEmpty() {
        var meshCount = ""
        let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
        let picker = MeshCountPicker(meshCount: binding)
        #expect(picker.initialSelection == .none)
    }

    @Test("initializes with preset for each standard count")
    func initWithEachPreset() {
        for count in MeshCountPicker.standardCounts {
            var meshCount = "\(count)"
            let binding = Binding(get: { meshCount }, set: { meshCount = $0 })
            let picker = MeshCountPicker(meshCount: binding)
            #expect(picker.initialSelection == .preset(count))
        }
    }
}
