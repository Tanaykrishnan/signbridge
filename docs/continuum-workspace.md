# Shared Continuum Workspace

All workspace routes now share the approved studio identity: porcelain, ink, chartreuse and titanium. The homepage remains unchanged. No translation, model, persistence or prompt logic changes are part of this update.

## Structure

- `continuum-foundation.css`: shared shell tokens, sidebar, navigation, controls, focus indicators, avatar surfaces and the existing studio layout.
- `continuum-pages.css`: overview, phrase cards and list layout, filters, history, settings, language lab, review evidence, provenance and informational page styling.
- `WorkspaceHeading`: shared editorial headings with the same typography and fine-rule treatment as the studio. Accessible heading names remain unchanged.

## Preferences

The appearance selector now names the actual available variants: Porcelain and Bright white. Legacy stored values `dark` and `light` respectively are retained for compatibility. Both remain part of the approved light-chrome/dark-stage design. High contrast, larger text and reduced interface motion still work; reduced motion never prevents manually requested sign playback. Preference controls remain disabled until stored preferences initialize, preventing an early selection from being overwritten during hydration.

Entrance choreography uses transforms and opacity. Hover, selection and focus feedback are restrained. The real avatar is used on studio and phrase-detail pages; decorative models are not substituted for signing content.

## Checks

The `cinematic.spec.ts` workspace audit covers all twelve routes including phrase details, desktop overflow, computed theme colors, screenshots and WCAG AA checks. Library filters, saving/removing a phrase and persisted favorites are exercised in `journey.spec.ts`. The studio checks retain coverage for real canvas pixels, cameras and playback.

The exact model/asset availability messages, review status, research limitations and licensing notices remain intact. This design update does not validate ISL linguistic accuracy.
