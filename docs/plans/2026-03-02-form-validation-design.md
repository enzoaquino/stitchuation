# Form Validation — Required Field Indicators

## Goal

Add visual indicators on required form fields when the user leaves them empty, so it's clear why the save button is disabled.

## Approach

Create a reusable `ValidatedTextField` component in the design system. Each form swaps `TextField` for `ValidatedTextField` on required fields.

## Component: ValidatedTextField

**Location:** `DesignSystem/Components/ValidatedTextField.swift`

**Behavior:**
- Wraps a standard `TextField` with `@FocusState` tracking
- `isRequired: Bool` parameter (default `true`)
- On focus lost: if empty and required, shows dusty rose 1px border + "Required" label below
- Border/label disappear once the user types
- Subtle fade transition (0.2s ease-in-out)
- Works in both `Form` (list-style) and `ScrollView` (card-style) contexts

**API:**
```swift
ValidatedTextField("Brand (e.g. DMC)", text: $brand, isRequired: true)
```

## Forms to Update

| Form | Required Fields |
|------|----------------|
| AddThreadView | Brand, Number |
| AddCanvasView | Designer, Design Name |
| EditCanvasView | Designer, Design Name |
| AddMaterialView | Name |
| EditProfileSheet | Display Name |

**Not updated:**
- AddJournalEntryView — compound validation (notes *or* photo), not a simple field requirement
- LoginView — out of scope, data forms only

## What Stays the Same

- Save button `.disabled()` logic — unchanged, validation indicators are additive
- Existing format validators (hex color, mesh count) — unchanged, `ValidatedTextField` only checks emptiness
- Non-required fields — no changes
