# Avatar and sign asset contract

## Bundled assets

`src/lib/avatar-rig.ts` constructs an original articulated mannequin and three engineering clips (`demo-open`, `demo-reach`, `demo-rest`). They are not ISL signs. The project MIT license applies to original geometry, generated GLB, clip data, and original fixture records. Separately attributed ISL-CSLTR text annotations are CC BY 4.0; no dataset signing video, mocap, face, or likeness is bundled.

It also constructs original reference-informed ASL alphabet clips (`asl-letter-a` through `asl-letter-z`), repeated-letter variants and `asl-pause`. These are explicitly **unreviewed fingerspelling**, not sentence translations. `src/lib/asl-alphabet.ts` defines their validated metadata and joint poses; `src/lib/fingerspelling-clips.ts` generates real quaternion/position tracks. `/api/assets` merges this built-in registry with the stored manifest. They need no catalog seed. See [research and review requirements](fingerspelling.md).

ASL mode and explicit ISL reference previews deliberately use the procedural rig even when a custom avatar URL is configured: their original poses are not compatible with an arbitrary skeleton. Reviewed ISL playback and Motion lab retain the configured GLB loader. Importing a reviewed replacement alphabet requires a compatible clip/rig adapter and expert validation, not merely setting a URL. The legacy demo export may lack newly added joints/clips until regenerated.

`src/lib/isl-reference.ts` supplies seven original unreviewed greeting entries with `isl-reference-` clip IDs. `src/lib/isl-clips.ts` authors wrist paths, hand orientation, finger articulation, and two-bone arm inverse kinematics. These are a separate reference-preview whitelist, not generative AI or reviewed ISL motion capture. The stored catalog must be refreshed after upgrading. See [sources, consent controls and review limits](isl-datasets.md).

`public/assets/avatar/demo-rig.glb` is an export of that same rig, provided to exercise the real GLTF loader. Regenerate with `pnpm assets:export`. Set `NEXT_PUBLIC_AVATAR_URL=/assets/avatar/demo-rig.glb` to use the file-loader path; restart the development server. Default behavior remains procedural.

## Import without rewriting the viewer

1. Obtain a self-contained GLB with documented rights for application distribution, animation, and any likeness. Put it in `public/assets/avatar/` and record its source/license and consent in an adjacent provenance file.
2. Author or obtain animations on the **same skeleton and rest pose**. Embed them in the avatar or put GLB/GLTF animation containers in `public/assets/animations/`. All texture/buffer dependencies must stay same-origin. Prefer embedded GLB resources.
3. Edit `public/assets/signs/manifest.json`: set `avatar.url`, name, source, license, optional `boneMap`; add one entry per sign or reviewed phrase motion. `NEXT_PUBLIC_AVATAR_URL` overrides only the URL, not provenance.
4. Update `src/data/phrases.json` with stable sign IDs in reviewed sequence order and any explicitly reviewed source aliases. Do not derive an ISL gloss by uppercasing English. Leave `gloss: null` and `review: unreviewed` until review exists.
5. Run `pnpm db:sync-local` for an existing local store, or `pnpm db:seed` for PostgreSQL, then restart. These are administrative source-controlled operations, not an unauthenticated upload feature.
6. Run tests and visually inspect every imported clip, transitions, speed, pause, seek, hands, face, and framing. The UI detects missing clip names but cannot judge linguistic accuracy.

## Manifest schema

The live example is `public/assets/signs/manifest.json`; Zod schemas are in `src/lib/schemas.ts`. `AnimationRegistry` validates IDs and resolves availability. Every sign supports:

| Field                                       | Meaning                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                        | Stable unique key used by phrase records                                            |
| `label`, `gloss`                            | Human label and optional reviewed gloss/phrase identifier                           |
| `clip`                                      | Case-sensitive `THREE.AnimationClip.name`                                           |
| `asset`                                     | Null for embedded/procedural clip, otherwise `/assets/animations/...glb`            |
| `duration`                                  | Scheduled seconds, 0.1-60; the clip is sampled across this duration                 |
| `transition`                                | Blend seconds, 0-1; keep within meaningful reviewed timing                          |
| `review`                                    | `illustrative`, `unreviewed`, or `reviewed`                                         |
| `source`, `license`, `provenance`           | Actual source/rights and review evidence, never fabricated                          |
| `available`                                 | Manifest claim that a corresponding asset exists; runtime also checks clip presence |
| `handshape`, `movement`, `facialExpression` | Optional annotations for authoring/review                                           |
| `fallback`                                  | `rest` or `skip` for unavailable assets; never generate substitute signs            |

Do not mark records reviewed merely to remove a warning. A proper review record should identify the qualified reviewer, date, language/region, exact asset version/hash, tested meaning, and limitations. `Phrase.reviewer` stores reviewer attribution; the sign provenance can reference a versioned review document. Phrase review and motion review are separate decisions.

## Skeleton and coordinates

- glTF 2.0, right-handed, +Y up, meters, facing +Z toward the camera. Loader centers X/Z, grounds the bounding box, and scales visible height to 1.8 units.
- Apply transforms consistently in your DCC tool. Avoid negative bone scales, duplicate node names, and unbounded root motion. Hands must remain in camera framing.
- Demo hierarchy: `Hips -> Spine -> Neck -> Head`; `Spine -> LeftArm/RightArm -> LeftForeArm/RightForeArm -> LeftHand/RightHand`; each hand has `Finger0..4 -> Finger0..4Tip -> Finger0..4End`. Fingers 0-3 run from little to index; 4 is thumb. Legs branch from `Hips`. Legacy node names do not denote anatomical handedness: the close alphabet view is labeled **left-handed**. Demo names are for testing, not an anatomical ISL standard.
- Clip tracks may target bone quaternion/position/scale, skinned-mesh bones, or morph-target channels. A compatible human rig does not need to use demo names if its own clips match it.
- `avatar.boneMap` maps incoming track node names to avatar node names, for example `{ "mixamorigRightArm": "RightArm" }`. This is name remapping only. It does not correct proportions, rest-pose axes, finger topology, or root transforms. Bake retargeting in Blender/Maya or a tested mocap pipeline and review the exported result.
- Facial expressions/non-manual markers should be baked as compatible morph-target or facial-bone tracks in the same clip, so they share the playback clock. Metadata alone does not animate a face. The procedural test head does not provide fluent facial grammar.

## Missing content and performance

Reviewed translation playback requires `review: reviewed` on both the phrase and all mapped sign assets, nonempty `Phrase.reviewer`, and nonempty asset source/license/provenance. Incomplete sequences are not partially played. Explicitly enabled reference previews use their own unreviewed whitelist and visible output label. Do not change review flags to make fixtures appear functional: only real documented reviews qualify. The separate Motion lab permits illustrative assets strictly as rig tests. Existing guest history and favorites are preserved during catalog refresh.

Unavailable entries are visible in the result/detail view. Entirely unavailable sequences disable playback. Model download/parser errors explicitly fall back to the demonstration rig. Never relabel that fallback as a reviewed signer. Invalid manifest structure is rejected instead of guessed.

Use compact meshes, limited material counts, compressed textures where supported, and coherent skeletons. Draco/KTX2 decoders are not configured; export ordinary uncompressed GLB initially. The viewer loads external animation containers referenced in the manifest, so split large catalogs or add a clip cache before distributing large motion libraries. The canvas is dynamically imported, caps pixel ratio, and releases owned Three.js resources on unmount.
