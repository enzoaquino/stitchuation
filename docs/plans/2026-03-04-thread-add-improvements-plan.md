# Thread Add Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the Add Thread flow with a brand picker (typeahead from known + user brands) and a new thread format field (skein, card, hank, etc.).

**Architecture:** The format field follows the existing `fiberType` pattern across all layers (DB enum, Zod schema, sync, iOS enum + model). The brand picker is iOS-only — a new `BrandPicker` component that combines a hardcoded brand list with the user's existing brands.

**Tech Stack:** TypeScript (Hono, Drizzle, Zod), Swift (SwiftUI, SwiftData)

---

### Task 1: Add `threadFormat` DB enum and column

**Files:**
- Modify: `apps/api/src/db/schema.ts:1-40`

**Step 1: Add the enum and column**

After the existing `fiberTypeEnum` (line 3-5), add:

```typescript
export const threadFormatEnum = pgEnum("thread_format", [
  "skein", "card", "hank", "spool", "ball", "cone", "other"
]);
```

In the `threads` table, add after the `fiberType` line (line 31):

```typescript
  format: threadFormatEnum("format"),
```

Note: no `.notNull()` or `.default()` — this is optional and nullable.

**Step 2: Generate and run migration**

```bash
cd apps/api && npm run db:generate
cd apps/api && npm run db:migrate
```

Expected: Migration creates the enum type and adds the nullable `format` column.

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add thread_format enum and column to threads table"
```

---

### Task 2: Add `format` to API schemas and thread service

**Files:**
- Modify: `apps/api/src/threads/schemas.ts`
- Modify: `apps/api/src/threads/thread-service.ts`

**Step 1: Add format to Zod schemas**

In `apps/api/src/threads/schemas.ts`, add a `threadFormats` const and the field to `createThreadSchema`.

After the `fiberTypes` line (line 3):

```typescript
const threadFormats = ["skein", "card", "hank", "spool", "ball", "cone", "other"] as const;
```

In `createThreadSchema`, after the `fiberType` line (line 11):

```typescript
  format: z.enum(threadFormats).optional(),
```

**Step 2: Add format to thread service create**

In `apps/api/src/threads/thread-service.ts`, in the `create` method's `.values()` object, after the `fiberType` line (line 18):

```typescript
        format: input.format,
```

**Step 3: Commit**

```bash
git add apps/api/src/threads/schemas.ts apps/api/src/threads/thread-service.ts
git commit -m "feat(api): add format field to thread schemas and service"
```

---

### Task 3: Add `format` to sync service

**Files:**
- Modify: `apps/api/src/sync/sync-service.ts`

**Step 1: Add to ALLOWED_THREAD_FIELDS**

In `ALLOWED_THREAD_FIELDS` set, after `"fiberType"` (line 16):

```typescript
  "format",
```

**Step 2: Add to sync insert (processThreadChange)**

In the `processThreadChange` insert values block, after the `fiberType` line (line 145):

```typescript
        format: allowed.format as string | undefined,
```

**Step 3: Add to sync response mapping (getChangesSince)**

In the `threadChanges` data mapping, after the `fiberType` line (line 548):

```typescript
            format: t.format,
```

**Step 4: Commit**

```bash
git add apps/api/src/sync/sync-service.ts
git commit -m "feat(api): add format to thread sync allowlist and response"
```

---

### Task 4: Add API tests for format field

**Files:**
- Modify: `apps/api/tests/threads/thread-service.test.ts`
- Modify: `apps/api/tests/threads/thread-routes.test.ts`

**Step 1: Add thread service test**

In `apps/api/tests/threads/thread-service.test.ts`, after the "updates a thread lot number" test (around line 167):

```typescript
  it("creates a thread with a format", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "321",
      format: "skein",
      quantity: 2,
    });

    expect(thread.format).toBe("skein");

    const fetched = await threadService.getById(userId, thread.id);
    expect(fetched?.format).toBe("skein");
  });

  it("creates a thread without format (nullable)", async () => {
    const thread = await threadService.create(userId, {
      brand: "Kreinik",
      number: "002",
      quantity: 1,
    });

    expect(thread.format).toBeNull();
  });
```

**Step 2: Add thread routes test**

In `apps/api/tests/threads/thread-routes.test.ts`, after the "PUT /threads/:id updates lotNumber" test (around line 84):

```typescript
  it("POST /threads creates a thread with format", async () => {
    const res = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        brand: "Caron",
        number: "001",
        format: "hank",
        quantity: 1,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.format).toBe("hank");
  });

  it("PUT /threads/:id updates format", async () => {
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Rainbow Gallery", number: "M50", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ format: "spool" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.format).toBe("spool");
  });
```

**Step 3: Run tests**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add apps/api/tests/threads/
git commit -m "test(api): add format field tests for threads"
```

---

### Task 5: Add iOS `ThreadFormat` enum

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Models/ThreadFormat.swift`

**Step 1: Create the enum**

```swift
import Foundation

enum ThreadFormat: String, Codable, CaseIterable {
    case skein, card, hank, spool, ball, cone, other

    var displayName: String {
        switch self {
        case .skein: "Skein"
        case .card: "Card"
        case .hank: "Hank"
        case .spool: "Spool"
        case .ball: "Ball"
        case .cone: "Cone"
        case .other: "Other"
        }
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/ThreadFormat.swift
git commit -m "feat(ios): add ThreadFormat enum"
```

---

### Task 6: Add `format` to NeedleThread model

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Models/NeedleThread.swift`

**Step 1: Add property**

After `var fiberType: FiberType` (line 11):

```swift
    var format: ThreadFormat?
```

**Step 2: Add init parameter**

After `fiberType: FiberType = .wool,` (line 28):

```swift
        format: ThreadFormat? = nil,
```

**Step 3: Add init assignment**

After `self.fiberType = fiberType` (line 40):

```swift
        self.format = format
```

**Step 4: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/NeedleThread.swift
git commit -m "feat(ios): add format property to NeedleThread model"
```

---

### Task 7: Add `format` to iOS SyncEngine

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift`

**Step 1: Add to outbound sync data**

In the thread sync data dictionary (around line 138), after the `"fiberType"` line:

```swift
                    "format": AnyCodable(thread.format?.rawValue ?? NSNull()),
```

**Step 2: Add to applyData**

In the `applyData` method, after the `fiberType` block (around line 526):

```swift
        if let v = data["format"] {
            if v.value is NSNull { thread.format = nil }
            else if let str = v.value as? String { thread.format = ThreadFormat(rawValue: str) }
        }
```

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): add format to thread sync"
```

---

### Task 8: Create BrandPicker component

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/DesignSystem/Components/BrandPicker.swift`

**Step 1: Create the component**

```swift
import SwiftUI
import SwiftData

struct BrandPicker: View {
    @Binding var text: String
    @Query(filter: #Predicate<NeedleThread> { $0.deletedAt == nil })
    private var threads: [NeedleThread]

    @FocusState private var isFocused: Bool
    @State private var hasBeenTouched = false

    private static let knownBrands: [String] = [
        "Access Commodities", "Brenda Stofft", "Brown Paper Packages",
        "Burmilana", "Caron", "Caron Collection", "DMC",
        "DebBee's Designs", "Dinky Dyes", "EdMar",
        "Enriched Threads", "Fleur de Paris", "Gloriana Threads",
        "Gone Stitching", "KC Needlepoint", "Kreinik",
        "Little House Needleworks", "Love MHB Studio",
        "Nashville Needleworks", "Needlepoint Inc.",
        "Planet Earth Fiber", "Rainbow Gallery", "River Silks",
        "Silk & Ivory", "Silk Road Fibers", "Stitching Fox",
        "The Collection", "The Gentle Arts", "The Meredith Collection",
        "The Needle Works", "ThreadworX", "Tilli Tomas",
        "Treenway Silks", "Weeks Dye Works", "Wiltex Threads",
        "Yarn Tree",
    ]

    private var allBrands: [String] {
        let userBrands = Set(threads.map(\.brand))
        let combined = Set(Self.knownBrands).union(userBrands)
        return combined.sorted()
    }

    private var suggestions: [String] {
        guard isFocused, !text.isEmpty else { return [] }
        let query = text.lowercased()
        return allBrands.filter { $0.lowercased().contains(query) && $0 != text }
    }

    private var showError: Bool {
        hasBeenTouched && text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                TextField("Brand (e.g. DMC)", text: $text)
                    .font(.typeStyle(.body))
                    .focused($isFocused)
                    .onChange(of: isFocused) { wasFocused, nowFocused in
                        if wasFocused && !nowFocused {
                            hasBeenTouched = true
                        }
                    }
                    .padding(.vertical, Spacing.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: CornerRadius.subtle)
                            .stroke(showError ? Color.dustyRose : Color.clear, lineWidth: 1)
                    )

                if showError {
                    Text("Required")
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.dustyRose)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: showError)

            if !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(suggestions.prefix(5), id: \.self) { brand in
                        Button {
                            text = brand
                            isFocused = false
                        } label: {
                            Text(brand)
                                .font(.typeStyle(.body))
                                .foregroundStyle(Color.espresso)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, Spacing.sm)
                                .padding(.horizontal, Spacing.md)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .background(Color.parchment)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
            }
        }
    }
}
```

**Design notes:**
- Uses `@Query` to get the user's existing threads and extracts unique brands
- Merges with hardcoded `knownBrands` list, deduplicates, and sorts
- Shows up to 5 filtered suggestions as the user types
- Tapping a suggestion fills the field and dismisses keyboard
- Includes the same required-field validation as `ValidatedTextField`
- Free-form entry works — no selection required

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/DesignSystem/Components/BrandPicker.swift
git commit -m "feat(ios): add BrandPicker component with typeahead"
```

---

### Task 9: Update AddThreadView with BrandPicker and format Picker

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`

**Step 1: Add format state**

After `@State private var fiberType: FiberType = .wool` (line 12):

```swift
    @State private var format: ThreadFormat?
```

**Step 2: Replace brand ValidatedTextField with BrandPicker**

Replace line 28:

```swift
                    ValidatedTextField("Brand (e.g. DMC)", text: $brand)
```

With:

```swift
                    BrandPicker(text: $brand)
```

**Step 3: Add format Picker**

After the Fiber Type Picker block (lines 48-52):

```swift
                    Picker("Format", selection: $format) {
                        Text("None").tag(ThreadFormat?.none)
                        ForEach(ThreadFormat.allCases, id: \.self) { fmt in
                            Text(fmt.displayName).tag(ThreadFormat?.some(fmt))
                        }
                    }
```

**Step 4: Add format to saveThread()**

In the `NeedleThread` init call (line 111-122), after `fiberType: fiberType,`:

```swift
            format: format,
```

**Step 5: Add format to "Add Another" reset**

In the reset block (lines 125-133), the format should NOT be reset (same brand/format is likely for batch entry of the same type).

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift
git commit -m "feat(ios): add BrandPicker and format Picker to AddThreadView"
```
