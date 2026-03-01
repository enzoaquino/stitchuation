# Subscription & Paywall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate the entire app behind a 14-day free trial subscription ($3.99/mo, $39.99/yr) using StoreKit 2, with a single-screen paywall shown after login.

**Architecture:** Client-side only — StoreKit 2 manages products, purchases, and entitlement checking on-device. A `SubscriptionManager` (`@Observable`) is injected via environment and checked in the app entry point between auth and content. No API changes.

**Tech Stack:** StoreKit 2, SwiftUI, Swift Testing

---

### Task 1: StoreKit Configuration File

Create a StoreKit configuration file for local testing. This lets the simulator process purchases without App Store Connect.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Configuration.storekit`

**Step 1: Create the StoreKit configuration file**

This is a JSON file. Create it with two auto-renewable subscription products in one group:

```json
{
  "identifier" : "8A14A12E",
  "nonRenewingSubscriptions" : [],
  "products" : [],
  "settings" : {
    "_applicationInternalID" : "1",
    "_developerTeamID" : "DEV_TEAM",
    "_failTransactionsEnabled" : false,
    "_locale" : "en_US",
    "_storefront" : "USA",
    "_storeKitErrors" : []
  },
  "subscriptionGroups" : [
    {
      "id" : "B2D7E1A0",
      "localizations" : [],
      "name" : "Stitchuation Premium",
      "subscriptions" : [
        {
          "adHocOffers" : [],
          "codeOffers" : [],
          "displayPrice" : "3.99",
          "familyShareable" : false,
          "groupNumber" : 1,
          "internalID" : "C1E2F3A4",
          "introductoryOffer" : {
            "displayPrice" : "0",
            "internalID" : "D5E6F7A8",
            "paymentMode" : "free",
            "subscriptionPeriod" : "P2W"
          },
          "localizations" : [
            {
              "description" : "Full access to Stitchuation, billed monthly",
              "displayName" : "Monthly",
              "locale" : "en_US"
            }
          ],
          "productID" : "com.stitchuation.monthly",
          "recurringSubscriptionPeriod" : "P1M",
          "referenceName" : "Monthly",
          "subscriptionGroupID" : "B2D7E1A0",
          "type" : "RecurringSubscription"
        },
        {
          "adHocOffers" : [],
          "codeOffers" : [],
          "displayPrice" : "39.99",
          "familyShareable" : false,
          "groupNumber" : 1,
          "internalID" : "E9F0A1B2",
          "introductoryOffer" : {
            "displayPrice" : "0",
            "internalID" : "F3A4B5C6",
            "paymentMode" : "free",
            "subscriptionPeriod" : "P2W"
          },
          "localizations" : [
            {
              "description" : "Full access to Stitchuation, billed yearly — 2 months free",
              "displayName" : "Yearly",
              "locale" : "en_US"
            }
          ],
          "productID" : "com.stitchuation.yearly",
          "recurringSubscriptionPeriod" : "P1Y",
          "referenceName" : "Yearly",
          "subscriptionGroupID" : "B2D7E1A0",
          "type" : "RecurringSubscription"
        }
      ]
    }
  ],
  "version" : {
    "major" : 4,
    "minor" : 0
  }
}
```

**Step 2: Verify the file is valid JSON**

Run: `cd apps/ios/stitchuation && python3 -c "import json; json.load(open('stitchuation/Configuration.storekit')); print('Valid')"`
Expected: `Valid`

**Note:** After this file exists, Xcode needs the scheme configured to use it (Edit Scheme → Run → Options → StoreKit Configuration → select `Configuration.storekit`). This is a manual Xcode step — remind the user.

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Configuration.storekit
git commit -m "feat(ios): add StoreKit configuration for subscription testing"
```

---

### Task 2: SubscriptionManager

Create the core subscription manager that wraps StoreKit 2. This is an `@Observable` class that loads products, checks entitlements, handles purchases, and listens for transaction updates.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Auth/SubscriptionManager.swift`
- Test: `apps/ios/stitchuation/stitchuationTests/SubscriptionManagerTests.swift`

**Step 1: Write the tests**

```swift
import Testing
import Foundation
@testable import stitchuation

struct SubscriptionManagerTests {

    // MARK: - Product IDs

    @Test func monthlyProductIdIsCorrect() {
        #expect(SubscriptionManager.monthlyProductId == "com.stitchuation.monthly")
    }

    @Test func yearlyProductIdIsCorrect() {
        #expect(SubscriptionManager.yearlyProductId == "com.stitchuation.yearly")
    }

    @Test func allProductIdsContainsBothProducts() {
        #expect(SubscriptionManager.allProductIds.count == 2)
        #expect(SubscriptionManager.allProductIds.contains("com.stitchuation.monthly"))
        #expect(SubscriptionManager.allProductIds.contains("com.stitchuation.yearly"))
    }

    // MARK: - Initial State

    @Test func initialStateIsNotSubscribed() {
        let manager = SubscriptionManager()
        #expect(manager.isSubscribed == false)
        #expect(manager.products.isEmpty)
        #expect(manager.purchaseError == nil)
        #expect(manager.isLoading == false)
    }

    // MARK: - Formatted Price Helpers

    @Test func formattedSavingsBadgeReturns2MonthsFree() {
        #expect(SubscriptionManager.savingsBadge == "2 months free")
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -only-testing:stitchuationTests/SubscriptionManagerTests 2>&1 | tail -20`
Expected: FAIL — `SubscriptionManager` not found

**Step 3: Implement SubscriptionManager**

```swift
import Foundation
import Observation
import StoreKit

@MainActor
@Observable
final class SubscriptionManager {

    // MARK: - Product IDs

    static let monthlyProductId = "com.stitchuation.monthly"
    static let yearlyProductId = "com.stitchuation.yearly"
    static let allProductIds: Set<String> = [monthlyProductId, yearlyProductId]
    static let savingsBadge = "2 months free"

    // MARK: - State

    var isSubscribed = false
    var products: [Product] = []
    var purchaseError: String?
    var isLoading = false

    /// Current subscription info for Settings display
    var currentProductId: String?
    var expirationDate: Date?

    private var transactionListener: Task<Void, Never>?

    // MARK: - Computed

    var monthlyProduct: Product? {
        products.first { $0.id == Self.monthlyProductId }
    }

    var yearlyProduct: Product? {
        products.first { $0.id == Self.yearlyProductId }
    }

    // MARK: - Lifecycle

    init() {
        transactionListener = listenForTransactions()
    }

    deinit {
        transactionListener?.cancel()
    }

    // MARK: - Load Products

    func loadProducts() async {
        do {
            products = try await Product.products(for: Self.allProductIds)
                .sorted { $0.price < $1.price }
        } catch {
            purchaseError = "Could not load subscription options."
        }
    }

    // MARK: - Check Entitlement

    func checkSubscriptionStatus() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               Self.allProductIds.contains(transaction.productID) {
                isSubscribed = true
                currentProductId = transaction.productID
                expirationDate = transaction.expirationDate
                return
            }
        }
        isSubscribed = false
        currentProductId = nil
        expirationDate = nil
    }

    // MARK: - Purchase

    func purchase(_ product: Product) async {
        isLoading = true
        purchaseError = nil
        defer { isLoading = false }

        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    await checkSubscriptionStatus()
                } else {
                    purchaseError = "Purchase could not be verified."
                }
            case .userCancelled:
                break
            case .pending:
                purchaseError = "Purchase is pending approval."
            @unknown default:
                purchaseError = "Something went wrong."
            }
        } catch {
            purchaseError = "Purchase failed. Please try again."
        }
    }

    // MARK: - Restore

    func restorePurchases() async {
        isLoading = true
        defer { isLoading = false }
        try? await AppStore.sync()
        await checkSubscriptionStatus()
    }

    // MARK: - Transaction Listener

    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    await self?.checkSubscriptionStatus()
                }
            }
        }
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -only-testing:stitchuationTests/SubscriptionManagerTests 2>&1 | tail -20`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Auth/SubscriptionManager.swift apps/ios/stitchuation/stitchuationTests/SubscriptionManagerTests.swift
git commit -m "feat(ios): add SubscriptionManager wrapping StoreKit 2"
```

---

### Task 3: PaywallView

Create the single-screen paywall shown after login. Displays feature highlights, plan options with toggle, and a "Start Free Trial" CTA.

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/PaywallView.swift`

**Step 1: Create PaywallView**

```swift
import SwiftUI
import StoreKit

struct PaywallView: View {
    @Environment(SubscriptionManager.self) private var subscriptionManager

    @State private var selectedPlan: SelectedPlan = .yearly
    @State private var showLogo = false
    @State private var showFeatures = false
    @State private var showPlans = false
    @State private var showCTA = false

    enum SelectedPlan {
        case monthly, yearly
    }

    private let features: [(icon: String, title: String, description: String)] = [
        ("paintbrush.pointed", "Track Projects", "From stash to finished piece"),
        ("list.clipboard", "Manage Materials", "Kit projects and build shopping lists"),
        ("book", "Stitch Journal", "Log progress with photos and notes"),
        ("icloud", "Cloud Sync", "Access your collection on all devices"),
    ]

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.xl) {
                    Spacer().frame(height: Spacing.xl)

                    // Logo & tagline
                    VStack(spacing: Spacing.sm) {
                        Text("Stitchuation")
                            .font(.typeStyle(.largeTitle))
                            .foregroundStyle(Color.espresso)

                        Text("Your craft companion")
                            .font(.sourceSerif(17, weight: .regular))
                            .italic()
                            .foregroundStyle(Color.walnut)
                    }
                    .opacity(showLogo ? 1 : 0)
                    .offset(y: showLogo ? 0 : 15)

                    // Feature highlights
                    VStack(spacing: Spacing.md) {
                        ForEach(Array(features.enumerated()), id: \.offset) { _, feature in
                            featureRow(icon: feature.icon, title: feature.title, description: feature.description)
                        }
                    }
                    .padding(.horizontal, Spacing.lg)
                    .opacity(showFeatures ? 1 : 0)
                    .offset(y: showFeatures ? 0 : 15)

                    // Plan selector
                    planSelector
                        .padding(.horizontal, Spacing.lg)
                        .opacity(showPlans ? 1 : 0)
                        .offset(y: showPlans ? 0 : 15)

                    // CTA + Restore + Fine print
                    VStack(spacing: Spacing.md) {
                        startTrialButton
                        restoreButton
                        finePrint
                    }
                    .padding(.horizontal, Spacing.lg)
                    .opacity(showCTA ? 1 : 0)
                    .offset(y: showCTA ? 0 : 15)

                    Spacer().frame(height: Spacing.xxl)
                }
            }
        }
        .onAppear {
            Task { await subscriptionManager.loadProducts() }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showLogo = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 2))) {
                showFeatures = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 4))) {
                showPlans = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 6))) {
                showCTA = true
            }
        }
    }

    // MARK: - Feature Row

    private func featureRow(icon: String, title: String, description: String) -> some View {
        HStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(Color.terracotta)
                .frame(width: 40, alignment: .center)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(title)
                    .font(.typeStyle(.headline))
                    .foregroundStyle(Color.espresso)
                Text(description)
                    .font(.typeStyle(.subheadline))
                    .foregroundStyle(Color.walnut)
            }

            Spacer()
        }
        .padding(Spacing.md)
        .background(Color.cream)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
        .warmShadow(.subtle)
    }

    // MARK: - Plan Selector

    private var planSelector: some View {
        VStack(spacing: Spacing.md) {
            planCard(
                plan: .yearly,
                label: "Yearly",
                price: subscriptionManager.yearlyProduct?.displayPrice ?? "$39.99",
                detail: "/year",
                badge: SubscriptionManager.savingsBadge
            )

            planCard(
                plan: .monthly,
                label: "Monthly",
                price: subscriptionManager.monthlyProduct?.displayPrice ?? "$3.99",
                detail: "/month",
                badge: nil
            )
        }
    }

    private func planCard(plan: SelectedPlan, label: String, price: String, detail: String, badge: String?) -> some View {
        Button {
            withAnimation(Motion.quick) {
                selectedPlan = plan
            }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    HStack(spacing: Spacing.sm) {
                        Text(label)
                            .font(.typeStyle(.headline))
                            .foregroundStyle(Color.espresso)

                        if let badge {
                            Text(badge)
                                .font(.typeStyle(.footnote))
                                .fontWeight(.medium)
                                .foregroundStyle(.white)
                                .padding(.horizontal, Spacing.sm)
                                .padding(.vertical, Spacing.xxs)
                                .background(Color.sage)
                                .clipShape(Capsule())
                        }
                    }

                    Text("\(price)\(detail)")
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.walnut)
                }

                Spacer()

                Image(systemName: selectedPlan == plan ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 24))
                    .foregroundStyle(selectedPlan == plan ? Color.terracotta : Color.clay.opacity(0.4))
            }
            .padding(Spacing.lg)
            .background(Color.cream)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.card)
                    .stroke(selectedPlan == plan ? Color.terracotta : Color.clear, lineWidth: 2)
            )
            .warmShadow(.subtle)
        }
        .buttonStyle(.plain)
    }

    // MARK: - CTA

    private var startTrialButton: some View {
        Button {
            Task {
                let product: Product? = selectedPlan == .yearly
                    ? subscriptionManager.yearlyProduct
                    : subscriptionManager.monthlyProduct
                if let product {
                    await subscriptionManager.purchase(product)
                }
            }
        } label: {
            VStack(spacing: Spacing.xxs) {
                Text("Start 14-Day Free Trial")
                    .font(.typeStyle(.headline))
                    .foregroundStyle(.white)
                Text(selectedPlan == .yearly ? "then $39.99/year" : "then $3.99/month")
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(.white.opacity(0.8))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.lg)
            .background(Color.terracotta)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
            .warmShadow(.elevated)
        }
        .disabled(subscriptionManager.isLoading || subscriptionManager.products.isEmpty)
    }

    private var restoreButton: some View {
        Button {
            Task { await subscriptionManager.restorePurchases() }
        } label: {
            Text("Restore Purchases")
                .font(.typeStyle(.subheadline))
                .foregroundStyle(Color.terracotta)
        }
    }

    private var finePrint: some View {
        VStack(spacing: Spacing.xs) {
            if let error = subscriptionManager.purchaseError {
                Text(error)
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.dustyRose)
            }

            Text("Cancel anytime. You won't be charged until the trial ends.\nPayment will be charged to your Apple ID account.")
                .font(.typeStyle(.footnote))
                .foregroundStyle(Color.clay)
                .multilineTextAlignment(.center)
        }
    }
}
```

**Step 2: Build to verify no compilation errors**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/PaywallView.swift
git commit -m "feat(ios): add PaywallView with plan selector and trial CTA"
```

---

### Task 4: Wire SubscriptionManager into App Entry Point

Inject `SubscriptionManager` into the environment and add the paywall gate between auth and content in `stitchuationApp.swift`.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/stitchuationApp.swift`

**Step 1: Add SubscriptionManager state and inject it**

Add a new `@State` property alongside the existing ones:

```swift
@State private var subscriptionManager = SubscriptionManager()
```

**Step 2: Update the `contentView` computed property**

Replace the existing `contentView` (lines 92–110) to insert the paywall between auth and content:

```swift
@ViewBuilder
private var contentView: some View {
    if let authViewModel {
        if authViewModel.isAuthenticated {
            if subscriptionManager.isSubscribed {
                ContentView(networkClient: networkClient, authViewModel: authViewModel)
                    .environment(subscriptionManager)
                    .task {
                        guard let syncEngine else { return }
                        try? await syncEngine.sync()
                    }
            } else {
                PaywallView()
                    .environment(subscriptionManager)
            }
        } else {
            LoginView(networkClient: networkClient, authViewModel: authViewModel)
        }
    } else {
        ZStack {
            Color.linen.ignoresSafeArea()
            ProgressView()
                .tint(Color.terracotta)
        }
    }
}
```

**Step 3: Check subscription status on launch**

In the existing `.task` block, after setting `authViewModel = auth`, add:

```swift
await subscriptionManager.checkSubscriptionStatus()
```

Add it right after line 70 (`authViewModel = auth`).

**Step 4: Also check when returning from background**

In the `.onReceive` for `willEnterForegroundNotification`, add:

```swift
Task { await subscriptionManager.checkSubscriptionStatus() }
```

This catches cases where the user subscribes/cancels via Settings → Subscriptions while the app is backgrounded.

**Step 5: Build and verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 6: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/stitchuationApp.swift
git commit -m "feat(ios): wire SubscriptionManager into app entry point with paywall gate"
```

---

### Task 5: Subscription Row in Settings

Add a subscription management section to SettingsView showing the current plan, renewal date, and a link to Apple's subscription management sheet.

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/SettingsView.swift`

**Step 1: Add environment property**

Add at the top of `SettingsView`, alongside the other properties:

```swift
@Environment(SubscriptionManager.self) private var subscriptionManager
```

**Step 2: Add `subscriptionSection` computed property**

Add after `accountSection`:

```swift
// MARK: - Subscription Section

@State private var showManageSubscription = false

private var subscriptionSection: some View {
    VStack(alignment: .leading, spacing: Spacing.md) {
        Text("Subscription")
            .font(.playfair(15, weight: .semibold))
            .foregroundStyle(Color.walnut)
            .padding(.horizontal, Spacing.lg)

        Button {
            showManageSubscription = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    Text(subscriptionPlanName)
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.espresso)
                    if let date = subscriptionManager.expirationDate {
                        Text("Renews \(date.formatted(.dateTime.month(.abbreviated).day().year()))")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.clay)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.clay)
            }
            .padding(Spacing.lg)
            .background(Color.cream)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
            .warmShadow(.subtle)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.lg)
    }
    .manageSubscriptionsSheet(isPresented: $showManageSubscription)
}

private var subscriptionPlanName: String {
    switch subscriptionManager.currentProductId {
    case SubscriptionManager.monthlyProductId:
        return "Monthly Plan"
    case SubscriptionManager.yearlyProductId:
        return "Yearly Plan"
    default:
        return "Premium"
    }
}
```

**Note:** The `showManageSubscription` `@State` property must be added to the struct's stored properties (not inside the computed property). Move it up next to `@State private var showEditProfile = false`.

**Step 3: Insert subscriptionSection in body**

In the body's `VStack`, add `subscriptionSection` between `statsSection` and `accountSection`:

```swift
VStack(spacing: Spacing.xl) {
    profileCard
    statsSection
    subscriptionSection
    accountSection
}
```

**Step 4: Build and verify**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/SettingsView.swift
git commit -m "feat(ios): add subscription management row to Settings"
```

---

### Task 6: Run Full Test Suite

Verify everything compiles and all existing tests still pass.

**Step 1: Build the project**

Run: `cd apps/ios/stitchuation && xcodebuild build -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

**Step 2: Run all tests**

Run: `cd apps/ios/stitchuation && xcodebuild test -scheme stitchuation -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' 2>&1 | grep -E '(Test Suite|Tests Passed|Tests Failed|PASS|FAIL)' | tail -20`
Expected: All tests pass, no regressions

**Step 3: If any tests fail, investigate and fix**

Common issues:
- `SettingsView` tests may need `SubscriptionManager` in environment — check `SettingsStatsTests.swift` (these test static methods, so should be fine)
- If build fails on `SubscriptionManager` environment missing, ensure it's injected everywhere `SettingsView` is used

**Step 4: Final commit if any fixes were needed**

```bash
git commit -m "fix(ios): resolve test failures from subscription integration"
```

---

## Manual Steps (Post-Implementation)

These require Xcode UI interaction and cannot be automated:

1. **Configure StoreKit in scheme**: Edit Scheme → Run → Options → StoreKit Configuration → select `Configuration.storekit`
2. **Add In-App Purchase capability**: Signing & Capabilities → + Capability → In-App Purchase
3. **Test in Simulator**: Launch app → log in → paywall should appear → tap "Start Free Trial" → StoreKit sandbox sheet appears → confirm → app loads

## Future App Store Connect Steps (Not Part of This Plan)

- Create subscription products in App Store Connect matching the product IDs
- Configure introductory offers (14-day free trial)
- Set up subscription group "Stitchuation Premium"
- Submit for review
