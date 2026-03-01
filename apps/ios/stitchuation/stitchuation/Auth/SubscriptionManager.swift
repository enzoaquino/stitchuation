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

    /// TestFlight builds bypass the paywall entirely
    static var isTestFlight: Bool {
        Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
    }

    // MARK: - State

    var isSubscribed = false
    var products: [Product] = []
    var purchaseError: String?
    var isLoading = false

    /// Current subscription info for Settings display
    var currentProductId: String?
    var expirationDate: Date?

    // nonisolated(unsafe) so deinit can cancel from a nonisolated context
    nonisolated(unsafe) private var transactionListener: Task<Void, Never>?

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
        if Self.isTestFlight {
            isSubscribed = true
            return
        }

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
