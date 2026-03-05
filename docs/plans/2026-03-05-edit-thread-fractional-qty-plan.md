# Edit Thread + Fractional Quantities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to edit thread entries (tap row → edit sheet) and support fractional quantities (0.25 steps).

**Architecture:** Full stack. Change quantity from integer to real/Double across DB, API, sync, and iOS. Reuse AddThreadView for editing by adding an optional thread parameter. Navigation via tap on thread row.

**Tech Stack:** TypeScript (Drizzle, Zod, Hono), Swift (SwiftUI, SwiftData), PostgreSQL

---

### Task 1: Change DB column from integer to real

**Files:**
- Modify: `apps/api/src/db/schema.ts:1,37`

**Step 1: Update schema**

In `apps/api/src/db/schema.ts`, add `real` to the import on line 1:

```typescript
import { pgTable, uuid, text, timestamp, integer, pgEnum, index, real } from "drizzle-orm/pg-core";
```

Change line 37 from:
```typescript
  quantity: integer("quantity").notNull().default(0),
```
to:
```typescript
  quantity: real("quantity").notNull().default(0),
```

**Step 2: Generate migration**

Run: `cd apps/api && npm run db:generate`

This creates a migration like `ALTER TABLE "threads" ALTER COLUMN "quantity" SET DATA TYPE real`.

**Step 3: Run migration**

Run: `cd apps/api && npm run db:migrate`

**Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): change thread quantity from integer to real for fractional amounts"
```

---

### Task 2: Update API Zod schema for fractional quantities

**Files:**
- Modify: `apps/api/src/threads/schemas.ts:14`

**Step 1: Update validation**

In `apps/api/src/threads/schemas.ts`, change line 14 from:
```typescript
  quantity: z.number().int().min(0).default(0),
```
to:
```typescript
  quantity: z.number().min(0).multipleOf(0.25).default(0),
```

**Step 2: Commit**

```bash
git add apps/api/src/threads/schemas.ts
git commit -m "feat(api): allow fractional quantities in thread schema (0.25 steps)"
```

---

### Task 3: Add test for fractional quantity via API

**Files:**
- Modify: `apps/api/tests/threads/thread-service.test.ts`
- Modify: `apps/api/tests/threads/thread-routes.test.ts`

**Step 1: Add service test**

Add this test to `apps/api/tests/threads/thread-service.test.ts` after the existing "creates and retrieves a thread" test:

```typescript
  it("supports fractional quantities", async () => {
    const thread = await threadService.create(userId, {
      brand: "DMC",
      number: "350",
      quantity: 2.75,
    });

    expect(thread.quantity).toBe(2.75);

    const updated = await threadService.update(userId, thread.id, {
      quantity: 0.5,
    });

    expect(updated.quantity).toBe(0.5);
  });
```

**Step 2: Add route test**

Add this test to `apps/api/tests/threads/thread-routes.test.ts` after the existing PUT test:

```typescript
  it("PUT /threads/:id with fractional quantity", async () => {
    const createRes = await app.request("/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ brand: "Caron", number: "100", quantity: 1 }),
    });
    const created = await createRes.json();

    const res = await app.request(`/threads/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ quantity: 2.5 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quantity).toBe(2.5);
  });
```

**Step 3: Run tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests pass.

**Step 4: Commit**

```bash
git add apps/api/tests/threads/thread-service.test.ts apps/api/tests/threads/thread-routes.test.ts
git commit -m "test(api): add fractional quantity tests for threads"
```

---

### Task 4: Update iOS NeedleThread model

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Models/NeedleThread.swift:13,31,44`

**Step 1: Change quantity type**

In `NeedleThread.swift`:

Change line 13 from:
```swift
    var quantity: Int
```
to:
```swift
    var quantity: Double
```

Change init parameter (line 31) from:
```swift
        quantity: Int = 0,
```
to:
```swift
        quantity: Double = 0,
```

The body assignment `self.quantity = quantity` (line 44) stays the same.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Models/NeedleThread.swift
git commit -m "feat(ios): change thread quantity from Int to Double for fractional amounts"
```

---

### Task 5: Update iOS sync engine for Double quantity

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift:533`

**Step 1: Update inbound sync**

In `SyncEngine.swift`, change line 533 from:
```swift
        if let quantity = data["quantity"]?.value as? Int { thread.quantity = quantity }
```
to:
```swift
        if let v = data["quantity"]?.value {
            if let d = v as? Double { thread.quantity = d }
            else if let i = v as? Int { thread.quantity = Double(i) }
        }
```

The outbound sync on line 140 (`"quantity": AnyCodable(thread.quantity)`) already works — `AnyCodable` handles `Double` the same way it handles `Int`.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Sync/SyncEngine.swift
git commit -m "feat(ios): handle Double quantity in sync engine with Int fallback"
```

---

### Task 6: Update ThreadRowView for Double quantity

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift:118,120,140-141`

**Step 1: Update quantity display and buttons**

In `ThreadListView.swift`:

Change line 118 from:
```swift
                .disabled(thread.quantity <= 0)
```
to:
```swift
                .disabled(thread.quantity < 1)
```

Change line 120 from:
```swift
                Text("\(thread.quantity)")
```
to:
```swift
                Text(thread.quantity.truncatingRemainder(dividingBy: 1) == 0
                     ? String(format: "%.0f", thread.quantity)
                     : String(format: "%g", thread.quantity))
```

Change the `updateQuantity` function (lines 140-141) from:
```swift
    private func updateQuantity(_ delta: Int) {
        thread.quantity = max(0, thread.quantity + delta)
```
to:
```swift
    private func updateQuantity(_ delta: Double) {
        thread.quantity = max(0, thread.quantity + delta)
```

Change the button calls (lines 109 and 126) from `updateQuantity(-1)` and `updateQuantity(1)` to `updateQuantity(-1.0)` and `updateQuantity(1.0)`.

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift
git commit -m "feat(ios): update ThreadRowView for Double quantity display and +/- buttons"
```

---

### Task 7: Update AddThreadView for Double quantity and edit mode

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`

**Step 1: Add thread parameter and update quantity**

Replace the entire `AddThreadView.swift` with these changes:

1. Add an optional `thread` parameter for edit mode:
```swift
struct AddThreadView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    var thread: NeedleThread?

    private var isEditing: Bool { thread != nil }
```

2. Change quantity state from `Int` to `Double`:
```swift
    @State private var quantity: Double = 1
```

3. Add `onAppear` to pre-fill fields in edit mode. Add this modifier on the `Form`:
```swift
            .onAppear {
                guard let thread, !hasLoadedThread else { return }
                hasLoadedThread = true
                brand = thread.brand
                number = thread.number
                colorName = thread.colorName ?? ""
                colorHex = thread.colorHex ?? ""
                if !colorHex.isEmpty {
                    pickerColor = Color(hex: colorHex)
                }
                fiberType = thread.fiberType
                format = thread.format
                quantity = thread.quantity
                barcode = thread.barcode ?? ""
                weightOrLength = thread.weightOrLength ?? ""
                lotNumber = thread.lotNumber ?? ""
                notes = thread.notes ?? ""
            }
```

Add `@State private var hasLoadedThread = false` to the state variables.

4. Change the Stepper from Int to Double with 0.25 step:
```swift
    Stepper(quantity.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", quantity)
            : String(format: "%g", quantity),
            value: $quantity, in: 0...999, step: 0.25)
```

5. Change navigation title:
```swift
            .navigationTitle(isEditing ? "Edit Thread" : "Add Thread")
```

6. Hide "Add Another" toggle in edit mode:
```swift
                if !isEditing {
                    Toggle("Add Another", isOn: $addAnother)
                }
```

7. Add Delete button in edit mode (add a new Section before the Toggle section):
```swift
                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            if let thread {
                                thread.deletedAt = Date()
                                thread.updatedAt = Date()
                            }
                            dismiss()
                        } label: {
                            HStack {
                                Spacer()
                                Text("Delete Thread")
                                Spacer()
                            }
                        }
                    }
                    .listRowBackground(Color.parchment)
                }
```

8. Update `saveThread()` to handle edit mode:
```swift
    private func saveThread() {
        let normalizedHex: String? = {
            guard !colorHex.isEmpty else { return nil }
            return colorHex.hasPrefix("#") ? colorHex : "#\(colorHex)"
        }()

        if let thread {
            // Edit mode — update existing thread
            thread.brand = brand
            thread.number = number
            thread.colorName = colorName.isEmpty ? nil : colorName
            thread.colorHex = normalizedHex
            thread.fiberType = fiberType
            thread.format = format
            thread.quantity = quantity
            thread.barcode = barcode.isEmpty ? nil : barcode
            thread.weightOrLength = weightOrLength.isEmpty ? nil : weightOrLength
            thread.lotNumber = lotNumber.isEmpty ? nil : lotNumber
            thread.notes = notes.isEmpty ? nil : notes
            thread.updatedAt = Date()
            dismiss()
        } else {
            // Add mode — create new thread
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

            if addAnother {
                number = ""
                colorName = ""
                colorHex = ""
                quantity = 1
                barcode = ""
                weightOrLength = ""
                lotNumber = ""
                notes = ""
            } else {
                dismiss()
            }
        }
    }
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift
git commit -m "feat(ios): add edit mode to AddThreadView with fractional quantity stepper"
```

---

### Task 8: Wire up tap-to-edit in ThreadListView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift:17,50-52,69-71`

**Step 1: Add selectedThread state and sheet**

Add a state variable after `showAddThread`:
```swift
    @State private var selectedThread: NeedleThread?
```

Wrap each `ThreadRowView` in the `ForEach` with a `Button` that sets `selectedThread`. Change lines 50-52 from:
```swift
                    ForEach(filteredThreads, id: \.id) { thread in
                        ThreadRowView(thread: thread)
                            .listRowBackground(Color.cream)
                    }
```
to:
```swift
                    ForEach(filteredThreads, id: \.id) { thread in
                        Button {
                            selectedThread = thread
                        } label: {
                            ThreadRowView(thread: thread)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(Color.cream)
                    }
```

Add a second `.sheet` for the edit view after the existing `showAddThread` sheet:
```swift
        .sheet(item: $selectedThread) { thread in
            AddThreadView(thread: thread)
        }
```

Note: `NeedleThread` already conforms to `Identifiable` (it has `var id: UUID`), so `.sheet(item:)` works out of the box.

**Step 2: Build and verify**

Run: `xcodebuild build -project apps/ios/stitchuation/stitchuation.xcodeproj -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -5`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/ThreadListView.swift
git commit -m "feat(ios): wire up tap-to-edit on thread rows in inventory list"
```
