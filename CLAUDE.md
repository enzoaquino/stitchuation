# Stitchuation

Needlepoint thread inventory and project management app for iOS/iPad with a TypeScript REST API.
App name: **Stitchuation** (see `docs/plans/2026-02-17-app-naming-design.md`).

## Architecture

Monorepo: `apps/api/` (TypeScript) and `apps/ios/` (Swift)

- **API**: Hono + Drizzle ORM + PostgreSQL + Zod + JWT auth
- **iOS**: SwiftUI + SwiftData, offline-first with timestamp-based sync
- **Sync**: Last-write-wins per record via `POST /sync`, soft deletes with `deletedAt`
- **Auth**: Sign in with Apple (required), Instagram, TikTok, email/password

## Key Documents

- Design doc: `docs/plans/2026-02-16-needlepoint-app-design.md`
- Design system: `docs/plans/2026-02-16-design-system.md`
- Implementation plan: `docs/plans/2026-02-16-needlepoint-implementation-plan.md`
- App naming: `docs/plans/2026-02-17-app-naming-design.md`

## Code Style

- Conventional commits with scope: `feat(api):`, `feat(ios):`, `test(api):`
- API tests use Vitest; iOS tests use XCTest
- TDD: write failing test first, implement, verify, commit
- Zod schemas for all API input validation
- SwiftData models include `syncedAt` (local-only) for sync tracking

## Design System

Warm & Refined aesthetic — see design system doc for full spec.
- Colors: linen/parchment/cream backgrounds, espresso/walnut text, terracotta accents
- Fonts: Playfair Display (headers), Source Serif 4 (body), SF Mono (data)
- Design tokens in `apps/ios/Needlepoint/DesignSystem/`
- All iOS views must use design system tokens, not default SwiftUI styles

## API Commands

- `cd apps/api && npm run dev` — start dev server
- `cd apps/api && npm test` — run tests (Vitest)
- `cd apps/api && npm run db:generate` — generate Drizzle migrations
- `cd apps/api && npm run db:migrate` — run migrations

## Data Model

Core entities: User, Thread, Project, ProjectSection, ProjectThread
- ProjectThread bridges projects to inventory with denormalized thread data
- Sections are optional — projects work with or without them
- All synced models have `createdAt`, `updatedAt`, `deletedAt`
