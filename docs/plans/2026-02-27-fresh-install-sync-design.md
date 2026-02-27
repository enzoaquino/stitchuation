# Fresh Install Sync Fix

## Problem

After deleting and reinstalling the app, server data (threads, pieces, journal entries) never loads. Two broken paths:

**Path A (Keychain survives):** iOS Keychain persists across reinstalls. Old JWT tokens are found, `isAuthenticated = true`, but the token is expired. Sync returns 401, `try?` swallows the error silently. Empty database.

**Path B (Keychain cleared):** User must log in again. Login succeeds, but sync only runs in the `.task {}` modifier on launch — which already executed before login happened. Sync is never triggered post-login.

## Solution

Approach 2 + sync-after-login: detect fresh installs via a UserDefaults marker, clear stale Keychain tokens, and trigger sync whenever authentication succeeds.

## Changes

### 1. Fresh install detection — `stitchuationApp.init()`

Store `"hasLaunchedBefore"` in UserDefaults. On launch, if missing:
- Clear `accessToken` and `refreshToken` from Keychain
- Clear `lastSyncTimestamp` from UserDefaults (so first sync sends `lastSync: null` and gets all data)
- Set the flag

This runs before any auth check or sync.

### 2. Sync after login — `stitchuationApp.body`

Add `.onChange(of: authViewModel?.isAuthenticated)` that triggers sync when auth transitions from `false` to `true`. Covers both login and register flows without modifying AuthViewModel.

## Files Modified

- `apps/ios/stitchuation/stitchuation/stitchuationApp.swift` — fresh install detection in `init()`, `.onChange` for sync-after-login

## No API Changes

Server already handles `lastSync: null` correctly (returns all data since epoch).
