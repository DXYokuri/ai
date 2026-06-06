# Detail HUD Responsive Safe Zones Design

## Goal

Keep normal detail-mode information panels readable and evenly spaced at desktop, wide low-height, and mobile landscape sizes without overlapping the authority arrow, planet rail, footer, or each other.

## Layout

- Reserve independent top, side, and bottom safe zones with responsive CSS custom properties.
- Keep the left and right HUD columns equal in height and vertically centered inside the safe content area.
- Divide each side column into three equal tracks. Panels may compact internally on low-height screens, but cannot leave their track.
- Keep the center planet/reticle area separate from side columns.
- Move the authority arrow into a dedicated band below the top navigation and above the planet image.

## Responsive Behavior

- Desktop uses generous panel padding and gaps.
- Low-height landscape reduces panel padding, row gaps, and typography while increasing the bottom safe zone enough to clear the persistent planet rail and detail footer.
- Mobile landscape keeps the same three-column visual language with narrower side panels and compact data rows.

## Verification

- Source-level tests lock the safe-zone variables and responsive rules.
- Browser verification measures bounding rectangles at desktop, wide low-height, and mobile landscape viewports.
- Verification fails if panels overlap each other, the planet rail, footer, or authority arrow.
