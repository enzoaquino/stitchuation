import Foundation
import SwiftData
import Observation

@MainActor
@Observable
final class ThreadListViewModel {
    var searchText = ""
    var selectedBrandFilter: String?
    var selectedFiberFilter: FiberType?
}
