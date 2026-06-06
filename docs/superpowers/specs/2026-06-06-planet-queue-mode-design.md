# 3D Planet Queue Mode Design

## Goal

Replace the existing authority/glitch mode with a cinematic real-3D planet queue. The selected PBR planet remains centered while neighboring planets form a perspective queue extending left/right, downward, and away from the camera.

## Visual Behavior

- Keep every planet as its existing textured Three.js sphere, including atmosphere, clouds, night lights, rings, and outline layers.
- Add a restrained `HemisphereLight` dome light. It lifts the upper hemisphere without flattening the existing directional-light terminator.
- Entering queue mode fades and slides the left and right HUD columns outward. The center target reticle and footer fade away.
- Neighbor planets move into a straight perspective queue. Increasing distance from the selected planet increases horizontal offset, downward offset, camera depth, and scale reduction.
- Switching planets animates the whole queue with `power3.inOut`; the newly selected planet finishes at `(0, 0, 0)`.
- Exiting queue mode restores the standard detail planet, orbit overlays, HUD panels, and normal dome-light intensity.
- Returning directly to overview clears queue state immediately enough to prevent stale detail overlays while preserving the continuous camera return.

## Removal Scope

Remove all previous glitch-mode visuals and behavior:

- GPU fragment/pixel reconstruction shaders and instanced fragments
- Red dotted maps, broadcast labels, authority dials, classified logs, and authority HUD markup
- Authority geometric guide layers
- Global random glitch flash and glitch overlay
- Authority-specific CSS animations and styling

The top arrow remains as the subtle entry/exit control, renamed for planet queue mode.

## Responsive Behavior

The existing responsive detail safe zones remain. Queue mode does not add DOM panels over the center. Perspective spacing is calculated in Three.js and remains centered at all supported aspect ratios.

## Verification

- Unit/source-quality tests prove old glitch signatures are absent and queue/dome-light signatures are present.
- App interaction tests prove queue mode retains standard HUD DOM, switches planets through the persistent rail, exits cleanly, and can interrupt a return transition.
- Browser verification covers desktop, wide-low landscape, and phone landscape screenshots, console errors, and mode transitions.

