# Color Name Search Design

Search threads by typing a color name (e.g. "red") and match against hex codes, even when the thread has no colorName set.

## Behavior

1. User types "red" in the thread search bar
2. Existing search checks brand, number, colorName — no substring match
3. System looks up "red" in the CSS named color dictionary → RGB(255, 0, 0)
4. For each thread with a colorHex, compute CIE Delta E distance to the lookup color
5. Threads within the threshold (~40 Delta E) match — this includes dark red, crimson, but not salmon or pink

## Implementation

**New file:** `ColorNames.swift` — contains:
- Static dictionary of ~150 CSS named colors mapping lowercase name → (R, G, B)
- `matchesColorName(_:hex:threshold:)` function that:
  - Looks up the search term (or prefix) in the dictionary
  - Converts both colors from RGB → CIE Lab
  - Computes Delta E (CIE76) distance
  - Returns true if distance ≤ threshold

**Modified file:** `ThreadListView.swift` — in `filteredThreads`:
- After existing brand/number/colorName substring check fails
- If thread has a colorHex, check `matchesColorName(search, hex: thread.colorHex)`
- If true, include the thread in results

## Color Distance

CIE76 Delta E in Lab color space is perceptually uniform — a distance of 40 means "noticeably different but same family." This gives medium fuzziness: "red" matches #FF0000, #CC0000, #DC143C (crimson), but not #FA8072 (salmon) or #FFC0CB (pink).

## Scope

iOS-only. No API, database, or sync changes. All computation is on-device, instant for typical inventory sizes (<1000 threads).
