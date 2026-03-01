# Subscription & Paywall Design

## Overview

Stitchuation uses a subscription model with a 14-day free trial. The entire app is gated behind the subscription — no free tier, no feature limits. Users authenticate first (Sign in with Apple), then see a single-screen paywall to start their free trial.

## Pricing

| Plan | Price | Trial |
|------|-------|-------|
| Monthly | $3.99/mo | 14 days |
| Yearly | $39.99/yr ("2 months free") | 14 days |

Apple takes 15% (Small Business Program) or 30%.

## App Flow

```
Sign in with Apple → Onboarding Paywall → Start Free Trial (StoreKit) → Full App
                                        → Restore Purchase → Full App
```

Returning users with an active subscription skip the paywall entirely.

When a subscription lapses (trial expired, billing failure after grace period, cancellation), the user sees the paywall again on next launch.

## Components

### 1. SubscriptionManager

`@Observable` class wrapping StoreKit 2.

- Loads products on init: `com.stitchuation.monthly`, `com.stitchuation.yearly`
- Listens for `Transaction.updates` to catch renewals, cancellations, and refunds
- Exposes `isSubscribed: Bool` — checks for valid entitlement via `Transaction.currentEntitlement(for:)`
- Exposes `currentSubscription` (product info + renewal date) for Settings display
- Injected via `.environment()` at the app level, same pattern as `AuthViewModel`

### 2. PaywallView

Single screen shown after login when no active subscription exists.

- App logo and name at top
- 3–4 feature highlights with SF Symbol icons (project tracking, materials/shopping list, journal, cloud sync)
- Plan selector: monthly vs yearly with "2 months free" badge on yearly
- **"Start 14-Day Free Trial"** CTA button → triggers `Product.purchase()`
- "Restore Purchases" link below the CTA
- Fine print: "Cancel anytime. You won't be charged until the trial ends."
- Uses design system tokens (terracotta CTA, linen background, Playfair headers)

### 3. App Entry Point Change

In `stitchuationApp.swift`, the view selection becomes:

```
if !authenticated → LoginView
else if !subscribed → PaywallView
else → ContentView
```

### 4. Settings Subscription Row

New row in SettingsView's Account section:

- Shows current plan name, renewal date, and status (active/trial/expired)
- Taps to open Apple's native subscription management sheet (`ManageSubscriptionsSheet`)

## StoreKit Configuration

- Two auto-renewable subscription products in one subscription group
- Product IDs: `com.stitchuation.monthly`, `com.stitchuation.yearly`
- 14-day introductory offer (free trial) on both products
- StoreKit Configuration file (`.storekit`) for local testing without App Store Connect

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Trial expired, didn't subscribe | Paywall shown on next launch |
| Subscription lapses (billing issue) | Apple handles 16-day grace period; after that, StoreKit reports expired → paywall |
| Family Sharing | Not enabled |
| Offline | StoreKit 2 caches entitlements on-device, works offline |
| Restore on new device | "Restore Purchases" button on paywall calls `AppStore.sync()` |
| User deletes and reinstalls | Sign in with Apple → Restore Purchases → entitlement restored |

## Server-Side

No API changes. Subscription verification is purely client-side via StoreKit 2. The API continues to serve all authenticated users without knowledge of subscription status.
