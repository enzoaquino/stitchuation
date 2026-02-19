import SwiftUI

private struct NetworkClientKey: EnvironmentKey {
    static let defaultValue: NetworkClient? = nil
}

extension EnvironmentValues {
    var networkClient: NetworkClient? {
        get { self[NetworkClientKey.self] }
        set { self[NetworkClientKey.self] = newValue }
    }
}
