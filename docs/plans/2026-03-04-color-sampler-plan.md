# Color Sampler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an eyedropper tool to sample thread color from a photo or camera.

**Architecture:** iOS-only. UIImage pixel extraction extension + new ColorSamplerView + integration into AddThreadView.

**Tech Stack:** SwiftUI, UIKit (CGImage pixel reading), PhotosUI

---

### Task 1: Add UIImage pixel color extraction extension

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Extensions/UIImage+PixelColor.swift`

### Task 2: Create ColorSamplerView

**Files:**
- Create: `apps/ios/stitchuation/stitchuation/Views/ColorSamplerView.swift`

### Task 3: Add eyedropper button to AddThreadView

**Files:**
- Modify: `apps/ios/stitchuation/stitchuation/Views/AddThreadView.swift`
