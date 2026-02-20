import SwiftUI
import AuthenticationServices

struct LoginView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var showTitle = false
    @State private var showTagline = false
    @State private var showForm = false

    var body: some View {
        ZStack {
            Color.linen.ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                Spacer()

                // Brand
                Text("Stitchuation")
                    .font(.typeStyle(.largeTitle))
                    .foregroundStyle(Color.espresso)
                    .opacity(showTitle ? 1 : 0)
                    .offset(y: showTitle ? 0 : 15)

                Text("Your craft companion")
                    .font(.sourceSerif(17, weight: .regular))
                    .italic()
                    .foregroundStyle(Color.walnut)
                    .opacity(showTagline ? 1 : 0)
                    .offset(y: showTagline ? 0 : 10)

                Spacer().frame(height: Spacing.lg)

                // Form
                VStack(spacing: Spacing.xl) {
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { _ in
                        // TODO: Wire up Apple sign-in with backend
                    }
                    .signInWithAppleButtonStyle(.whiteOutline)
                    .frame(height: 50)
                    .cornerRadius(CornerRadius.subtle)

                    HStack {
                        Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                        Text("or")
                            .font(.typeStyle(.footnote))
                            .foregroundStyle(Color.clay)
                        Rectangle().fill(Color.clay.opacity(0.3)).frame(height: 0.5)
                    }

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
                    .textFieldStyle(.plain)
                    .font(.typeStyle(.body))
                    .padding(Spacing.md)
                    .background(Color.parchment)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))

                    if let error = authViewModel.errorMessage {
                        Text(error)
                            .foregroundStyle(Color.terracotta)
                            .font(.typeStyle(.footnote))
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
                        Text(authViewModel.isRegistering ? "Create Account" : "Sign In")
                            .font(.typeStyle(.headline))
                            .foregroundStyle(Color.cream)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.md)
                            .background(Color.terracotta)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                            .warmShadow(.elevated)
                    }
                    .disabled(authViewModel.isLoading)

                    Button(authViewModel.isRegistering ? "Already have an account? Sign in" : "Create an account") {
                        authViewModel.isRegistering.toggle()
                    }
                    .font(.typeStyle(.footnote))
                    .foregroundStyle(Color.terracotta)
                }
                .padding(.horizontal, Spacing.xl)
                .opacity(showForm ? 1 : 0)
                .offset(y: showForm ? 0 : 15)

                Spacer()
            }
        }
        .onAppear {
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 0))) {
                showTitle = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 1))) {
                showTagline = true
            }
            withAnimation(Motion.gentle.delay(Motion.staggerDelay(index: 3))) {
                showForm = true
            }
        }
    }
}
