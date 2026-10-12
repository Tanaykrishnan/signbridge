# Local ISL research decoder

## What is implemented

The optional local service runs the authors' trained **SignVQVAE_241108_1706** checkpoint, with **1,997 isolated ISL sign classes** in its public encoded release. It is not a fake response, prerecorded greeting selector, chat model inventing poses, or ASL fallback. A local Stanza English parser selects sign codes for new input combinations, and the learned decoder reconstructs body and finger keypoints. SignBridge converts those keypoints into 39-joint quaternion animation clips for its original rig.

**This is experimental lexical motion generation, not a validated sentence-level ISL translator.** Vocabulary coverage is not translation accuracy. Word-sense resolution, natural ISL grammar, facial grammar, agreement, regional variants and hand-contact accuracy remain unreviewed. Arbitrary English cannot be guaranteed. Unknown words block the entire request; they are never skipped, replaced with invented gestures, or fingerspelled. Complex clauses retain lexical order with a warning rather than claiming correct ISL syntax.

## Setup and run

Requirements: Python 3.12, Node.js, internet for setup, approximately 4 GB free disk space and several GB of available RAM. CPU inference does not require a paid service or GPU.

```sh
npm run isl:setup
npm run dev
```

`pnpm dev` starts the website and installed English/ISL services together. `pnpm isl:start` and `pnpm dev:web` remain available for separate-process development. With Node on PATH but no package-manager command, the installed ISL service can also be started directly with `node scripts/start-local-isl.mjs`.

On Windows, setup uses `py -3.12`; elsewhere it uses `python3`. Set `SIGNBRIDGE_PYTHON` to a Python 3.12 executable if necessary. The isolated interpreter, dependencies, checkpoint, encoded data and parser models live in ignored `.local-isl/`. Setup is idempotent and verifies the pinned decoder/data hashes before execution. Do not put this directory in `public/`, source control, a deployed image, or an artifact bundle.

`npm run isl:start` binds only `127.0.0.1:8082`. It generates `.local-isl/server.key`; Next reads this server-only bearer credential. It is never sent to the browser. The running service does not download models or send source text elsewhere. Restart it after changes to `scripts/isl/`.

Next development discovers the installed service automatically. `/api/capabilities` checks actual readiness, rather than merely the presence of a configured URL. The studio enables clearly labelled unreviewed research output by default when that service is online, except in reviewed-only mode. Disable it in output settings, set `ISL_LOCAL_RESEARCH=0`, or stop the service to return to reference previews. Both unreviewed flags still default to false for direct API clients.

The research service is **disabled in `next start` / production**. An explicitly configured `ISL_MODEL_URL` takes priority and retains the separate external-provider contract, including commercial-use metadata. This is intentional: public commercial deployment requires clarified model/data permissions and independent linguistic validation.

## Try it

These exercise novel combinations rather than the seven greeting previews:

- `What is your name?`
- `I am a student.`
- `Where is the blue building?`
- `I do not like water.`
- `I will go to school.`
- `What is your name? I am a student. Where is the blue building?`

The first question currently plans `Your / Name / What`; this is an inspectable heuristic gloss, **not evidence of expert-approved grammar**. `Hello. My name is Zzyqx.` is rejected in full, naming `Zzyqx` as unavailable. Proper names are not silently turned into dictionary nouns or alphabet sequences. Possessives, negation and modals are not blanket-filtered as in the upstream demo. Omitted articles/copulas/support auxiliaries are reported in limitations. Inflected tense is handled with dataset tense entries; this is also experimental, not a linguistic guarantee.

The release count includes alphabet classes, which the planner excludes. In particular, `I` in an English sentence maps explicitly to the dataset's `I (Person)`, not its separate letter `I` class. This disambiguation is covered by a regression test.

## Pipeline and limits

### Contextual lexical resolution

English paraphrasing can introduce words whose exact spelling is not an available sign label. For example, the release has `Direction` but no plain `way` class. `scripts/isl/lexical_resolution.py` includes a narrow, **unreviewed** rule for `way` as the object of `show` with an explicit `to` + recognized place noun destination. It selects the existing `Direction` code; it does not generate a new sign. English source text is not changed or discarded.

The planner records `lexicalMappings` with source word, dataset label, rule version and unreviewed status; the retargeter preserves this evidence, and the studio displays it beside the paraphrase. Exact dataset matches take priority. Uses of `way` meaning method (`a way to learn`, `show the way to solve`), unattached clauses, and unknown destinations are not guessed. Unknown words elsewhere still block the complete request.

This rule is an English sense-resolution hypothesis, not proof of correct ISL meaning or grammar. New rules require explicit context checks, regression tests for other senses, and Deaf ISL expert evaluation. Do not add blanket synonyms or relabel mappings as reviewed without documented review. A truly absent sign needs a properly licensed motion asset or a validated signing provider, not deletion or an arbitrary gesture.

### Processing limits

```text
Full English input
  -> Stanza tokenize / MWT / POS / lemma / dependency parse (local CPU)
  -> coverage-checked vocabulary lookup and experimental clause ordering
  -> dataset sign-code sequences (no alphabet fallback)
  -> concatenate latent codes with upstream-style rest trimming
  -> trained body / left-hand / right-hand VQ-VAE decoders
  -> invert normalized hand coordinates -> 51 keypoints per frame
  -> local joint retargeter -> 39 articulated bones
  -> full-source and motion schema validation -> existing AnimationMixer
```

Input: 5,000 UTF-16 characters, up to 64 sentences, 24 sign units per sentence and 160 per request. Clips: at most 60 seconds each and ten minutes total. Pose responses: 8 MiB. Requests: 90-second client timeout and one active CPU inference. Limits may require splitting a paragraph even if its character count fits. Aborting the browser request prevents stale playback; an already-running bounded CPU inference finishes before the next job can start.

Coordinate mapping converts camera Y-down/Z-away into scene Y-up/Z-forward. The legacy rig's negative-X `Left` nodes receive the anatomical right arm. Its left finger bases are mirrored **only for this research mapper**, leaving existing ASL/reference clips unchanged. Palm bases are orthonormalized; all ten fingers receive three local rotations. Degenerate directions, non-finite coordinates, malformed clips, missing source spans and incomplete joints fail closed. Face/neck/spine channels remain neutral rather than inventing non-manual grammar. Fixed rig proportions can change signing locations and hand contact.

Playback uses an explicit 30-source-fps assumption, decimated to roughly 15 samples per second and interpolated by Three.js. The upstream browser loop uses frame callbacks/timeouts rather than reliable source timestamps; the archive contains no recording timing metadata. This assumption requires expert validation, as do coarticulation and retargeting.

## Provenance and licensing

- Source: [authors' demo repository](https://github.com/suvajit-patra/sl-vqvae-gen-demo), commit `b0e3d4f57d9804fd2a8dfc3e08a14eaadafa13e6`.
- Research context: [A Continuous Indian Sign Language Production System from Isolated Signs](https://cs.rkmvu.ac.in/~isl/sl_gen), Suvajit Patra and collaborators, ICSCC 2025.
- Upstream README declares the project MIT licensed. The linked archive has **no separate license notice for the checkpoint, encoded data or included FBX avatar**. Commercial rights have not been established. No claim of a research-license grant is made; this installation is scoped to local evaluation pending rights clarification.
- The downloaded third-party FBX is not extracted, used, or redistributed. The procedural avatar is original SignBridge geometry, not a real person's likeness.
- `scripts/isl/assets.py` pins SHA-256 hashes. `.local-isl/provenance.json` records download URLs and hashes. Checkpoints use `torch.load(weights_only=True)`. Pickle loading allows only the precise NumPy numeric constructors used by this pinned release; there is no user-upload endpoint.
- [Stanza](https://stanfordnlp.github.io/stanza/) provides English parsing, not ISL grammar. Its packages/models retain their upstream notices. New SignBridge adapters do not relicense any research assets.

## Verification

```sh
npm run isl:test
npm test
npm run typecheck
npm run lint
npm run test:e2e -- tests/e2e/isl-local.spec.ts
npm run build
```

The Python tests load real weights and check learned motion differences, numeric validity, vocabulary coverage, negation, tense, paragraph spans and restricted deserialization. The browser integration test uses real inference, checks changing canvas pixels and no overflow, sequences multiple sentences, and rejects an unknown name. It skips explicitly if the optional local model is not running. None of these is a linguistic accuracy score.

## Troubleshooting

- Offline: start `npm run isl:start` and reload the studio. If port 8082 is occupied, identify that process; do not replace an unrelated service. The adapter intentionally uses a fixed loopback endpoint.
- Parser file access denied: run the terminal as the same user who downloaded the models; sandboxed automation may need approved host-context access. Do not disable TLS or bypass filesystem permissions.
- Unsupported word: inspect `unsupportedWords`, shown directly below the paraphrase. Check whether the proper sense has an existing motion; otherwise obtain a properly licensed and reviewed vocabulary resource. Do not remove meaning just to make coverage pass.
- Input-size/sentence-limit error: these now use `model-input-unsupported`, not `model-vocabulary-unavailable`. The response names the actual limit; split at meaningful sentence boundaries.
- Research output disabled: enable the unreviewed-model option. Reviewed-only mode intentionally does not use the unreviewed local decoder.
- Long sentence: split at meaningful sentence boundaries. Increasing character limits does not give the model new vocabulary or grammar.
- Production: do not force `commercialUse: true`. Obtain permissions and review, then supply an approved provider through the external model contract.
