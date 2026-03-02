# Quick-Start Project Flow Design

## Problem

Users must create a canvas in the Stash tab before they can start a project in the Journal tab. This is confusing for new users who don't yet have a mental model of stash → kitting.

## Solution

Add an "Add New Canvas" button to `StartProjectSheet` (the sheet shown when tapping "+" in the Journal tab). This button opens `AddCanvasView`. When the user saves, the new canvas skips stash and goes directly to kitting, then the sheet dismisses and `ProjectDetailView` opens.

## Flow

```
Journal tab → "+" → StartProjectSheet
  ├── Pick existing stash item → status = kitting → ProjectDetailView
  └── "Add New Canvas" button → AddCanvasView (modified)
        └── Save → status = kitting, startedAt = now → dismiss → ProjectDetailView
```

## Changes

### 1. StartProjectSheet

Add an "Add New Canvas" button, always visible — at the top when stash has items, as the primary action in the empty state.

When stash is empty, show: "No canvases in your stash" with "Add New Canvas" as the prominent action.

### 2. AddCanvasView

Add an optional `startAsProject: Bool` parameter (default `false`). When `true`:
- After saving, sets `status = .kitting` and `startedAt = Date()` instead of leaving as stash
- Hides the "Add Another" toggle (doesn't make sense for project quick-start)
- Calls an `onProjectStarted(StitchPiece)` callback so the parent can navigate to ProjectDetailView

### 3. No New Views

Reuses the existing AddCanvasView with a mode flag. Keeps it DRY.
