# SignBridge homepage

## Routes and boundaries

- `/`: standalone cinematic homepage, outside the workspace sidebar.
- `/studio`: the unchanged review-gated translator and playback workspace.
- `/studio?mode=lab`: direct entry to the independent engineering Motion lab.
- `/?text=...`: redirects to the new studio location, preserving old phrase links.

History, favorites, library, APIs, and persistence continue to use their existing routes and adapters. The homepage does not add accounts, analytics, paid services, or claims of reviewed ISL capability.

## Design direction

The requested UI/UX Pro Max skill was consulted for the new-page design system, Next.js loading guidance, and accessibility checks. Its scroll-storytelling, spacious typography, and reduced-motion recommendations fit this product. The unrelated interior-design palette and raw brutalist recommendation were not used. The implemented palette is graphite, silver, mint, and a contrasting off-white editorial section.

Components and styles live in `src/components/landing/`. The CSS module scopes the brand layout so the workspace's themes and components retain their existing design. Manrope is locally served through `@fontsource-variable/manrope` 5.3.0, under the SIL Open Font License 1.1. The package includes its license and author attribution. No Google Fonts runtime requests are required.

## Artwork and motion

`src/lib/brand-sculpture.ts` generates original mechanical-hand geometry, physical materials, and articulated groups. It is project-owned MIT-licensed concept artwork. It is not an ISL sign asset, human likeness, motion-capture recording, or signing demonstration. It is deliberately separate from the sign registry.

The hero uses a dynamically imported React Three Fiber canvas, a locally generated light environment, and a capped device-pixel ratio. It makes no external model, image, or environment-map requests. The runtime checks hero visibility and document visibility; ambient frames stop when hidden, offscreen, or paused. Explicit rotation/reset buttons also work with reduced motion. GPU resources are disposed when the scene unmounts. WebGL errors keep the remaining page usable with an explanatory fallback.

Motion includes staggered title entrances, subtle pointer response, articulated fingers, scroll-linked artwork/text depth, section reveals, interaction feedback, and FAQ transitions. The homepage respects the system reduced-motion preference and the application's persisted preference. Motion controls are available in the hero and, after leaving it, in a small floating control. Pausing does not prevent user-initiated signing-engine playback.

The lower preview loads only when approached and uses the same real asset endpoint and `Viewer` as the studio. Its generic fixtures are visibly labelled engineering demonstrations, never translations. Selecting a fixture, playing, pausing, seeking, changing speed, and inspecting the camera all use the actual playback engine.

## Desktop studio continuity

The desktop `/studio` workspace shares the homepage's locally hosted Manrope typography, graphite/mint tokens, restrained borders, and motion timing. `src/components/studio.css` scopes this treatment to the studio route at desktop widths; other workspace routes and the existing narrow layouts retain their prior behavior.

The translator exposes a processing-stage strip derived from actual input, matching, and review state. It never substitutes a decorative progress simulation for a translation result. The stage includes user-triggered front, three-quarter, and upper-body camera presets. Studio-specific lighting is generated locally, while the loader, animation mixer, asset review gate, and persistence remain unchanged. Interface motion can be reduced directly from the desktop top bar.

## Verification

`tests/brand-sculpture.test.ts` validates the original scene structure and finite mesh bounds. `tests/e2e/landing.spec.ts` checks nonblank canvas pixels, actual animation changes, pause stability, rotation/reset, real preview playback, FAQ states, legacy links, deep links, mobile dialog focus, reduced motion, responsive overflow, and accessibility using axe. Existing studio regression tests now enter at `/studio`.

Generated screenshots remain in ignored `work/` during QA. Test assertions are not linguistic evaluation or a replacement for testing with Deaf ISL users.
