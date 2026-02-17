# Needlepoint App Design

A native iOS/iPad app for managing needlepoint thread inventory and projects, backed by a TypeScript REST API.

## Problem

Needlepointers lack app support for managing their craft. The core pain points are thread/supply management, progress tracking, and pattern management. The MVP focuses on thread inventory — tracking owned threads by brand, number, and color so users know what they have and what they need to buy.

## Architecture

**Approach:** SwiftData local-first + REST API sync.

- **iOS/iPad app** — SwiftUI with SwiftData for local persistence. All writes go to SwiftData first for instant offline response. A SyncEngine queues changes and pushes/pulls when online.
- **API** — Node.js/TypeScript with Hono or Fastify, PostgreSQL with Drizzle ORM, JWT auth.
- **Sync** — Timestamp-based last-write-wins per record. Single `/sync` endpoint handles bulk push/pull.

```
┌─────────────────────────┐        ┌─────────────────────────┐
│   iOS/iPad App (SwiftUI)│        │   API (Node.js/TS)      │
│                         │        │                         │
│  UI Layer (SwiftUI)     │        │  Routes/Controllers     │
│  Domain Layer (VMs)     │ HTTPS  │  Service Layer          │
│  Data Layer (SwiftData) │◄──────►│  Data Layer (PostgreSQL)│
│  SyncEngine             │        │                         │
└─────────────────────────┘        └─────────────────────────┘
```

## Data Model

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | string | From auth provider or manual entry |
| displayName | string | |
| provider | string | apple, instagram, tiktok, email |
| providerUserId | string | ID from the auth provider |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Thread

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | Owner |
| brand | string | e.g., "DMC", "Appleton", "Paternayan" |
| number | string | Thread/color number, e.g., "310" |
| colorName | string? | e.g., "Black", "Sea Green" |
| colorHex | string? | For displaying a color swatch |
| fiberType | enum | wool, cotton, silk, synthetic, blend, other |
| quantity | integer | Skeins/cards in stock |
| barcode | string? | UPC/EAN from label, for scan-to-add |
| weightOrLength | string? | e.g., "8m skein", "5.5yd card" |
| notes | string? | Free text |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| deletedAt | timestamp? | Soft delete for sync |

Key decisions:
- `brand` and `number` are free text, not foreign keys to a catalog. Supports the hybrid approach: manual entry now, autocomplete/catalog matching later.
- `barcode` is optional, ready for a future scan feature. DMC UPCs are well-cataloged (prefix `077540`); niche brands are sparse in public databases.
- `colorHex` is optional for visual swatches when available.
- Soft deletes propagate through sync.

### Project

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | Owner |
| name | string | e.g., "Christmas Stocking" |
| status | enum | not_started, in_progress, completed |
| canvasSize | string? | e.g., "13 mesh, 14x18" |
| imageUrl | string? | Photo of the project/pattern |
| notes | string? | |
| startedAt | timestamp? | |
| completedAt | timestamp? | |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| deletedAt | timestamp? | Soft delete for sync |

### ProjectSection

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| projectId | UUID | Parent project |
| name | string | e.g., "Background", "Border", "Center motif" |
| sortOrder | integer | Display ordering |
| status | enum | not_started, in_progress, completed |
| notes | string? | |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| deletedAt | timestamp? | Soft delete for sync |

Sections are optional. A project without sections works as a flat list of thread requirements.

### ProjectThread

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| projectId | UUID | Parent project |
| sectionId | UUID? | Optional link to a section |
| threadId | UUID? | Optional link to inventory Thread |
| brand | string | Denormalized — works without inventory match |
| number | string | Denormalized |
| colorName | string? | Denormalized |
| quantityNeeded | integer | Skeins/cards required |
| notes | string? | |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| deletedAt | timestamp? | Soft delete for sync |

The bridge between projects and inventory:
- `threadId` optionally links to a Thread in inventory
- If linked: app shows "You have 3, need 5 — buy 2 more"
- If not linked: shows as "need to buy"
- Thread info is denormalized so ProjectThread works independently of inventory
- Supports per-section readiness: "You can start the Border, need threads for Center motif"

## Authentication

Four providers, all following the same flow: app authenticates with provider → sends identity token to API → API verifies and issues JWT.

| Provider | Priority | Notes |
|----------|----------|-------|
| Sign in with Apple | Required | Apple mandates it when offering other social logins |
| Instagram (Meta) | High | Core needlepoint community platform |
| TikTok | High | Growing needlepoint community, Login Kit available |
| Email/password | Fallback | For users who prefer not to use social login |

Token management:
- Short-lived access token + long-lived refresh token
- Access token stored in iOS Keychain
- Refresh token rotates silently — user stays logged in

## App Navigation & UX

### Tab Bar (iPhone) / Sidebar (iPad)

- **Inventory** — Thread list, thread detail/edit, add thread
- **Projects** — Project list, project detail with sections, readiness indicators
- **Settings** — Account, sync status

### Key UX Details

**Thread List** — Most-used screen. Search by brand/number/color name. Filter by brand, fiber type. Quantity shown inline with quick +/- stepper. Color swatch dot when `colorHex` available.

**Add Thread** — Optimized for batch entry. Brand field autocompletes from user's history. After saving, stays on add screen with brand pre-filled.

**Project Readiness** — Green/yellow/red indicator per section based on thread availability. One-tap "Add to shopping list" for missing threads.

**iPad** — Sidebar navigation, split view for list+detail, larger tap targets for use while crafting.

## Sync & Conflict Resolution

### Change Tracking

Every synced model has `updatedAt`, `deletedAt`, and a local-only `syncedAt`. Client tracks a single `lastSyncTimestamp` cursor.

### Sync Protocol

Client sends all queued changes to `POST /sync` with its `lastSyncTimestamp`. Server applies changes using last-write-wins (compare `updatedAt`), then returns all server-side changes newer than the client's timestamp.

### Conflict Resolution: Last-Write-Wins Per Record

- Incoming `updatedAt` newer than server → accept client change
- Server `updatedAt` newer → ignore client change, return server version
- Deletes win over updates (delete is an update to `deletedAt`)

This works because: single user per account, data is simple counts/text, no collaborative editing.

### Sync Triggers

| Trigger | Behavior |
|---------|----------|
| App launch | Sync immediately if online |
| Return to foreground | Sync if >1 minute since last sync |
| After local write | Queue change, sync after 2s debounce |
| Pull to refresh | Force sync |
| Background fetch | iOS background app refresh |

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login (email/password) |
| POST | /auth/provider | Social login (Apple/Instagram/TikTok) |
| GET | /threads | List user's threads |
| POST | /threads | Create thread |
| PUT | /threads/:id | Update thread |
| DELETE | /threads/:id | Soft delete thread |
| GET | /projects | List user's projects |
| POST | /projects | Create project |
| PUT | /projects/:id | Update project |
| DELETE | /projects/:id | Soft delete project |
| GET | /projects/:id/sections | List sections |
| POST | /projects/:id/sections | Create section |
| PUT | /projects/:id/sections/:id | Update section |
| DELETE | /projects/:id/sections/:id | Soft delete section |
| GET | /projects/:id/threads | List project threads |
| POST | /projects/:id/threads | Add thread to project |
| PUT | /projects/:id/threads/:id | Update project thread |
| DELETE | /projects/:id/threads/:id | Soft delete project thread |
| POST | /sync | Bulk sync (push/pull all changes) |

## Testing Strategy

**iOS:**
- Unit tests (XCTest) — ViewModels, SyncEngine, data transformations
- SwiftData tests — Model persistence and queries
- UI tests (XCUITest) — Add thread, edit quantity, create project
- Sync tests — Mock API, verify conflict resolution and offline queuing

**API:**
- Unit tests (Vitest) — Services, validation, conflict resolution
- Integration tests — Full request/response against test PostgreSQL
- Auth tests — Token lifecycle, provider verification
- Sync endpoint tests — Bulk changes, conflicts, deletes, initial sync

## Deployment

**API:** Railway or Fly.io with managed PostgreSQL. GitHub Actions CI/CD: lint → test → deploy on push to main. Two environments: dev (local) and production.

**iOS:** TestFlight for initial testing, App Store later. Xcode Cloud or GitHub Actions for builds.

## Project Structure

```
needlepoint/
├── apps/
│   ├── ios/                  # Xcode project
│   │   ├── Needlepoint/
│   │   │   ├── Models/       # SwiftData models
│   │   │   ├── Views/        # SwiftUI views
│   │   │   ├── ViewModels/   # Observable view models
│   │   │   ├── Sync/         # SyncEngine, NetworkClient
│   │   │   └── Auth/         # Auth providers
│   │   └── NeedlepointTests/
│   └── api/                  # Node.js/TypeScript API
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── db/           # Drizzle schema, migrations
│       │   ├── auth/
│       │   └── sync/
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   └── plans/
└── README.md
```

## MVP Scope

Phase 1 (MVP): Thread inventory with offline-first sync, multi-user auth.
Phase 2: Project management with sections and thread linking, readiness indicators, shopping list.
Phase 3: Barcode scanning, thread catalog autocomplete, pattern viewer.
