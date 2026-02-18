import SwiftUI
import AuthenticationServices

struct LoginView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                Text("Stitchuation")
                    .font(.playfair(34, weight: .bold))
                    .foregroundStyle(Color.espresso)

                Text("Your craft companion")
                    .font(.sourceSerif(17))
                    .foregroundStyle(Color.walnut)

                Spacer().frame(height: Spacing.lg)

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.email, .fullName]
                } onCompletion: { _ in
                    // TODO: Wire up Apple sign-in with backend
                }
                .frame(height: 50)
                .cornerRadius(CornerRadius.subtle)
                .padding(.horizontal, Spacing.xl)

                HStack {
                    Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                    Text("or")
                        .font(.sourceSerif(13))
                        .foregroundStyle(Color.clay)
                    Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                }
                .padding(.horizontal, Spacing.xl)

                VStack(spacing: Spacing.md) {
                    if authViewModel.isRegistering {
                        TextField("Display Name", text: $authViewModel.displayName)
                    }
                    TextField("Email", text: $authViewModel.email)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField("Password", text: $authViewModel.password)
                        .textContentType(authViewModel.isRegistering ? .newPassword : .password)
                }
                .textFieldStyle(.roundedBorder)
                .font(.sourceSerif(17))
                .padding(.horizontal, Spacing.xl)

                if let error = authViewModel.errorMessage {
                    Text(error)
                        .foregroundStyle(Color.terracotta)
                        .font(.sourceSerif(13))
                }

                Button {
                    Task {
                        if authViewModel.isRegistering {
                            await authViewModel.register()
                        } else {
                            await authViewModel.login()
                        }
                    }
                } label: {
                    Text(authViewModel.isRegistering ? "Create Account" : "Log In")
                        .font(.sourceSerif(17, weight: .semibold))
                        .foregroundStyle(Color.cream)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .cornerRadius(CornerRadius.subtle)
                }
                .disabled(authViewModel.isLoading)
                .padding(.horizontal, Spacing.xl)

                Button(authViewModel.isRegistering ? "Already have an account? Log in" : "Create an account") {
                    authViewModel.isRegistering.toggle()
                }
                .font(.sourceSerif(13))
                .foregroundStyle(Color.terracotta)

                Spacer()
            }
        }
    }
}
