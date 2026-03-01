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

    @Test @MainActor func initialStateIsNotSubscribed() {
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
