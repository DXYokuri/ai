# Detail HUD Responsive Safe Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make normal detail HUD panels and the authority arrow adapt to viewport dimensions without overlapping controls or each other.

**Architecture:** Use CSS custom properties on `.detail-hud` to define safe zones shared by all responsive breakpoints. Extend the existing Playwright verification script with rectangle-intersection checks across three landscape viewports.

**Tech Stack:** React, CSS, Vitest, Playwright

---

### Task 1: Lock Responsive Layout Requirements

**Files:**
- Modify: `src/scene/sceneQuality.test.ts`
- Modify: `scripts/verify-browser.mjs`

- [ ] Add source assertions for safe-zone variables, equal side-column tracks, and the raised authority arrow.
- [ ] Add browser rectangle-intersection checks for panels, arrow, rail, and footer.
- [ ] Run targeted tests and confirm they fail before layout implementation.

### Task 2: Implement Safe Zones And Compact Layout

**Files:**
- Modify: `src/styles.css`

- [ ] Define responsive top, side, and bottom safe-zone variables.
- [ ] Constrain both side columns to equal-height three-row grids.
- [ ] Compact panels and typography at low landscape heights.
- [ ] Raise and resize the authority arrow into its own safe band.
- [ ] Run targeted tests until they pass.

### Task 3: Verify And Publish

**Files:**
- Generated: `dist/atlas.html`

- [ ] Run the full Vitest suite.
- [ ] Build the HTML-compatible distribution.
- [ ] Run browser verification and inspect screenshots.
- [ ] Publish the verified project snapshot to GitHub.
- [ ] Deploy the same snapshot to Vercel production.
