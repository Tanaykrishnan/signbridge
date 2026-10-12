# Architecture and release boundaries

## Data flow

English paraphrasing is a mandatory server-enforced GenAI stage: input -> constrained, versioned prompt -> local pretrained Qwen Transformer -> schema-validated English paraphrase -> preservation warnings -> selected ISL or ASL provider -> avatar playback. Both `/api/translate` and receipt-less history processing use `runSigningPipeline`; signed receipts avoid duplicate inference when saving results. The original input is retained separately from `sourceText`, which is the generated English used for animation token offsets. Model failures stop conversion rather than silently passing through the original input. `/language-lab` remains an advanced prompt experiment, removed from primary navigation; `/review` exposes recorded experiments. Guest generation records use a serialized local-file adapter. See [pipeline contract](signing-pipeline.md) and [runtime, provenance and evaluation limits](genai.md).

```text
Studio -> POST /api/translate -> Zod validation
       -> normalization -> preprocessing -> TranslationProvider
       -> ISL: exact phrase / declared alias -> reviewed ordered sign IDs
       -> optional ISL motion model: full text -> validated articulated motion
       -> ASL fingerspelling: source spans -> alphabet / repeat / pause motions
       -> animation metadata -> Viewer -> PlaybackEngine -> AnimationMixer

Studio -> POST /api/history -> signed guest session -> Store adapter
Library / favorites / history -> typed API -> same Store adapter
```

`normalize` handles Unicode NFKC, casing, punctuation, and whitespace. `DictionaryProvider` never composes signs from English tokens. `LocalIslProvider` delegates to reviewed phrase assets first, then an active motion provider, then the explicitly allowed reference whitelist. Local research failures may also fall back to complete reference phrases, never partial text. ISL never invokes ASL. External providers receive full source text. The development-only local provider parses full text with Stanza, checks lexical coverage, composes encoded sign units with an experimental gloss planner, decodes actual SignVQVAE keypoints, and retargets them to the rig. Unknown vocabulary blocks the complete result. See [research engine and exact boundaries](local-isl-engine.md), [external model contract](isl-model.md), and [reference-preview contracts](isl-datasets.md).

In strict dictionary mode, supported means **matched a dictionary record**, not verified or semantically correct ISL. Confidence is `null`, because no calibration exists. Model-supported means motion passed structural checks, not that its meaning is correct. Unknown input without a model returns HTTP 200 with an empty sequence and an explicit missing-model reason; malformed requests return 400/413/415. Optional `datasetMatch` is source evidence only and cannot create playable motion.

In `outputMode: asl-fingerspelling`, supported means **has spellable characters**, not an ISL dictionary match. It is only selected by the separate ASL tool. See [the input and review contract](fingerspelling.md). Studio and API both default to ISL. The old `fallback: asl-fingerspelling` option is rejected with HTTP 400.

## Playback

`phrasePlayback` is a shared server/client review gate. Its ready sequence requires a reviewed phrase, reviewer attribution, and complete available reviewed assets. The library retains that gate. `allowReferencePreview: true` uses a separate seven-clip whitelist and never elevates review flags. Unreviewed model output requires `allowUnreviewedModel: true`; both overrides default off in the API. The studio enables the installed local research option by default when its health check passes, except in reviewed-only mode, with a visible unreviewed-output boundary. External model opt-in remains manual. Provider-reported review metadata is not independently certified.

Motion lab is deliberately independent of input text and never writes a translation to history. It previews the original generic clips only. `RequestGuard` aborts in-flight translation work on edits/mode changes/unmount and rejects late responses. The input's previous result is cleared immediately; unknown text never falls back to a demo clip. Generic rigs remain visible as idle geometry, accompanied by an explicit no-signing-output state.

The browser-only scene is dynamically imported. `PlaybackEngine` is independent of React and owns time, speed, index, phase, and bounds. Its external-store subscription updates controls at a throttled cadence; the scene samples it every frame. Seeking selects a segment and normalized clip time, so playback and slider state share one clock. `AnimationMixer` samples real quaternion tracks. Transitions blend the preceding clip's endpoint into the current clip. Each clip should return to an agreed rest pose unless reviewed transition assets say otherwise.

Fingerspelling has its own alphabet pose/clip factory, including 26 letters, 26 repeated-letter variants and a word pause. Manual seeking samples the selected pose immediately; only continuous playback crossfades from the previous segment. Prefix timings and binary-search seeking keep long sequences manageable, while only 17 nearby sequence buttons are mounted. Tokens carry compact source/word offsets instead of copying an entire word into every letter.

The original rig is articulated with Three.js bones, meshes, arms, hands, fingers, head, and legs. It is intentionally not a photorealistic or fluent signer. A GLTFLoader path accepts compatible skinned meshes and embedded/external skeletal clips. Bone-name mapping is supported; proportion/rest-pose retargeting is **not** automatic. Mixer actions, roots, geometries, materials, and textures are cleaned up when replaced/unmounted. Failed GLB loads produce a visible error and a clearly identified procedural fallback.

## Persistence and trust

The Store interface has two real implementations: `LocalFileStore` and `PostgresStore`. PostgreSQL access uses Prisma parameterized queries with ownership filters. Both paths separate history/favorites by guest UUID; a valid signed cookie is required to retrieve an existing guest workspace. A new browser gets a new workspace. User-facing endpoints never accept a user ID from the client.

Local writes are serialized only inside one process, then atomically replace the JSON file. PostgreSQL handles uniqueness for `(userId, phraseId)` and foreign-key integrity. Pagination is validated and applied at the API boundary. The current small-catalog implementation fetches scoped collections before filtering/pagination; move filters/count/skip/take into Prisma for large deployments. The saved-phrase view fetches up to 100 phrase/favorite records, adequate for the included 14-record phrase catalog; extend server-side joins and pagination before growing past that size. The 101 dataset annotations are separate read-only source evidence, not phrase favorites or animation mappings.

The signed cookie is not authentication and has no recovery mechanism. Public accounts require a recognized authentication provider, secure session integration, and mapping its subject to `User.authSubject`. Never treat a display name, client UUID, or user-select dropdown as identity.

## API surface

| Method and route             | Contract                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/translate`        | JSON text, language "en", outputMode "isl" or "asl-fingerspelling"; text 1-5,000 characters; returns Translation            |
| `GET /api/phrases`           | `page`, `limit` (1-100), `q`, `category`, `review`, `available`; paginated items                                            |
| `GET /api/phrases/[id]`      | Phrase record or 404                                                                                                        |
| `GET /api/assets`            | Validated manifest, configured avatar URL, stored sign records                                                              |
| `GET /api/capabilities`      | Honest model configuration state, preview count and input limit; no secrets or promise of accuracy                          |
| `GET /api/history`           | Guest history; pagination, `q`, `status`                                                                                    |
| `POST /api/history`          | Same input/options and signed `historyReceipt` save the actual result without repeating inference; legacy clients recompute |
| `DELETE /api/history/[id]`   | Ownership-scoped deletion                                                                                                   |
| `GET /api/favorites`         | Paginated guest favorites                                                                                                   |
| `POST /api/favorites`        | JSON `{phraseId}`; validates phrase; idempotent per guest                                                                   |
| `DELETE /api/favorites/[id]` | Ownership-scoped deletion                                                                                                   |
| `GET /api/health`            | Storage probe, adapter mode, reviewed-asset count, version                                                                  |

List responses have `items`, `total`, `page`, `limit`. Errors have `{error: string}`. Requests have a 32 KiB body limit and must use JSON. Mutation origins are checked against configured origin or the browser-facing Host. Responses carrying guest data are `no-store`. An in-process guest write throttle protects history/favorites from accidental rapid writes, not determined abuse. Generic 503 responses hide internal database details; diagnostics remain on the server.

## Production release checklist

- Supply reviewed phrase content and licensed, intelligible ISL animations. Independently test with Deaf ISL users and record regional/linguistic scope. Do not use this demo for emergencies, clinical, legal, or other high-stakes communication.
- Integrate actual authentication or explicitly accept the guest bearer-cookie model. Provide retention/deletion policies, backups, TLS, secret management, and infrastructure access control.
- Use PostgreSQL and move pagination/search to SQL for large catalogs. Add migrations integration tests against your exact PostgreSQL deployment.
- Add shared edge rate limiting, request budgets, monitoring, log redaction, and a deployment-specific Content Security Policy. Configure trusted proxy/origin behavior explicitly.
- Validate uploaded assets offline. There is no public asset upload endpoint. Require self-contained, same-origin assets; verify licenses and dependencies before deployment.
- Establish dependency update/security scanning, load testing, assistive-technology testing, and crash reporting. Automated axe checks do not establish full accessibility compliance.
- Current testing targets Chromium on desktop/mobile-sized viewports. Safari/iOS fullscreen behavior, real touch devices, low-end GPU performance, and production infrastructure still need validation.

No fake login, translation model, mocap dataset, or reviewed linguistic claim is included.
