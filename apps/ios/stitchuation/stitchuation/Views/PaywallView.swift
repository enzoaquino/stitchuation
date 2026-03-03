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
                if subscriptionManager.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Start 14-Day Free Trial")
                        .font(.typeStyle(.headline))
                        .foregroundStyle(.white)
                    Text(selectedPlan == .yearly ? "then $39.99/year" : "then $3.99/month")
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(.white.opacity(0.8))
                }
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
