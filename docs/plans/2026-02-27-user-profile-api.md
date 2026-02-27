# User Profile API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `GET /users/me` and `PATCH /users/me` API endpoints for user profile (displayName, bio, experienceLevel), then wire the iOS SettingsView to fetch/save profile via the API instead of local-only `@AppStorage`.

**Architecture:** New `users` module in the API with service, routes, and schemas following the existing thread/auth patterns. Drizzle migration adds `bio` and `experience_level` columns. iOS gets a `ProfileViewModel` that replaces `@AppStorage` with network calls through the existing `NetworkClient`.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL, Zod v4, SwiftUI, @Observable

---

### Task 1: Add bio and experience_level Columns to Users Table

**Files:**
- Modify: `apps/api/src/db/schema.ts:11-20`

**Step 1: Add the columns to the users table definition**

In `apps/api/src/db/schema.ts`, add two columns after `providerUserId` (line 17):

```typescript
  bio: text("bio"),
  experienceLevel: text("experience_level"),
```

The full `users` table should now be:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  providerUserId: text("provider_user_id"),
  bio: text("bio"),
  experienceLevel: text("experience_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate and run migration**

```bash
cd apps/api && npm run db:generate
cd apps/api && npm run db:migrate
```

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add bio and experience_level columns to users table"
```

---

### Task 2: Create User Service

**Files:**
- Create: `apps/api/src/users/user-service.ts`
- Create: `apps/api/src/users/schemas.ts`

**Step 1: Create the validation schema**

Create `apps/api/src/users/schemas.ts`:

```typescript
import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

**Step 2: Create the service**

Create `apps/api/src/users/user-service.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { NotFoundError } from "../errors.js";
import type { UpdateProfileInput } from "./schemas.js";

export class UserService {
  async getProfile(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        experienceLevel: users.experienceLevel,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundError("User");
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.experienceLevel !== undefined) updateData.experienceLevel = input.experienceLevel;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        bio: users.bio,
        experienceLevel: users.experienceLevel,
      });

    if (!user) throw new NotFoundError("User");
    return user;
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/users/
git commit -m "feat(api): add UserService with getProfile and updateProfile"
```

---

### Task 3: Create User Routes and Wire to App

**Files:**
- Create: `apps/api/src/users/user-routes.ts`
- Modify: `apps/api/src/app.ts:1-17`

**Step 1: Create the routes**

Create `apps/api/src/users/user-routes.ts`:

```typescript
import { Hono } from "hono";
import { UserService } from "./user-service.js";
import { updateProfileSchema } from "./schemas.js";
import { authMiddleware } from "../auth/middleware.js";
import type { AuthEnv } from "../auth/types.js";
import { NotFoundError } from "../errors.js";

const userRoutes = new Hono<AuthEnv>();
const userService = new UserService();

userRoutes.use("/*", authMiddleware);

userRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  try {
    const profile = await userService.getProfile(userId);
    return c.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

userRoutes.patch("/me", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const userId = c.get("userId");
  try {
    const profile = await userService.updateProfile(userId, parsed.data);
    return c.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

export { userRoutes };
```

**Step 2: Register routes in app.ts**

In `apps/api/src/app.ts`, add the import and route registration:

Add after line 6 (`import { imageRoutes }...`):
```typescript
import { userRoutes } from "./users/user-routes.js";
```

Add after line 15 (`app.route("/images", imageRoutes);`):
```typescript
app.route("/users", userRoutes);
```

**Step 3: Verify the dev server starts**

```bash
cd apps/api && npm run dev
```

In another terminal, test manually:
```bash
# Should get 401 (no auth)
curl -s http://localhost:3000/users/me | jq .
```

**Step 4: Commit**

```bash
git add apps/api/src/users/user-routes.ts apps/api/src/app.ts
git commit -m "feat(api): add GET/PATCH /users/me routes"
```

---

### Task 4: Write API Tests

**Files:**
- Create: `apps/api/tests/users/user-service.test.ts`
- Create: `apps/api/tests/users/user-routes.test.ts`

**Step 1: Write service tests**

Create `apps/api/tests/users/user-service.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { UserService } from "../../src/users/user-service.js";
import { AuthService } from "../../src/auth/auth-service.js";

describe("UserService", () => {
  const userService = new UserService();
  const authService = new AuthService();
  let userId: string;

  beforeAll(async () => {
    const result = await authService.register({
      email: `user-svc-${Date.now()}@example.com`,
      password: "securepassword123",
      displayName: "Test User",
    });
    userId = result.user.id;
  });

  describe("getProfile", () => {
    it("returns the user profile", async () => {
      const profile = await userService.getProfile(userId);
      expect(profile.id).toBe(userId);
      expect(profile.displayName).toBe("Test User");
      expect(profile.bio).toBeNull();
      expect(profile.experienceLevel).toBeNull();
    });

    it("throws NotFoundError for non-existent user", async () => {
      await expect(
        userService.getProfile("00000000-0000-0000-0000-000000000000")
      ).rejects.toThrow("User not found");
    });
  });

  describe("updateProfile", () => {
    it("updates displayName", async () => {
      const profile = await userService.updateProfile(userId, {
        displayName: "Updated Name",
      });
      expect(profile.displayName).toBe("Updated Name");
    });

    it("updates bio and experienceLevel", async () => {
      const profile = await userService.updateProfile(userId, {
        bio: "Loves needlepoint",
        experienceLevel: "Advanced",
      });
      expect(profile.bio).toBe("Loves needlepoint");
      expect(profile.experienceLevel).toBe("Advanced");
    });

    it("partially updates without overwriting other fields", async () => {
      await userService.updateProfile(userId, { bio: "Original bio" });
      const profile = await userService.updateProfile(userId, {
        experienceLevel: "Expert",
      });
      expect(profile.bio).toBe("Original bio");
      expect(profile.experienceLevel).toBe("Expert");
    });
  });
});
```

**Step 2: Write route tests**

Create `apps/api/tests/users/user-routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../src/app.js";

describe("User Routes", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-routes-${Date.now()}@example.com`,
        password: "securepassword123",
        displayName: "Route Tester",
      }),
    });
    const body = await res.json();
    accessToken = (body as any).accessToken;
  });

  describe("GET /users/me", () => {
    it("returns 200 with profile for authenticated user", async () => {
      const res = await app.request("/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect((body as any).displayName).toBe("Route Tester");
      expect((body as any).bio).toBeNull();
      expect((body as any).experienceLevel).toBeNull();
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/users/me");
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /users/me", () => {
    it("returns 200 with updated profile", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          displayName: "New Name",
          bio: "I love stitching",
          experienceLevel: "Intermediate",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect((body as any).displayName).toBe("New Name");
      expect((body as any).bio).toBe("I love stitching");
      expect((body as any).experienceLevel).toBe("Intermediate");
    });

    it("returns 400 for invalid experienceLevel", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ experienceLevel: "Master" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "test" }),
      });
      expect(res.status).toBe(401);
    });
  });
});
```

**Step 3: Run tests**

```bash
cd apps/api && npx vitest run tests/users/
```

Expected: All tests pass.

**Step 4: Run full test suite to verify no regressions**

```bash
cd apps/api && npx vitest run
```

**Step 5: Commit**

```bash
git add apps/api/tests/users/
git commit -m "test(api): add user profile service and route tests"
```

---

### Task 5: Create ProfileViewModel on iOS

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/ViewModels/ProfileViewModel.swift`

**Step 1: Create the view model**

Create `apps/ios/stitchuation/stitchuation/ViewModels/ProfileViewModel.swift`:

```swift
import Foundation
import Observation

struct UserProfile: Codable {
    let id: String
    let email: String
    let displayName: String
    let bio: String?
    let experienceLevel: String?
}

struct UpdateProfileRequest: Encodable {
    var displayName: String?
    var bio: String?
    var experienceLevel: String?
}

@MainActor
@Observable
final class ProfileViewModel {
    var displayName = ""
    var bio = ""
    var experienceLevel = "Beginner"
    var isLoading = false
    var errorMessage: String?

    private let networkClient: NetworkClient

    init(networkClient: NetworkClient) {
        self.networkClient = networkClient
    }

    func loadProfile() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let profile: UserProfile = try await networkClient.request(
                method: "GET",
                path: "/users/me"
            )
            displayName = profile.displayName
            bio = profile.bio ?? ""
            experienceLevel = profile.experienceLevel ?? "Beginner"
        } catch {
            // Silently fail — view shows whatever is in memory
        }
    }

    func saveProfile(displayName: String, bio: String, experienceLevel: String) async {
        do {
            let request = UpdateProfileRequest(
                displayName: displayName,
                bio: bio.isEmpty ? nil : bio,
                experienceLevel: experienceLevel
            )
            let profile: UserProfile = try await networkClient.request(
                method: "PATCH",
                path: "/users/me",
                body: request
            )
            self.displayName = profile.displayName
            self.bio = profile.bio ?? ""
            self.experienceLevel = profile.experienceLevel ?? "Beginner"
        } catch {
            errorMessage = "Failed to save profile. Please try again."
        }
    }
}
```

**Step 2: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/ViewModels/ProfileViewModel.swift
git commit -m "feat(ios): add ProfileViewModel with GET/PATCH /users/me support"
```

---

### Task 6: Wire ProfileViewModel into SettingsView and EditProfileSheet

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/SettingsView.swift:1-85`
- Modify: `apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift:1-112`
- Modify: `apps/ios/stitchuation/stitchuation/ContentView.swift:10-11,43`

**Step 1: Update ContentView to create and pass ProfileViewModel**

In `apps/ios/stitchuation/stitchuation/ContentView.swift`, replace lines 10-14:

```swift
struct ContentView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var selectedTab: AppTab = .journal
```

With:

```swift
struct ContentView: View {
    let networkClient: NetworkClient
    @Bindable var authViewModel: AuthViewModel

    @State private var profileViewModel: ProfileViewModel?
    @State private var selectedTab: AppTab = .journal
```

Then replace the Settings tab section (lines 42-48):

```swift
            NavigationStack {
                SettingsView(authViewModel: authViewModel)
            }
            .tag(AppTab.settings)
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
```

With:

```swift
            NavigationStack {
                if let profileViewModel {
                    SettingsView(authViewModel: authViewModel, profileViewModel: profileViewModel)
                }
            }
            .tag(AppTab.settings)
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
```

Add a `.task` modifier after `.tint(Color.terracotta)`:

```swift
        .tint(Color.terracotta)
        .task {
            let vm = ProfileViewModel(networkClient: networkClient)
            profileViewModel = vm
            await vm.loadProfile()
        }
```

**Step 2: Update SettingsView to use ProfileViewModel**

Replace SettingsView's properties and init (lines 4-9) from:

```swift
struct SettingsView: View {
    @Bindable var authViewModel: AuthViewModel

    @AppStorage("profileDisplayName") private var displayName = ""
    @AppStorage("profileBio") private var bio = ""
    @AppStorage("profileExperienceLevel") private var experienceLevel = "Beginner"
```

To:

```swift
struct SettingsView: View {
    @Bindable var authViewModel: AuthViewModel
    @Bindable var profileViewModel: ProfileViewModel
```

Replace all references to `displayName`, `bio`, `experienceLevel` in the view body to use `profileViewModel.displayName`, `profileViewModel.bio`, `profileViewModel.experienceLevel`.

Specifically update `initials` (line 31-33):

```swift
    private var initials: String {
        Self.computeInitials(from: profileViewModel.displayName)
    }
```

Update the `profileCard` section — replace `displayName` references:

```swift
            if !profileViewModel.displayName.isEmpty {
                Text(profileViewModel.displayName)
```

```swift
            if !profileViewModel.bio.isEmpty {
                Text(profileViewModel.bio)
```

```swift
            Text(profileViewModel.experienceLevel)
```

Update the `.sheet` modifier (lines 78-84):

```swift
        .sheet(isPresented: $showEditProfile) {
            EditProfileSheet(profileViewModel: profileViewModel)
        }
```

**Step 3: Rewrite EditProfileSheet to use ProfileViewModel**

Replace the entire contents of `apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift` with:

```swift
import SwiftUI

struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss

    @Bindable var profileViewModel: ProfileViewModel

    @State private var draftName: String = ""
    @State private var draftBio: String = ""
    @State private var draftLevel: String = ""
    @State private var isSaving = false

    init(profileViewModel: ProfileViewModel) {
        self.profileViewModel = profileViewModel
        _draftName = State(initialValue: profileViewModel.displayName)
        _draftBio = State(initialValue: profileViewModel.bio)
        _draftLevel = State(initialValue: profileViewModel.experienceLevel)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    // Name card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Profile")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        VStack(spacing: 0) {
                            TextField("Display Name", text: $draftName)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)

                            Divider().background(Color.parchment)

                            TextField("Bio (e.g. Needlepoint lover from Austin)", text: $draftBio, axis: .vertical)
                                .lineLimit(2...4)
                                .font(.typeStyle(.body))
                                .padding(.vertical, Spacing.md)
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)

                    // Experience level card
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Experience Level")
                            .font(.playfair(15, weight: .semibold))
                            .foregroundStyle(Color.walnut)

                        HStack(spacing: Spacing.sm) {
                            ForEach(SettingsView.experienceLevels, id: \.self) { level in
                                Button {
                                    draftLevel = level
                                } label: {
                                    Text(level)
                                        .font(draftLevel == level
                                            ? .typeStyle(.footnote).weight(.medium)
                                            : .typeStyle(.footnote))
                                        .foregroundStyle(draftLevel == level ? .white : Color.walnut)
                                        .padding(.horizontal, Spacing.md)
                                        .padding(.vertical, Spacing.sm)
                                        .background(draftLevel == level ? Color.terracotta : Color.linen)
                                        .clipShape(Capsule())
                                        .overlay(
                                            Capsule()
                                                .stroke(
                                                    draftLevel == level ? Color.clear : Color.slate.opacity(0.3),
                                                    lineWidth: 1
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(Spacing.lg)
                    .background(Color.cream)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.card))
                    .warmShadow(.subtle)
                    .padding(.horizontal, Spacing.lg)
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.linen)
            .navigationTitle("Edit Profile")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.terracotta)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        isSaving = true
                        Task {
                            await profileViewModel.saveProfile(
                                displayName: draftName,
                                bio: draftBio,
                                experienceLevel: draftLevel
                            )
                            isSaving = false
                            dismiss()
                        }
                    }
                    .disabled(draftName.isEmpty || isSaving)
                    .foregroundStyle(Color.terracotta)
                }
            }
        }
    }
}
```

**Step 4: Build and verify in simulator**

1. Launch app, go to Settings
2. Tap "Edit Profile", set name/bio/level, tap Save
3. Kill and relaunch — profile should reload from server
4. Check API response: profile data persists

**Step 5: Commit**

```bash
git add apps/ios/stitchuation/stitchuation/Views/SettingsView.swift apps/ios/stitchuation/stitchuation/Views/EditProfileSheet.swift apps/ios/stitchuation/stitchuation/ContentView.swift
git commit -m "feat(ios): wire SettingsView and EditProfileSheet to ProfileViewModel API"
```

---

### Task 7: Run Full Test Suite and Push

**Step 1: Run API tests**

```bash
cd apps/api && npx vitest run
```

Expected: All tests pass.

**Step 2: Push**

```bash
git push
```
