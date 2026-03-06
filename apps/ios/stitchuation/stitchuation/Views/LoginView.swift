import SwiftUI
import AuthenticationServices

struct LoginView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var showTitle = false
    @State private var showTagline = false
    @State private var showForm = false
    @State private var showEmailForm = false

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

                // Social login buttons
                VStack(spacing: Spacing.md) {
                    // Apple
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.email, .fullName]
                    } onCompletion: { result in
                        Task {
                            await authViewModel.handleAppleSignIn(result: result)
                        }
                    }
                    .signInWithAppleButtonStyle(.whiteOutline)
                    .frame(height: 50)
                    .cornerRadius(CornerRadius.subtle)

                    // Facebook
                    Button {
                        authViewModel.loginWithOAuth(provider: "facebook")
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "f.circle.fill")
                                .font(.system(size: 20))
                            Text("Continue with Facebook")
                        }
                        .font(.typeStyle(.headline))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color(red: 0.231, green: 0.349, blue: 0.596))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }
                    .disabled(authViewModel.isLoading)

                    // TikTok
                    Button {
                        authViewModel.loginWithOAuth(provider: "tiktok")
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "music.note")
                                .font(.system(size: 18))
                            Text("Continue with TikTok")
                        }
                        .font(.typeStyle(.headline))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.espresso)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }
                    .disabled(authViewModel.isLoading)

                    // Error message
                    if let error = authViewModel.errorMessage {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text(error)
                        }
                        .font(.typeStyle(.subheadline))
                        .foregroundStyle(Color.dustyRose)
                        .multilineTextAlignment(.center)
                        .padding(Spacing.md)
                        .frame(maxWidth: .infinity)
                        .background(Color.dustyRose.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.subtle))
                    }

                    // Loading indicator
                    if authViewModel.isLoading {
                        ProgressView()
                            .tint(Color.terracotta)
                    }

                    // Email fallback
                    if showEmailForm {
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
                    } else {
                        Button("Sign in with email") {
                            withAnimation(Motion.gentle) {
                                showEmailForm = true
                            }
                        }
                        .font(.typeStyle(.footnote))
                        .foregroundStyle(Color.walnut)
                    }
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
        .sheet(isPresented: Binding(
            get: { authViewModel.needsDisplayName },
            set: { authViewModel.needsDisplayName = $0 }
        )) {
            VStack(spacing: Spacing.xl) {
                Text("What should we call you?")
                    .font(.typeStyle(.title2))
                    .foregroundStyle(Color.espresso)

                TextField("Display Name", text: $authViewModel.displayName)
                    .textFieldStyle(.plain)
                    .font(.typeStyle(.body))
                    .padding(Spacing.md)
                    .background(Color.parchment)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))

                Button {
                    Task { await authViewModel.updateDisplayName() }
                } label: {
                    Text("Continue")
                        .font(.typeStyle(.headline))
                        .foregroundStyle(Color.cream)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(Color.terracotta)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                        .warmShadow(.elevated)
                }
                .disabled(authViewModel.displayName.isEmpty || authViewModel.isLoading)
            }
            .padding(Spacing.xl)
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
            .interactiveDismissDisabled()
        }
    }
}
