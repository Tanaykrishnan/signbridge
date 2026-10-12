# Continuum Homepage

The active homepage is `src/components/landing/experience.tsx`, loaded by
`src/app/page.tsx`. Its scoped styling is `experience.module.css`; the old
mechanical-hand landing components are retained but are no longer loaded by `/`.

## Visual Direction

Porcelain `#f1f2eb`, ink `#171a17`, titanium and electric chartreuse `#dfff00`.
Bundled Manrope pairs with system Georgia for expressive section titles.
There are no remote fonts, stock models, video backgrounds or new dependencies.

One fixed, full-viewport Three.js canvas remains mounted from the opening section
through the footer. The original ribbon sculpture morphs between a knot, wave,
helix, bridge and infinity loop. Shared vertex topology and GPU morph targets
avoid rebuilding geometry during scroll. Position and orientation interpolate
from document progress, with frame-rate-independent damping.

Native scrolling stays intact. Chapter links, drag rotation, keyboard-accessible
rotation/reset controls and pause are available. Hidden tabs and reduced motion
use demand rendering; resources are disposed when the scene unmounts. The page
content and application links remain available when WebGL is unavailable.

This is concept artwork, independent of the ISL motion engine. Studio workflows,
local models, API routes, records and asset provenance have not been replaced.

## Verification

`tests/e2e/continuum.spec.ts` checks nonblank canvas pixels, animated pixels,
pause/reset, all five scroll compositions, footer navigation and narrow layouts.
`landing.spec.ts` checks unobstructed desktop CTAs and application deep links.
`immersive-scroll.spec.ts` checks chapter navigation, contrast and reverse scroll.

Screenshots are written under `work/continuum-*.png`.
