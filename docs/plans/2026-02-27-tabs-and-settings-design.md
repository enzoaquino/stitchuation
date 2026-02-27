# Tabs Reorder & Settings Page Design

## Tab Bar Changes

**New order and labels:**
1. **Journal** (was "Projects") — `paintbrush.pointed` — default landing tab
2. **Stash** (was "Stitch Stash") — `square.stack.3d.up`
3. **Threads** (was "Inventory") — `tray.full`
4. **Settings** — `gear`

Use `@State selectedTab` defaulting to `.journal` so the app opens to Journal.

## Settings Page

Single ScrollView with linen background, three sections:

### Profile Card (cream card)
- **Initials circle**: 64pt, terracotta background, white Playfair initials
- **Display name**: Playfair, espresso
- **Bio**: body font, walnut, 2-3 lines
- **Experience level badge**: chip with terracottaMuted background ("Beginner" / "Intermediate" / "Advanced" / "Expert")
- **"Edit Profile" link**: terracotta, opens edit sheet

**Edit sheet**: display name text field, bio text field (multiline), experience level picker. All stored via `@AppStorage`.

### Stats Section
Header: "Your Stitching" (Playfair)

2-column LazyVGrid of cream stat cards, each showing a large number (Playfair, espresso) and label (body, clay):

| Stat | Label | Query |
|------|-------|-------|
| Finished pieces count | "Completed" | statusRaw == "finished", not deleted |
| Active projects count | "In Progress" | status.isActive, not deleted |
| Stash canvases count | "In Stash" | statusRaw == "stash", not deleted |
| Thread count | "Threads" | NeedleThread, not deleted |
| Finished this year | "This Year" | finished + completedAt in current year |
| Earliest createdAt | "Member Since" | min createdAt across all StitchPieces |

### Account Section (cream card)
- **Logout button**: full-width, destructive style, centered terracotta text
- **App version footer**: below card, clay text, "Stitchuation v1.0"

### Data Storage
- Profile fields (displayName, bio, experienceLevel) via `@AppStorage`
- Stats computed from SwiftData `@Query` at render time
- No new models needed
