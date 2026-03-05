# Edit Thread + Fractional Quantities Design

Two features: allow editing thread entries, and support fractional quantities (0.25 steps).

## Edit Thread

**Trigger:** Tap a thread row in inventory → opens edit sheet.

**Implementation:** Reuse `AddThreadView` with an optional `NeedleThread?` parameter:
- If nil → add mode (current behavior)
- If present → edit mode: title "Edit Thread", fields pre-filled, save updates instead of inserts, "Add Another" hidden, "Delete" button at bottom (soft delete)

**Navigation:** `ThreadRowView` wraps its content in a `Button` that sets a `@State selectedThread` on `ThreadListView`, which presents the edit sheet.

## Fractional Quantities

**Change quantity from Int to Double across all layers:**

| Layer | Before | After |
|-------|--------|-------|
| DB column | `integer("quantity")` | `real("quantity")` |
| API Zod | `z.number().int().min(0)` | `z.number().min(0).multipleOf(0.25)` |
| API service | `quantity ?? 0` | `quantity ?? 0` (unchanged) |
| Sync service | `as number \| undefined` | `as number \| undefined` (unchanged) |
| iOS model | `var quantity: Int` | `var quantity: Double` |
| iOS sync | `as? Int` | `as? Double` (with Int fallback) |
| Add/Edit stepper | `Stepper Int, step 1` | `Stepper Double, step 0.25` |
| Row +/- buttons | `±1 Int` | `±1.0 Double` (stays at whole steps) |
| Row display | `"\(quantity)"` | Smart format: "3" not "3.0", "2.75" shows decimals |

**Migration:** DB migration alters column type from integer to real. Existing data converts losslessly (3 → 3.0).

## Display Formatting

Quantity display uses smart formatting:
- 3.0 → "3"
- 2.5 → "2.5"
- 0.25 → "0.25"
- 0.75 → "0.75"

Use `quantity.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", quantity) : String(format: "%g", quantity)`.

## Scope

Full stack: DB migration, API schema + service, sync, iOS model + views + sync engine.
