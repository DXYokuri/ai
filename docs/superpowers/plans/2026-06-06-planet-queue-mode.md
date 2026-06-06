# 3D Planet Queue Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every glitch/authority effect with a real-3D perspective planet queue illuminated by a restrained dome light.

**Architecture:** React owns queue-mode interaction state and HUD transitions. `SolarAtlasScene` owns the PBR planet queue poses, dome-light intensity, orbit-overlay visibility, and GSAP timelines. Existing atlas state and the persistent planet rail remain unchanged.

**Tech Stack:** React, TypeScript, Three.js, GSAP, Vitest, Testing Library, Playwright

---

### Task 1: Lock the replacement behavior with failing tests

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/scene/sceneQuality.test.ts`

- [ ] Replace authority-mode interaction assertions with planet-queue assertions.
- [ ] Assert that old authority/glitch markup, shaders, fragment geometry, and CSS are absent.
- [ ] Assert that a `HemisphereLight`, queue pose calculation, queue timeline, and centered selected planet exist.
- [ ] Run `npm test -- src/app/App.test.tsx src/scene/sceneQuality.test.ts` and confirm failures describe the missing queue implementation.

### Task 2: Replace the React authority UI with queue-mode interaction

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/scene/SolarAtlasStage.tsx`

- [ ] Rename authority state/props/classes to queue mode.
- [ ] Remove the random global glitch scheduler and glitch overlay.
- [ ] Delete `AuthorityHud`; always keep the standard detail HUD mounted.
- [ ] Rename arrow accessible labels to enter/exit planet queue mode.
- [ ] Keep queue mode active while switching planets through the persistent rail.
- [ ] Run the targeted tests and confirm the React interaction tests pass.

### Task 3: Replace authority CSS with HUD departure transitions

**Files:**
- Modify: `src/styles.css`

- [ ] Delete authority HUD, dotted map, dial, broadcast, red warning, and glitch-pass styles/keyframes.
- [ ] Add `.mode-queue` transitions that slide/fade left and right HUD columns outward.
- [ ] Fade the center reticle and detail footer while preserving the persistent rail and arrow.
- [ ] Keep existing responsive safe-zone rules intact.
- [ ] Run the targeted tests and confirm CSS removal/transition assertions pass.

### Task 4: Build the real-3D queue and dome light

**Files:**
- Modify: `src/scene/SolarAtlasScene.ts`
- Modify: `src/scene/renderTone.ts`

- [ ] Delete authority profiles, shaders, fragment textures, guide geometry, and authority animation loop.
- [ ] Add a `HemisphereLight` dome light with normal-detail and queue intensities.
- [ ] Add `getQueuePose`, `arrangePlanetQueue`, `setQueueMode`, and `resetQueueForOverview`.
- [ ] Animate all real planet nodes into depth-aware queue poses while keeping the selected node at the origin.
- [ ] Restore detail and overview poses without stale orbit overlays or opacity state.
- [ ] Run targeted tests and confirm they pass.

### Task 5: Browser verification and publication

**Files:**
- Modify: `scripts/verify-browser.mjs`

- [ ] Replace authority-mode browser checks with queue-mode entry, rail switch, exit, and direct-return checks.
- [ ] Run the complete Vitest suite and production build.
- [ ] Run browser verification against `dist/atlas.html` and inspect desktop, wide-low, and phone-landscape screenshots.
- [ ] Publish the completed stage to `DXYokuri/ai` on GitHub.
- [ ] Deploy the new production build to Vercel and verify the production URL.

