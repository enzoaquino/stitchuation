import Testing
import SwiftUI
@testable import stitchuation

@Suite("ValidatedTextField Tests")
struct ValidatedTextFieldTests {
    @Test("returns false before field has been touched")
    func initialState() {
        #expect(ValidatedTextField.shouldShowError(isRequired: true, hasBeenTouched: false, text: "") == false)
    }

    @Test("returns true when required, touched, and empty")
    func emptyAfterTouch() {
        #expect(ValidatedTextField.shouldShowError(isRequired: true, hasBeenTouched: true, text: "") == true)
    }

    @Test("returns false when required, touched, and non-empty")
    func filledAfterTouch() {
        #expect(ValidatedTextField.shouldShowError(isRequired: true, hasBeenTouched: true, text: "hello") == false)
    }

    @Test("returns false when not required, touched, and empty")
    func notRequiredEmpty() {
        #expect(ValidatedTextField.shouldShowError(isRequired: false, hasBeenTouched: true, text: "") == false)
    }

    @Test("treats whitespace-only as empty")
    func whitespaceOnly() {
        #expect(ValidatedTextField.shouldShowError(isRequired: true, hasBeenTouched: true, text: "   ") == true)
    }
}
