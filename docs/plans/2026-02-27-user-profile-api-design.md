# User Profile API Design

## Goal

Add server-side storage for user profile fields (displayName, bio, experienceLevel) with `GET /users/me` and `PATCH /users/me` endpoints, and wire the iOS SettingsView to fetch/save profile via the API instead of local-only `@AppStorage`.

## API

**Schema change:** Add `bio` (text, nullable) and `experience_level` (text, nullable) to `users` table.

**Routes** (`GET /users/me`, `PATCH /users/me`) behind auth middleware:
- GET returns `{ id, email, displayName, bio, experienceLevel }`
- PATCH accepts partial `{ displayName?, bio?, experienceLevel? }`, returns updated profile

**Service** (`UserService`): `getProfile(userId)` and `updateProfile(userId, input)`.

## iOS

Replace `@AppStorage` in SettingsView with a `ProfileViewModel` (`@Observable`) that:
- Holds `displayName`, `bio`, `experienceLevel` in memory
- Loads from `GET /users/me` on appear
- Saves via `PATCH /users/me` when EditProfileSheet saves
- Falls back gracefully if offline

EditProfileSheet takes the view model directly instead of bindings.

## Data Storage

- Profile lives on the server, fetched on login/appear
- No local persistence needed — if offline, the view shows whatever was last loaded
- `@AppStorage` keys removed
