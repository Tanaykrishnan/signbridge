# SignBridge: Immersive Visual System

The homepage has since been replaced by the continuous ribbon experience described
in [continuum-homepage.md](continuum-homepage.md). The identity and mechanical-hand
homepage notes below describe the preceding design; workspace behavior remains relevant.

The October 2026 redesign preserves application routes, APIs, stored records,
translation planning and animation scheduling. Changes focus on presentation,
rendering efficiency and displaying completed results without waiting for history storage.

## Identity

- Obsidian `#101115`: primary background.
- Silver `#f1f3f8`: primary text and sculpture surfaces.
- Coral `#ff8b75`: commands, selection and material detailing.
- Ice `#b7eaff`: secondary links and focus indicators.
- Amber remains a semantic warning color, not a decorative accent.
- Light mode uses cool-white surfaces and dark coral commands.
- Manrope is locally bundled. No runtime font or environment-map CDN is required.

The homepage uses full-width bands and an unframed mechanical-hand scene. The
workspace uses restrained operational controls and a larger 640px signing stage.
The studio intentionally allows vertical page scrolling, replacing the earlier
single-screen layout at the user's request. Its source, playback and result remain
connected; Compose and Paraphrase tabs retain their existing state and behavior.

## Motion

The existing Motion and React Three Fiber dependencies cover the implementation.
No GSAP, scroll hijacking or additional rendering library was added.

- A coordinated DOM opening reveals the brand and primary actions.
- Pointer movement applies a small camera and sculpture offset, only for a mouse.
- Scroll progress changes the sculpture's depth and orientation. A MotionValue
  subscription invalidates the canvas without per-frame React state updates.
- Form, Articulation and Connection controls change the actual hand geometry's
  joint rotations and composition. These studies are artwork, not language signs.
- Pipeline tabs animate selection and content, with arrow, Home and End navigation.
- Workspace route entrances, navigation selection, list/card reveals and hover
  feedback share the same motion vocabulary.

Homepage auto-animation stops offscreen, in hidden tabs, when explicitly paused,
or under OS/application reduced motion. Paused scenes use demand rendering;
explicit sculpture controls still work. The environment map is generated locally
once with 128px resolution, and DPR is capped. The avatar also renders on demand
while idle, with explicit invalidation for camera controls and timeline seeking.
It renders continuously during playback, ignoring the first accumulated idle-frame
delta. Signing remains under the user's control and is not replaced with decorative motion.

## Accessibility and Fallbacks

Semantic navigation, labeled icon buttons, keyboard tabs, focus indicators, guest
storage disclosure, supported-input errors and review boundaries remain visible.
The homepage's dynamic scene reserves its layout space. The pipeline is rendered
with the page rather than inserted later by a client-only chunk.

The Three.js scene has a WebGL fallback and an error boundary. Text and studio
links remain available without the artwork. No external illustration or unlicensed
model was introduced. The mechanical sculpture and procedural avatar are original
project geometry. Existing optional research-model licensing limits are unchanged.

## Verification Commands

```sh
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright suite includes real canvas-pixel comparisons for motion, pause,
rotation and study changes, CTA hit testing, responsive framing, keyboard tab
navigation, theme/large-text checks and axe accessibility checks. Screenshots are
written to `work/`. These engineering checks do not establish ISL accuracy.
