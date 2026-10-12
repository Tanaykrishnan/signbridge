# Continuum Studio

The studio extends the accepted homepage identity: porcelain surfaces (#f1f2eb), ink (#171a17), titanium and chartreuse (#dfff00). Manrope is bundled locally; Georgia supplies the editorial title accent. The functional avatar is the main visual, not a decorative substitute for signing.

## Scope

- `src/components/continuum-foundation.css` is imported after the legacy styles. Its tokens, navigation and viewer styling are now shared across workspace routes; studio-specific selectors retain the accepted layout. `continuum-pages.css` styles other page surfaces. The homepage is unchanged.
- The translator retains its original API integration, request guards, phrase matching, review gates, paraphrasing, source controls, favorites and disclosure content.
- The 3D scene retains its real animation mixer, sequence engine, camera presets and full-screen behavior. Only presentation colors and lighting change.
- `createDemoRig('studio')` selects the studio's silver, ink and chartreuse materials. Imported GLB materials and the rig's skeleton, hand shapes and animation clips remain unchanged.

## Motion and Accessibility

Staggered entrances, selection transitions, focus feedback and a playback-only meter provide motion without adding idle rendering. Both the system reduced-motion preference and the workspace motion control disable decorative animations. Manual sign playback remains available. High-contrast preferences strengthen studio text and borders. Light interface controls and the dark stage use separate focus and text tokens.

## Verification

Run `node node_modules/@playwright/test/cli.js test tests/e2e/studio-design.spec.ts tests/e2e/studio-continuum.spec.ts` with the development server ready at port 3000. These checks cover composition, paraphrase tabs, output disclosure, real canvas pixels, camera changes, review gating, alphabet playback, navigation within a sequence, reduced motion, contrast and desktop overflow. Screenshots are written to `work/studio-continuum-*.png`.

This visual update does not increase linguistic accuracy. ISL reference previews and local research output remain explicitly unreviewed, and unavailable assets remain blocked rather than replaced with invented motions.
