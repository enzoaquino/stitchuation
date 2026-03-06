# Material-to-Inventory Matching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically link stitch piece materials to matching threads in the user's inventory, marking them as acquired and showing the relationship in both directions.

**Architecture:** iOS-only matching logic via a `MaterialMatcher` utility. When materials are added to a piece (scan or manual) or threads are added to inventory, a local SwiftData query checks for matches by normalized brand+code against brand+number. A new `threadId` nullable UUID on `PieceMaterial` creates the FK link. API just stores/syncs the new field — no server-side matching needed.

**Tech Stack:** SwiftUI + SwiftData (iOS), Drizzle ORM + PostgreSQL (API), Vitest (API tests), Swift Testing (iOS tests)

---

### Task 1: Add `threadId` column to API schema and generate migration

**Files:**
- Modify: `apps/api/src/db/schema.ts:102-121`

**Step 1: Add `threadId` to the `pieceMaterials` table**

In `apps/api/src/db/schema.ts`, add a nullable `threadId` column to the `pieceMaterials` table definition, right after the `userId` field (line 105):

```typescript
threadId: uuid("thread_id").references(() => threads.id),
```

**Step 2: Add `threadId` to sync allowlist**

In `apps/api/src/sync/sync-service.ts`, add `"threadId"` to `ALLOWED_PIECE_MATERIAL_FIELDS` (line 52-63):

```typescript
const ALLOWED_PIECE_MATERIAL_FIELDS = new Set([
  "pieceId",
  "materialType",
  "brand",
  "name",
  "code",
  "quantity",
  "unit",
  "notes",
  "acquired",
  "sortOrder",
  "threadId",
]);
```

**Step 3: Include `threadId` in sync response**

In `apps/api/src/sync/sync-service.ts`, in the `materialChanges` mapping (around line 615), add `threadId` to the data object:

```typescript
const materialChanges = changedMaterials.map((m) => ({
  type: "pieceMaterial" as const,
  action: m.deletedAt ? ("delete" as const) : ("upsert" as const),
  id: m.id,
  data: m.deletedAt
    ? undefined
    : {
        pieceId: m.pieceId,
        materialType: m.materialType,
        brand: m.brand,
        name: m.name,
        code: m.code,
        quantity: m.quantity,
        unit: m.unit,
        notes: m.notes,
        acquired: m.acquired === 1,
        sortOrder: m.sortOrder,
        threadId: m.threadId,
      },
  updatedAt: m.updatedAt.toISOString(),
  deletedAt: m.deletedAt?.toISOString(),
}));
```

**Step 4: Handle `threadId` in insert and validate UUID**

In `processPieceMaterialChange`, when inserting a new material, include `threadId`:

```typescript
// In the insert block, extract threadId
const threadIdStr = allowed.threadId as string | undefined;
const threadId = threadIdStr && UUID_REGEX.test(threadIdStr) ? threadIdStr : null;
```

Add `threadId` to the `.values({...})` call.

For updates, `threadId` is already handled by `pickAllowedFields` + `Object.assign` since it's in the allowlist. But validate it:

```typescript
// In the update block, after pickAllowedFields
if (allowed.threadId !== undefined) {
  if (allowed.threadId === null || (typeof allowed.threadId === "string" && UUID_REGEX.test(allowed.threadId))) {
    // valid — keep it
  } else {
    delete allowed.threadId;
  }
}
```

**Step 5: Generate and run the migration**

Run: `cd apps/api && npm run db:generate && npm run db:migrate`

Expected: A new migration file like `0008_*.sql` adding `thread_id` column to `piece_materials`.

**Step 6: Run tests**

Run: `cd apps/api && npx vitest run`
Expected: All existing tests pass (no behavior change, just new nullable column).

**Step 7: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/sync/sync-service.ts apps/api/drizzle/
git commit -m "feat(api): add threadId column to piece_materials for inventory linking"
```

---

### Task 2: Add API sync test for `threadId`

**Files:**
- Modify: `apps/api/tests/sync/sync-material.test.ts`

**Step 1: Write test for syncing threadId**

Add these tests to `apps/api/tests/sync/sync-material.test.ts`:

```typescript
it("syncs threadId when pushing material with linked thread", async () => {
  // Create a thread in the user's inventory
  const threadId = crypto.randomUUID();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "thread",
        action: "upsert",
        id: threadId,
        data: { brand: "Splendor", number: "S832", fiberType: "silk", quantity: 1 },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  // Push a material linked to that thread
  const materialId = crypto.randomUUID();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: {
          pieceId,
          materialType: "thread",
          brand: "Splendor",
          name: "Dark Green",
          code: "S832",
          quantity: 1,
          acquired: true,
          sortOrder: 0,
          threadId,
        },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  const material = await materialService.getById(userId, materialId);
  expect(material?.threadId).toBe(threadId);
  expect(material?.acquired).toBe(1);
});

it("pulls threadId in sync response", async () => {
  const before = new Date(Date.now() - 1000).toISOString();

  // Create thread and linked material
  const threadId = crypto.randomUUID();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "thread",
        action: "upsert",
        id: threadId,
        data: { brand: "DMC", number: "666", fiberType: "cotton", quantity: 2 },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  const materialId = crypto.randomUUID();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: {
          pieceId,
          materialType: "thread",
          brand: "DMC",
          name: "Red",
          code: "666",
          acquired: true,
          threadId,
        },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  const result = await syncService.sync(userId, {
    lastSync: before,
    changes: [],
  });

  const found = result.changes.find(
    (c: any) => c.type === "pieceMaterial" && c.id === materialId,
  );
  expect(found).toBeDefined();
  expect(found!.data?.threadId).toBe(threadId);
});

it("allows clearing threadId via sync update", async () => {
  const materialId = crypto.randomUUID();
  const threadId = crypto.randomUUID();

  // Create thread first
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "thread",
        action: "upsert",
        id: threadId,
        data: { brand: "Test", number: "001", fiberType: "wool", quantity: 1 },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  // Create material with threadId
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: { pieceId, name: "Linked", threadId, acquired: true },
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  // Clear threadId
  const newerTimestamp = new Date(Date.now() + 60000).toISOString();
  await syncService.sync(userId, {
    lastSync: null,
    changes: [
      {
        type: "pieceMaterial",
        action: "upsert",
        id: materialId,
        data: { threadId: null, acquired: false },
        updatedAt: newerTimestamp,
      },
    ],
  });

  const updated = await materialService.getById(userId, materialId);
  expect(updated?.threadId).toBeNull();
  expect(updated?.acquired).toBe(0);
});
```

**Step 2: Run test to verify**

Run: `cd apps/api && npx vitest run tests/sync/sync-material.test.ts`
Expected: All tests pass including the 3 new ones.

**Step 3: Run full test suite**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add apps/api/tests/sync/sync-material.test.ts
git commit -m "test(api): add sync tests for threadId on piece materials"
```

---

### Task 3: Add `threadId` to iOS `PieceMaterial` model and sync

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Models/PieceMaterial.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Add `threadId` property to PieceMaterial**

In `PieceMaterial.swift`, add after the `acquired` property (line 15):

```swift
var threadId: UUID?
```

Add to `init` parameters (after `acquired: Bool = false`):

```swift
threadId: UUID? = nil,
```

And in the init body:

```swift
self.threadId = threadId
```

**Step 2: Update SyncEngine to send `threadId`**

In `SyncEngine.swift`, in the material sync changes mapping (around line 255-280), add `threadId` to the data dictionary:

```swift
"threadId": AnyCodable(material.threadId?.uuidString ?? NSNull()),
```

**Step 3: Update SyncEngine to receive `threadId`**

In `SyncEngine.swift`, in `applyMaterialData` (around line 611-633), add:

```swift
if let v = data["threadId"] {
    if v.value is NSNull {
        material.threadId = nil
    } else if let str = v.value as? String {
        material.threadId = UUID(uuidString: str)
    }
}
```

**Step 4: Update iOS tests**

In `apps/ios/stitchuation/stitchuationTests/PieceMaterialTests.swift`:

Update `defaultInit` test to verify `threadId` defaults to nil:
```swift
#expect(material.threadId == nil)
```

Add a test for threadId initialization:
```swift
@Test("PieceMaterial initializes with threadId")
func initWithThreadId() {
    let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
    let threadId = UUID()
    let material = PieceMaterial(
        piece: piece,
        name: "Dark Green",
        threadId: threadId
    )
    #expect(material.threadId == threadId)
}
```

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/PieceMaterial.swift apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift apps/ios/stitchuation/stitchuationTests/PieceMaterialTests.swift
git commit -m "feat(ios): add threadId to PieceMaterial model and sync"
```

---

### Task 4: Create `MaterialMatcher` utility with tests

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Services/MaterialMatcher.swift`
- Create: `apps/ios/stitchuation/stitchuationTests/MaterialMatcherTests.swift`

**Step 1: Write the failing tests first**

Create `apps/ios/stitchuation/stitchuationTests/MaterialMatcherTests.swift`:

```swift
import Testing
import Foundation
@testable import stitchuation

@Suite("MaterialMatcher Tests")
struct MaterialMatcherTests {

    // MARK: - Normalization

    @Test("normalize lowercases and trims whitespace")
    func normalizeBasic() {
        #expect(MaterialMatcher.normalize("  Splendor  ") == "splendor")
    }

    @Test("normalize strips leading/trailing punctuation")
    func normalizePunctuation() {
        #expect(MaterialMatcher.normalize("#310") == "310")
        #expect(MaterialMatcher.normalize("S832.") == "s832")
    }

    @Test("normalize handles nil as empty string")
    func normalizeNil() {
        #expect(MaterialMatcher.normalize(nil) == "")
    }

    @Test("normalize handles empty string")
    func normalizeEmpty() {
        #expect(MaterialMatcher.normalize("") == "")
    }

    // MARK: - Matching

    @Test("exact match links material to thread")
    func exactMatch() {
        let thread = NeedleThread(brand: "Splendor", number: "S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Splendor",
            name: "Dark Green",
            code: "S832"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    @Test("case-insensitive match works")
    func caseInsensitiveMatch() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "dmc",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    @Test("no match when brand differs")
    func noMatchDifferentBrand() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "Anchor",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("no match when code differs")
    func noMatchDifferentCode() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "White",
            code: "B5200"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("skips non-thread material types")
    func skipNonThread() {
        let thread = NeedleThread(brand: "Mill Hill", number: "00123", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .bead,
            brand: "Mill Hill",
            name: "Red Bead",
            code: "00123"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("skips materials with nil brand or code")
    func skipMissingFields() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")

        let noBrand = PieceMaterial(piece: piece, materialType: .thread, name: "Black", code: "310")
        #expect(MaterialMatcher.findMatch(for: noBrand, in: [thread]) == nil)

        let noCode = PieceMaterial(piece: piece, materialType: .thread, brand: "DMC", name: "Black")
        #expect(MaterialMatcher.findMatch(for: noCode, in: [thread]) == nil)
    }

    @Test("ambiguous match returns nil (multiple threads match)")
    func ambiguousMatch() {
        let thread1 = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let thread2 = NeedleThread(brand: "DMC", number: "310", quantity: 2)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread1, thread2])

        #expect(result == nil)
    }

    @Test("skips deleted threads")
    func skipDeletedThread() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        thread.deletedAt = Date()
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: "DMC",
            name: "Black",
            code: "310"
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result == nil)
    }

    @Test("match with whitespace and punctuation normalization")
    func normalizedMatch() {
        let thread = NeedleThread(brand: "Splendor ", number: "#S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let material = PieceMaterial(
            piece: piece,
            materialType: .thread,
            brand: " splendor",
            name: "Dark Green",
            code: "S832."
        )

        let result = MaterialMatcher.findMatch(for: material, in: [thread])

        #expect(result?.id == thread.id)
    }

    // MARK: - Batch matching

    @Test("matchMaterials links matching materials and sets acquired")
    func batchMatch() {
        let thread = NeedleThread(brand: "DMC", number: "310", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "DMC", name: "Black", code: "310")
        let m2 = PieceMaterial(piece: piece, materialType: .thread, brand: "Anchor", name: "White", code: "001")

        let matched = MaterialMatcher.matchMaterials([m1, m2], against: [thread])

        #expect(matched == 1)
        #expect(m1.threadId == thread.id)
        #expect(m1.acquired == true)
        #expect(m2.threadId == nil)
        #expect(m2.acquired == false)
    }

    @Test("matchThread links unlinked materials across pieces")
    func reverseMatch() {
        let thread = NeedleThread(brand: "Splendor", number: "S832", quantity: 1)
        let piece = StitchPiece(designer: "Test", designName: "Test Canvas")
        let m1 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832")
        let m2 = PieceMaterial(piece: piece, materialType: .thread, brand: "Splendor", name: "Dark Green", code: "S832", acquired: true, threadId: UUID()) // already linked

        let matched = MaterialMatcher.matchThread(thread, against: [m1, m2])

        #expect(matched == 1)
        #expect(m1.threadId == thread.id)
        #expect(m1.acquired == true)
        // m2 untouched — already linked
    }
}
```

**Step 2: Create `MaterialMatcher.swift`**

Create `apps/ios/stitchuation/stitchuation/Services/MaterialMatcher.swift`:

```swift
import Foundation

enum MaterialMatcher {

    /// Normalize a string for fuzzy matching: lowercase, trim whitespace, strip leading/trailing punctuation.
    static func normalize(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "" }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return trimmed.trimmingCharacters(in: .punctuationCharacters)
    }

    /// Find a single matching thread for a material. Returns nil if zero or multiple matches.
    static func findMatch(for material: PieceMaterial, in threads: [NeedleThread]) -> NeedleThread? {
        guard material.materialType == .thread else { return nil }
        guard let brand = material.brand, !brand.isEmpty,
              let code = material.code, !code.isEmpty else { return nil }

        let normalizedBrand = normalize(brand)
        let normalizedCode = normalize(code)
        guard !normalizedBrand.isEmpty, !normalizedCode.isEmpty else { return nil }

        let matches = threads.filter { thread in
            guard thread.deletedAt == nil else { return false }
            return normalize(thread.brand) == normalizedBrand
                && normalize(thread.number) == normalizedCode
        }

        return matches.count == 1 ? matches.first : nil
    }

    /// Match an array of materials against the user's thread inventory.
    /// Links matches by setting `threadId` and `acquired = true`.
    /// Returns the number of materials matched.
    @discardableResult
    static func matchMaterials(_ materials: [PieceMaterial], against threads: [NeedleThread]) -> Int {
        var count = 0
        for material in materials {
            guard material.threadId == nil else { continue }
            if let match = findMatch(for: material, in: threads) {
                material.threadId = match.id
                material.acquired = true
                material.updatedAt = Date()
                count += 1
            }
        }
        return count
    }

    /// Match a newly added thread against all unlinked materials.
    /// Links matches by setting `threadId` and `acquired = true`.
    /// Returns the number of materials matched.
    @discardableResult
    static func matchThread(_ thread: NeedleThread, against materials: [PieceMaterial]) -> Int {
        var count = 0
        for material in materials {
            guard material.threadId == nil,
                  material.materialType == .thread,
                  material.deletedAt == nil else { continue }

            guard let brand = material.brand, !brand.isEmpty,
                  let code = material.code, !code.isEmpty else { continue }

            let normalizedBrand = normalize(brand)
            let normalizedCode = normalize(code)

            if normalize(thread.brand) == normalizedBrand
                && normalize(thread.number) == normalizedCode {
                material.threadId = thread.id
                material.acquired = true
                material.updatedAt = Date()
                count += 1
            }
        }
        return count
    }
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Services/MaterialMatcher.swift apps/ios/stitchuation/stitchuationTests/MaterialMatcherTests.swift
git commit -m "feat(ios): add MaterialMatcher utility with fuzzy brand+code matching"
```

---

### Task 5: Wire matching into material save flows

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift`
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift`

**Step 1: Add matching to `ParsedMaterialsReviewView.saveAll()`**

In `ParsedMaterialsReviewView.swift`, add a `@Query` for threads at the top of the struct:

```swift
@Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
private var threads: [NeedleThread]
```

Add `import SwiftData` is already there. In the `saveAll()` method, after the for loop that creates materials and before `dismiss()`, add matching:

```swift
// After inserting all materials, run matching
let newMaterials = materials.indices.map { index in
    // We need the actual PieceMaterial objects — collect them during creation
}
```

Actually, refactor `saveAll()` to collect the created materials:

```swift
private func saveAll() {
    let existingMaxSort = piece.materials
        .filter { $0.deletedAt == nil }
        .map(\.sortOrder)
        .max() ?? -1

    var newMaterials: [PieceMaterial] = []
    for (index, parsed) in materials.enumerated() {
        let material = PieceMaterial(
            piece: piece,
            materialType: parsed.materialType,
            brand: parsed.brand,
            name: parsed.name,
            code: parsed.code,
            quantity: parsed.quantity,
            unit: parsed.unit,
            sortOrder: existingMaxSort + 1 + index
        )
        modelContext.insert(material)
        newMaterials.append(material)
    }

    MaterialMatcher.matchMaterials(newMaterials, against: threads)

    dismiss()
}
```

**Step 2: Add matching to `AddMaterialView.save()`**

In `AddMaterialView.swift`, add a `@Query` for threads:

```swift
@Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
private var threads: [NeedleThread]
```

In the `save()` function, after creating a new material and inserting it (around line 158-159), add:

```swift
MaterialMatcher.matchMaterials([material], against: threads)
```

Only for new materials (not edits). The full block becomes:

```swift
} else {
    let nextSortOrder = piece.materials
        .filter { $0.deletedAt == nil }
        .map(\.sortOrder)
        .max()
        .map { $0 + 1 } ?? 0

    let material = PieceMaterial(
        piece: piece,
        materialType: materialType,
        brand: trimmedBrand.isEmpty ? nil : trimmedBrand,
        name: trimmedName,
        code: trimmedCode.isEmpty ? nil : trimmedCode,
        quantity: quantity,
        unit: trimmedUnit.isEmpty ? nil : trimmedUnit,
        notes: trimmedNotes.isEmpty ? nil : trimmedNotes,
        sortOrder: nextSortOrder
    )
    modelContext.insert(material)
    MaterialMatcher.matchMaterials([material], against: threads)
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift apps/ios/stitchuation/stitchuation/Views/AddMaterialView.swift
git commit -m "feat(ios): run material matching on save in scan review and manual add"
```

---

### Task 6: Wire matching into thread add flow (reverse direction)

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`

**Step 1: Add query for unlinked materials**

In `AddThreadView.swift`, add a `@Query` for unlinked thread-type materials:

```swift
@Query(filter: #Predicate<PieceMaterial> {
    $0.deletedAt == nil && $0.threadId == nil
})
private var unlinkdMaterials: [PieceMaterial]
```

Note: SwiftData `#Predicate` doesn't support `== .thread` enum comparison directly. We'll filter in code:

```swift
@Query(filter: #Predicate<PieceMaterial> { $0.deletedAt == nil })
private var allMaterials: [PieceMaterial]
```

**Step 2: Run reverse matching after thread save**

In `saveThread()`, after the new thread is inserted (around line 213, after `modelContext.insert(newThread)`), add:

```swift
let unlinkedThreadMaterials = allMaterials.filter { $0.threadId == nil && $0.materialType == .thread }
MaterialMatcher.matchThread(newThread, against: unlinkedThreadMaterials)
```

Only for new threads (not edits). The block becomes:

```swift
} else {
    let newThread = NeedleThread(
        brand: brand,
        number: number,
        colorName: colorName.isEmpty ? nil : colorName,
        colorHex: normalizedHex,
        fiberType: fiberType,
        format: format,
        quantity: quantity,
        barcode: barcode.isEmpty ? nil : barcode,
        weightOrLength: weightOrLength.isEmpty ? nil : weightOrLength,
        lotNumber: lotNumber.isEmpty ? nil : lotNumber,
        notes: notes.isEmpty ? nil : notes
    )
    modelContext.insert(newThread)

    let unlinkedThreadMaterials = allMaterials.filter {
        $0.threadId == nil && $0.materialType == .thread
    }
    MaterialMatcher.matchThread(newThread, against: unlinkedThreadMaterials)

    if addAnother {
        // ... existing reset logic
    } else {
        dismiss()
    }
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift
git commit -m "feat(ios): run reverse material matching when adding thread to inventory"
```

---

### Task 7: Add "In your stash" badge to `MaterialRowView`

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift`

**Step 1: Add stash indicator**

In `MaterialRowView.swift`, add a small badge when `material.threadId != nil`. After the quantity/unit HStack (around line 37), add:

```swift
if material.threadId != nil {
    Text("In your stash")
        .font(.typeStyle(.footnote))
        .foregroundStyle(Color.sage)
}
```

The updated VStack becomes:

```swift
VStack(alignment: .leading, spacing: Spacing.xxs) {
    Text(material.displayLine)
        .font(.typeStyle(.headline))
        .foregroundStyle(material.acquired ? Color.clay : Color.espresso)
        .strikethrough(material.acquired, color: Color.clay)

    if material.quantity > 0 || material.unit != nil {
        HStack(spacing: Spacing.xs) {
            if material.quantity > 0 {
                Text("\(material.quantity)")
                    .font(.typeStyle(.data))
                    .foregroundStyle(Color.walnut)
            }
            if let unit = material.unit {
                Text(unit)
                    .font(.typeStyle(.subheadline))
                    .foregroundStyle(Color.clay)
            }
        }
    }

    if material.threadId != nil {
        Text("In your stash")
            .font(.typeStyle(.footnote))
            .foregroundStyle(Color.sage)
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift
git commit -m "feat(ios): show 'In your stash' badge on materials linked to inventory"
```

---

### Task 8: Add "In your stash" indicator to `ParsedMaterialsReviewView`

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift`

**Step 1: Pre-compute matches for display**

The review view shows `ParsedMaterial` structs (not yet saved as `PieceMaterial`). We need to check potential matches for display purposes. Add a computed property and helper:

```swift
/// Check if a parsed material would match a thread in inventory
private func hasMatch(_ parsed: ParsedMaterial) -> Bool {
    guard parsed.materialType == .thread,
          let brand = parsed.brand, !brand.isEmpty,
          let code = parsed.code, !code.isEmpty else { return false }

    let normalizedBrand = MaterialMatcher.normalize(brand)
    let normalizedCode = MaterialMatcher.normalize(code)

    let matches = threads.filter { thread in
        MaterialMatcher.normalize(thread.brand) == normalizedBrand
            && MaterialMatcher.normalize(thread.number) == normalizedCode
    }
    return matches.count == 1
}
```

**Step 2: Show badge in list row**

In the `ForEach` block, after the existing HStack with name and code (around line 60), add:

```swift
if hasMatch(materials[index]) {
    Text("In your stash")
        .font(.typeStyle(.footnote))
        .foregroundStyle(Color.sage)
}
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ParsedMaterialsReviewView.swift
git commit -m "feat(ios): show 'In your stash' indicator in parsed materials review"
```

---

### Task 9: Handle manual acquired toggle clearing threadId

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift`

**Step 1: Clear threadId when user manually unmarks acquired**

In `MaterialRowView.swift`, the toggle button (line 8-11) currently does:

```swift
Button {
    material.acquired.toggle()
    material.updatedAt = Date()
}
```

Update to also clear `threadId` when the user manually un-acquires:

```swift
Button {
    material.acquired.toggle()
    if !material.acquired {
        material.threadId = nil
    }
    material.updatedAt = Date()
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/MaterialRowView.swift
git commit -m "feat(ios): clear threadId when user manually marks material as not acquired"
```

---

### Task 10: Run full test suite and verify

**Step 1: Run API tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass.

**Step 2: Verify iOS builds**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -quiet 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Run iOS tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' -quiet 2>&1 | tail -20`
Expected: All tests pass including new MaterialMatcherTests.

**Step 4: Final commit if any cleanup needed**

If all passes, no commit needed. If fixes were required, commit them.
