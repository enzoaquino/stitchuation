# Shopping List Feature — Design

## Summary

A new 5th tab ("Shopping") that aggregates un-acquired materials from all active projects into a single shopping list. Two view modes: grouped by project (default) and grouped by material (combined across projects).

## Data Source

- Query all `PieceMaterial` where `acquired == false` from `StitchPiece` records with active statuses (kitting, WIP, stitched, atFinishing)
- No new models — reads existing `PieceMaterial` records
- Checking off an item sets `PieceMaterial.acquired = true` and the row animates out

## View Modes (Segmented Control)

### By Project (default)

- Section per active project that has un-acquired materials
- Section header: designer — design name, remaining material count
- Rows: each un-acquired PieceMaterial — brand, code/name, quantity, material type icon
- Tap checkbox to mark acquired, row animates out
- Projects with zero remaining materials don't appear

### By Material (combined)

- Groups identical materials across projects by `brand + code` (or `brand + name` if no code)
- Row: brand + code/name, total quantity needed, material type icon
- Expandable disclosure group shows which projects need it, with per-project quantity and individual checkboxes
- Checking individual project lines marks that project's PieceMaterial as acquired

## Tab Bar

```
Journal | Stash | Shopping | Threads | Settings
```

Shopping tab uses `cart` SF Symbol, positioned in the middle.

## Empty State

Centered message when all materials are acquired or no active projects have materials.

## All Material Types

Includes threads, beads, accessories, and other — not just threads.
