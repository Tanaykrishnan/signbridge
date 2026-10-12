# Mandatory paraphrase-first signing

## Local startup

Run `pnpm dev` or `pnpm dev:full` from the project directory. The launcher starts Next.js (3000), the installed English Qwen/llama.cpp server (8081), and the installed experimental ISL server (8082). It does not install or download assets. Existing ports are left untouched and must be checked through studio model status. Ctrl+C terminates only process trees started by the launcher. Use `pnpm dev:web` for frontend-only development.

If the English runtime is missing, run `pnpm ai:setup` first. For experimental ISL, follow `docs/local-isl-engine.md`. An external provider URL disables automatic startup of its corresponding local service. No secrets are sent to the browser. Model services bind to loopback. Production still requires explicit server/provider deployment and retains the existing commercial/review gates.

## One signing action

1. Validate original English input (1-5,000 characters, contains English letters).
2. Run the real English model with the `constrained` preservation prompt. There is no skip flag, dictionary rewrite, identity fallback, or offline substitute.
3. Reject empty, letter-less, truncated, invalid or over-5,000-character generated output without signing it. The generated text is never silently shortened.
4. Send generated English, not original input, to the selected ISL provider or ASL alphabet engine.
5. Return original input, generated English, actual prompt, model provenance, measured latency, heuristic preservation checks, signing result and signed history receipt.

The result's `sourceText` drives animation token offsets and contains the generated English. `originalSourceText` preserves user input; `paraphrase.sourceText` also records the original. History stores original input so reopening does not overwrite it. Saving a valid translation receipt does not repeat paraphrasing or signing. A history write without a receipt must execute the same pipeline. Generation evidence is retained in the guest-scoped local-file store (last 50 runs), with `not-saved` explicitly reported if persistence fails.

The studio has no separate paraphrase tab or apply button. Generated English is displayed directly below the source field in both modes, with a copy control and keyboard-scrollable long output. Original text and full prompt/model evidence remain in the result section. The preview stays available even when ISL motion is blocked. Editing input, mode or signing trust options cancels the pending request and clears stale output. Offline status prevents normal submission; server-side enforcement also rejects direct API attempts. Model status can be refreshed without reloading the page.

ISL failures include structured `unsupportedWords` for actual vocabulary gaps. Sentence/size limits use `model-input-unsupported` instead of masquerading as vocabulary errors. The preview names missing words and does not offer to drop them. A finite isolated-sign release cannot cover every English word, proper name or word sense.

## Limits

Qwen generates English, not ISL grammar or signing motion. Preservation flags are heuristic warnings, not proof of semantic equivalence. Compare the generated text with the original before relying on either output. The model may leave already-simple wording unchanged; it still performs inference, and no fake rewrite is introduced.

ASL mode spells the generated English using the existing unreviewed alphabet motions. It is not sentence-level ASL translation. ISL mode uses installed phrase assets or the configured motion provider. The local research decoder has a finite vocabulary, experimental grammar and retargeting, no expert review, and no established commercial asset permissions. Unknown vocabulary blocks motion; it is never omitted, invented, or replaced by ASL. Mandatory paraphrasing does not eliminate these limits.

## Tests

`tests/signing-pipeline.test.ts` verifies stage order, token alignment, original preservation, failure blocking, cancellation, generated-length validation and warnings using explicitly synthetic test text. API tests exercise loopback HTTP fixture transports and receipt persistence. `tests/e2e/signing-pipeline.spec.ts` runs real local Qwen/ISL inference and browser playback; it requires the local services, not simulated model results.
