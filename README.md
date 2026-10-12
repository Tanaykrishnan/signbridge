# SignBridge

**English paraphrasing is required before signing.** Open `/studio`, enter text, and choose ISL or ASL fingerspelling. One action runs the real Qwen model first, then sends its generated English to the selected signing provider. Original text, generated text, fidelity warnings and actual prompt evidence remain visible. If paraphrasing fails, neither conversion runs. `/review` retains measured Review 2 evidence; `/language-lab` remains an advanced prompt-comparison experiment, not a required separate step. See [the mandatory pipeline](docs/signing-pipeline.md) and [model provenance and evaluation limits](docs/genai.md). English generation does not establish accurate ISL translation.

Run `pnpm dev` (or `pnpm dev:full`) from the cloned project directory to start the website and installed local model services together. Existing occupied ports are left untouched; confirm model health in the studio. Missing model files are reported, never replaced by simulated output. `pnpm dev:web` starts only Next.js. First-time model installation still uses `pnpm ai:setup` and, optionally, `pnpm isl:setup`.

A working sign-animation studio and foundation for Indian Sign Language (ISL) translation, with a separate ASL fingerspelling tool. Built with Next.js App Router, TypeScript, React, Tailwind CSS, Radix UI, Motion, React Three Fiber, Drei, Three.js, Zod, and Prisma/PostgreSQL.

**Local ISL research motion generation is implemented.** The optional SignVQVAE service reconstructs learned body/finger motion from a 1,997-class sign vocabulary and an experimental English gloss planner, including new multi-sentence combinations. Run `npm run isl:setup`, then `npm run isl:start` alongside development. See [setup, provenance, examples and limitations](docs/local-isl-engine.md). This is **not validated arbitrary-text ISL translation**: unknown vocabulary blocks output, grammar and retargeting need expert review, and commercial model/data rights are not established. No ASL or fingerspelling fallback occurs. Seven unreviewed greeting previews remain available without the service.

## Quick start

Requirements: Node.js 22.18+ (Node 24 recommended), pnpm 11, a WebGL-capable browser. No paid API, account, database, or AI service is required for local use.

```sh
pnpm install
pnpm db:generate
pnpm ai:setup
pnpm dev
```

Open **http://127.0.0.1:3000** for the homepage, or **http://127.0.0.1:3000/studio** for ISL mode. Input accepts up to 5,000 characters; unsupported vocabulary or unavailable models are reported without substituting another language. With the local research service running, try `What is your name? I am a student. Where is the blue building?`. `/studio?mode=fingerspelling` opens the separate ASL alphabet tool. Fingerspelling preserves written letters, not sentence meaning or ISL grammar.

Try Hello, Thank you, Namaste, Sorry, Bye, How are you?, or Good morning for reference previews. Complete supported phrases separated by punctuation can play in sequence. Disable reference previews, or use `/studio?mode=isl&reviewedOnly=1`, for reviewed-only playback. **Motion lab** previews non-linguistic rig exercises separately. See [dataset findings and exact preview limits](docs/isl-datasets.md). On an existing local installation, run `pnpm db:sync-local` to refresh the fixture catalog while preserving guest history.

The homepage includes original interactive Three.js artwork, scroll reveals, a live Motion lab preview, and reduced-motion controls. `/studio?mode=lab` opens the lab directly. Existing `/?text=...` links redirect to `/studio?text=...`. See [homepage design and motion architecture](docs/landing.md) and [the immersive visual system, expanded studio and rendering behavior](docs/immersive-design.md).

The local English model setup downloads a runtime and model once; model weights and private service keys are not included in the repository. The bundled English-model setup requires Windows x64. Install the optional research ISL service with `pnpm isl:setup` before `pnpm dev` when you want experimental learned ISL motion; its separate licensing and linguistic limitations still apply. See [English model setup](docs/genai.md) and [ISL model setup](docs/local-isl-engine.md).

Use `pnpm dev:web --port 3001` when port 3000 is occupied (web-only startup; run the installed model services separately with `pnpm ai:start` and, optionally, `pnpm isl:start`). The server binds to loopback by default.

## Implemented experience

- Studio: 5,000-character English input, ASL alphabet generation, paste/clear/examples, provenance and conversion warnings, copy, history and unsupported/error states. Digits and common symbols are spelled as English names, not ASL number signs. Unsupported characters are explicitly reported.
- Independent ISL provider: exact and declared-alias matching, review-gated phrase playback and saving library phrases. ASL results do not fabricate dictionary entries or phrase favorites.
- Explicit reference-preview provider with seven original greeting clips, complete-utterance sequencing and source attribution. No automatic ASL fallback. Reviewed-only API defaults remain unchanged.
- Optional local CPU SignVQVAE research service, Stanza preprocessing, vocabulary coverage checks, learned body/finger decoding and quaternion retargeting. Downloaded assets stay outside source control and are disabled in production.
- Real external ISL motion-model HTTP adapter: full-input coverage, joint/timing/rig validation, review gates, source/license metadata, cancellation/time/response limits and generated clip playback. Its commercial-use contract remains separate from the restricted local research adapter.
- 101 source sentence/gloss records extracted from ISL-CSLTR under CC BY 4.0. These exact-match text annotations are separate from the SignVQVAE model and carry their own license; no dataset videos are installed.
- Review-gated translation: source editing clears the previous result and playback immediately; aborted/stale API responses cannot restore it. A separate Motion lab exposes generic animation fixtures without attaching them to source phrases.
- Animated page entrances, mode selection, results, library items, focus/hover feedback, and playback activity/progress; reduced-motion preferences are respected.
- Real 3D articulated rig with lights, shadows, studio floor, orbit, zoom/reset, fullscreen, GLB/GLTF loading, and fallback on load failure.
- AnimationMixer-backed playback: play/pause/resume/restart, seek, previous/next, current motion, timeline, completion, transitions, and speed preferences.
- Overview, searchable/filterable phrase library, phrase details, history with search/status/removal/reopen, saved phrases, settings, help, about, privacy, and not-found/error pages.
- Signed guest sessions, real persistent local storage or PostgreSQL, scoped records, validated API requests, and documented production restrictions.
- Responsive navigation, keyboard controls, status announcements, light/dark workspace themes, contrast, larger text, and reduced interface motion. Studio animation playback is always user initiated. The homepage's non-linguistic artwork has a separate pausable ambient animation.

English is the only enabled source language. The provider boundary allows future linguistic engines; disabled Hindi is not a promised implementation. ISL grammar is not English word substitution.

## Environment

`.env.example` documents every variable. For database commands use `.env`; Next also supports `.env.local`, but the seed command intentionally reads `.env`.

| Variable                 | Behavior                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Empty: local-file adapter. Set: Prisma/PostgreSQL. Invalid credentials fail visibly; the app never silently switches adapters.              |
| `SESSION_SECRET`         | Minimum 32 characters. Local development generates a private `.data/.session-secret` when absent. Required for guest storage in production. |
| `ALLOW_DEMO_MODE`        | Production guest history/favorites are disabled unless exactly `true`. This is not authentication.                                          |
| `NEXT_PUBLIC_AVATAR_URL` | Optional same-origin `/assets/...glb` or `.gltf`; empty uses original procedural rig.                                                       |
| `LOCAL_DATA_DIR`         | Local storage directory; default `.data`. Never place it in `public/`.                                                                      |
| `APP_ORIGIN`             | Exact browser origin, without trailing slash. Recommended behind a production reverse proxy for same-origin mutation checks.                |
| `ISL_MODEL_URL`          | Optional external ISL motion-generation endpoint; takes priority over the installed development-only research decoder.                      |
| `ISL_LOCAL_RESEARCH`     | Set `0` to disable the optional local decoder. Otherwise discovered in development only; always disabled in production.                     |
| `ISL_MODEL_TOKEN`        | Optional server-only bearer token; never exposed in client environment or capability responses.                                             |
| `PLAYWRIGHT_CHANNEL`     | Test browser; defaults to installed Chrome. Use `msedge` for Edge.                                                                          |

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not commit secrets or `.data`.

## Local persistence

`.data/signbridge.json` is a real on-disk store, created on the first write. It is seeded from the phrase and asset manifests. Writes are serialized in one Node process and use temporary-file replacement. Restarting that server preserves data. This adapter is **not safe for multiple processes, serverless ephemeral disks, or multi-instance production**.

A signed HTTP-only, SameSite=Strict guest cookie scopes history and favorites. HTTPS uses Secure cookies. The 30-day cookie is a bearer credential, not an account: clearing/expiry loses browser access to those records. Preferences use browser local storage. No external translation requests or analytics are made by the bundled provider. Do not submit sensitive information.

Existing local data is not overwritten when fixture files change. To update its catalog while preserving history, run `pnpm db:sync-local` after backing up `.data`. This replaces only phrase/sign fixture records, not guest records.

## PostgreSQL

Use an existing PostgreSQL 16+ instance, or start a local disposable database:

```sh
docker run --name signbridge-postgres -e POSTGRES_PASSWORD=local-development-only -e POSTGRES_USER=signbridge -e POSTGRES_DB=signbridge -p 5432:5432 -d postgres:17
```

Set in `.env`:

```dotenv
DATABASE_URL="postgresql://signbridge:local-development-only@localhost:5432/signbridge?schema=public"
```

Then:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The checked-in migrations create users, history, unique per-user favorites, dictionary records, and sign metadata with foreign keys/indexes. The latest migration, `202610040001_long_text_fingerspelling`, expands history text to 5,000 characters and records `outputMode`, so reopening preserves the language mode. Run `pnpm db:migrate` on existing PostgreSQL installations before using the new history feature. Old local JSON history defaults to ISL without erasing records. The seed upserts the illustrative catalog. Local JSON records are not automatically copied to PostgreSQL. `User.authSubject` is an extension point for a real authentication integration, not a working login.

## Verification and production build

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format:check
pnpm build
```

E2E tests use installed Chrome, start/reuse a loopback development server, and exercise real APIs and WebGL. Test cookies isolate their data; screenshots and failure traces go to ignored `work/` and `test-results/`. Software rendering allows canvas checks on machines without a GPU. They are not a substitute for Deaf-user testing or linguistic evaluation.

For a local production preview, set `SESSION_SECRET` and `ALLOW_DEMO_MODE=true` in `.env`, then `pnpm start --port 3001`. Production must use a protected persistent volume or preferably PostgreSQL. A production build passing does **not** make the guest demonstration suitable for unrestricted public deployment. See [security and release requirements](docs/architecture.md).

## Assets and project structure

See [fingerspelling implementation and research](docs/fingerspelling.md) and [asset pipeline](docs/assets.md) for source handling, review boundaries, clip naming, skeleton conventions, retargeting limitations, licensing and import steps.

```text
src/app/                 App Router pages and typed API route handlers
src/components/          Shell, studio, viewer, pages, accessible primitives
src/lib/                 Provider, validation, registry, playback, rig, API, stores
src/data/phrases.json     Illustrative phrase dictionary
public/assets/avatar/    Avatar GLB/GLTF assets and provenance
public/assets/animations/ Licensed external animation containers
public/assets/signs/     Validated asset manifest
prisma/                  PostgreSQL schema, SQL migration, seed
scripts/                 Asset export and local catalog synchronization
tests/                   Unit/API tests and browser journeys
docs/                    Architecture, asset contract, troubleshooting
outputs/                 Recorded benchmark evidence; generated reports stay local
```

## Troubleshooting

- **Translate returns 403:** open the same hostname throughout; `localhost` and `127.0.0.1` are different origins. Set `APP_ORIGIN` to the browser origin when using a proxy.
- **History returns 503 in production:** configure a 32+ character `SESSION_SECRET` and explicitly enable guest mode, or integrate real authentication before enabling user storage.
- **Storage unavailable:** inspect server logs and file permissions/database connectivity. Corrupt local JSON is rejected, not erased. Restore a backup or correct the data.
- **Blank viewer:** enable WebGL/hardware acceleration and try Chrome/Edge. The UI keeps a textual sequence and an explicit viewer error if rendering is unavailable.
- **Model load error:** verify its `/assets/` URL, same-origin texture/buffer dependencies, GLTF validity, and required clip names. The loader reports failure and falls back to the demonstration rig.
- **No matching motion:** check case-sensitive clip names, manifest `available`, and imported bone names. A missing asset is never replaced with a claimed ISL sign.
- **Dependency proxy errors:** configure your package manager's approved proxy/registry. Do not disable TLS verification.
- **Prisma engine download blocked:** allow the official Prisma engine endpoint through your network policy, then run `pnpm db:generate` again.

Original code, fixtures, procedural geometry, and motions are MIT licensed. Imported ISL-CSLTR annotations are CC BY 4.0, with attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Third-party packages retain their own licenses.
