# Thread Add Improvements Design

Two enhancements to the Add Thread flow: a brand picker with typeahead and a new format field.

## 1. Brand picker with typeahead

Replace the plain `brand` TextField with a searchable combo-box. As the user types, a filtered dropdown shows matching brands from two sources:

- **Hardcoded list** of ~35 known needlepoint brands (deduplicated from scraper CSVs):
  Access Commodities, Brenda Stofft, Brown Paper Packages, Burmilana, Caron, Caron Collection, DMC, DebBee's Designs, Dinky Dyes, EdMar, Enriched Threads, Fleur de Paris, Gloriana Threads, Gone Stitching, KC Needlepoint, Kreinik, Little House Needleworks, Love MHB Studio, Nashville Needleworks, Needlepoint Inc., Planet Earth Fiber, Rainbow Gallery, River Silks, Silk & Ivory, Silk Road Fibers, Stitching Fox, The Collection, The Gentle Arts, The Meredith Collection, The Needle Works, ThreadworX, Tilli Tomas, Treenway Silks, Weeks Dye Works, Wiltex Threads, Yarn Tree

- **User's existing brands** queried from their thread collection via SwiftData.

Free-form entry allowed — if the typed text doesn't match a suggestion, it's used as-is. The dropdown filters as they type and dismisses on selection or tap-away.

**Implementation:** Custom `BrandPicker` SwiftUI view wrapping a TextField with a filtered suggestions overlay. No API changes — `brand` remains a plain text field.

## 2. Format field (thread packaging)

New optional field capturing how the thread is packaged/sold.

**Enum values:** `skein`, `card`, `hank`, `spool`, `ball`, `cone`, `other`

**Full stack** — same pattern as `fiberType`:
- DB: new `thread_format` pg enum + nullable column on threads table
- API: Zod schema, thread service, sync allowlist, sync response mapping
- iOS: `ThreadFormat` enum, property on `NeedleThread`, Picker in `AddThreadView`, sync in `SyncEngine`

Optional with no default (unlike `fiberType` which defaults to `wool`). Existing threads will have `nil` format.
