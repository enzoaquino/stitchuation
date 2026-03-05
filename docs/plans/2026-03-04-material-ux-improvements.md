# Material UX Improvements

Three small enhancements to the materials workflow.

## 1. Show quantity on scan import preview

**Problem:** `ParsedMaterialsReviewView` only shows quantity when a unit is also present (`if quantity > 0, let unit = ...`). Threads often have quantity without a unit, so users don't see the count until after saving.

**Fix:** Always show quantity when > 0. Append unit only if available.

- `quantity: 3, unit: "skeins"` → "3 skeins"
- `quantity: 3, unit: nil` → "3"
- `quantity: 0` → hidden

**File:** `ParsedMaterialsReviewView.swift` line 37 — change the conditional.

## 2. Swipe-to-delete on materials list

**Problem:** No way to quickly delete a material from the project detail view. Currently requires editing.

**Fix:** Add `.swipeActions(edge: .trailing)` with a destructive "Delete" button on each `MaterialRowView` in `MaterialsSection`. Soft-deletes the material (`deletedAt = Date()`, `updatedAt = Date()`).

**File:** `MaterialsSection.swift` — add `.swipeActions` to each row in the ForEach.

**Note:** The current `VStack + ForEach` layout doesn't support swipe actions natively. Wrap the materials list in a `List` with `.listStyle(.plain)` and hidden scroll background to enable swipe support while preserving the visual style.

## 3. "Mark All Acquired" button

**Problem:** Tedious to tap each material's checkbox individually when you've bought everything.

**Fix:** Add a "Mark All" button in the footer actions (alongside "Add Material" and "Scan Guide"). Sets `acquired = true` and `updatedAt = Date()` on all non-deleted, non-acquired materials. Animated with `Motion.gentle`. Only shown when there are un-acquired materials.

**File:** `MaterialsSection.swift` — add button to the footer HStack.
