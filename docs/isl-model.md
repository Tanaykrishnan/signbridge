# Real English-to-ISL motion model integration

## Release status

**A local research decoder is now implemented and optionally installed by `npm run isl:setup`.** See [local SignVQVAE setup and limitations](local-isl-engine.md). It generates experimental lexical motion from a 1,997-class vocabulary; it does not establish arbitrary-text or accurate sentence-level ISL translation. The seven greeting previews remain unreviewed. ISL never falls back to ASL. This document describes the separate external-provider contract, which still requires established commercial-use metadata.

`GET /api/capabilities` reports `not-configured`, `configured`, or `misconfigured`. For an external provider, `configured` means an endpoint was specified, not tested readiness. For `engine: local-sign-vqvae`, it means the authenticated local health check passed. Neither establishes linguistic accuracy; `arbitraryTextGuaranteed` remains false.

## Why the supplied datasets do not install a generator

- Kaggle and the GitHub alphabet corpus contain recognition images, not a trained English-to-motion model.
- The Mendeley corpus contains limited-domain paired sentences/videos. Its 101 imported gloss rows provide annotations, not human motion weights or animations. Training and evaluation are separate work; copying English tokens or asking a general LLM for glosses is not ISL translation.
- [RKMVERI's project page](https://cs.rkmvu.ac.in/~isl/) still labels code as coming soon, but the [authors' demo repository](https://github.com/suvajit-patra/sl-vqvae-gen-demo) is public and links pretrained files. Its README declares the project MIT licensed; the downloaded weight/data/FBX bundle has no separate license notice. The inference code fingerspells unknown words and removes some grammatical markers. It is a real integration candidate requiring rights clarification and linguistic evaluation, not a verified arbitrary-text, no-fingerspelling service. See the [updated ISL/ASL assessment](sign-language-feasibility.md).
- [BhashaSetu](https://www.bhashasetuisl.in/) explicitly says its SDK/weights and text-to-avatar pipeline are not shipped.
- [iSign's dataset card](https://huggingface.co/datasets/Exploration-Lab/iSign/blob/main/README.md) contains a Text2Pose task but is gated and research-only/noncommercial. It cannot silently be used for the intended public/commercial product.
- [IIIT's speech-to-sign repository](https://github.com/kapoorparul/Towards-Automatic-Speech-to-SL) contains training/testing code, not a supplied ready-to-run, licensed arbitrary-English ISL motion service.

Checked 2026-10-04. This is an assessment of these sources, not proof that no provider exists anywhere. Do not bypass gates, infer licenses for missing weights, or mistake a recognition checkpoint for a generation model.

## Configure an actual service

For a production external service, the operator must obtain or train a suitable model with documented data/weight rights. The optional local research server is not cleared for that use.

Set server-only variables and restart Next:

```dotenv
ISL_MODEL_URL=http://127.0.0.1:8001/v1/translate
ISL_MODEL_TOKEN=
```

The URL must be HTTPS or loopback HTTP (`localhost`, `127.0.0.1`, `::1`). Remote HTTP, embedded credentials, fragments and redirects are rejected. The token is a server-only bearer credential and is never sent to browsers. If an external service is configured, input text leaves the Next server for that endpoint; disclose this in the deployment privacy policy.

Each request sends the **complete** trimmed input, preserving punctuation, spelling and paragraph structure:

```json
{
  "version": 1,
  "sourceText": "What is your name?",
  "sourceLanguage": "en",
  "targetLanguage": "ISL",
  "skeleton": "signbridge-v1"
}
```

A plain text/gloss response, ASL response, generated video URL, random pose or English word lookup is not an acceptable response. The endpoint must return actual, retargeted temporal hand/body joint motion.

## Motion response contract

The canonical Zod schema is `src/lib/isl-motion-schema.ts`; import its `IslMotion` type when writing a TypeScript adapter. The model must return:

| Field                                   | Requirement                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `version`, `skeleton`, `targetLanguage` | `1`, `signbridge-v1`, `ISL`                                                                                |
| `sourceText`                            | Exactly the source submitted; another input's cached motion is rejected                                    |
| `model`                                 | ID/version, HTTPS source/license URLs, license, attribution, and `commercialUse: true`                     |
| `review`                                | `unreviewed`, or `reviewed` with named reviewer and HTTPS evidence URL                                     |
| `segments`                              | 1-128 ordered nonoverlapping source spans (`start`, `end`), optional gloss (`string` or `null`), and clips |
| `limitations`                           | Explicit provider limitations, max 30 strings                                                              |

Spans are UTF-16 indices into `sourceText`, like JavaScript `slice`. They must cover every non-whitespace source character. Missing prefixes, unknown middle words, suffixes and overlapping spans are rejected. This checks **source coverage**, not whether the generated signs convey the source meaning. A lying provider can pass structural checks; independently audit providers.

Each clip has:

- `duration`: 0.1-60 seconds; total response max ten minutes.
- `times`: 2-1,801 strictly increasing finite timestamps, first 0, last `duration`.
- `rotations`: every entry in exported `ISL_MOTION_BONES` (39 joints). Flattened local `[x,y,z,w]` unit quaternions, one per timestamp. All three joints of all ten fingers are required, even when stationary. Unknown bone/property names are rejected.
- Optional `expressions`: `browLeft`, `browRight`, `mouthOpen`, each one finite `[0,1]` weight per timestamp. Missing channels reset to neutral, avoiding leftover expressions between segments.

No remote asset URLs, arbitrary Three.js track paths, scripts, translations of only known words, or animation substitutions are accepted. Responses are bounded to 8 MiB and 60 seconds. The local transport permits at most two concurrent model requests per server module. Add shared throttling/queues before public deployment.

### Rig conventions

Use the original rig from `src/lib/avatar-rig.ts` and inspect its exact rest transforms. Units are meters, Y up, face toward +Z. `Hips` is at Y=0.92; `Spine` is its child at Y=0.1. Arm roots are at X=+/-0.29 and Y=0.38 relative to Spine; upper/forearm lengths are 0.31/0.28. Limbs point down along local -Y at rest. Quaternions are **absolute local rotations**, not deltas or world rotations. Finger indices 0-3 are little/ring/middle/index; 4 is thumb. `Tip` and `End` are the middle/distal joints.

**Legacy naming caveat:** `Right*` nodes at +X are anatomical left when the signer faces +Z. `Left*` nodes are anatomical right. An adapter must explicitly retarget handedness; never assume node labels follow a third-party skeleton. This is especially important for two-handed ISL.

Generated motion deliberately uses this procedural rig, not a custom GLB whose proportions/rest pose may differ. The local research adapter now maps its specific 51-point MediaPipe-style output to this rig, including a research-only left finger-base correction. General SMPL-X/FBX or arbitrary-skeleton retargeting is not implemented. The rig has head/neck/body rotations and simple eyebrow/mouth controls, **not complete linguistic mouthing or a validated facial model**. It is a visualization foundation, not a certified interpreter.

## Review and playback

Unreviewed model motion is blocked unless the request includes `allowUnreviewedModel: true`. The API default is false. The UI enables this option by default for an online installed local research decoder, with visible unreviewed status; reviewed-only mode and external providers do not opt in automatically. Reviewed status/evidence are reported by the provider, never independently certified by SignBridge. Linguistic confidence remains null. Do not mark synthetic fixtures or a model's self-assessment as expert validation.

Valid clips become real `THREE.QuaternionKeyframeTrack`/`NumberKeyframeTrack` instances. The existing AnimationMixer and sequence clock handle playback, pause/resume, restart, speed and seeking. Segment transitions are not auto-smoothed across model output: the adapter must generate continuous endpoints. This prevents blending from destroying finger contacts or linguistic transitions.

Failure produces an empty sequence, a specific `blockReason`, and an explanatory message. It never plays only the supported part of a paragraph or substitutes ASL. No endpoint configured: local reference previews can still run with explicit preview consent.

The translation API returns a signed 15-minute `historyReceipt`. The studio submits it with the same source/options when saving history, so expensive model inference is not repeated. Tampered, expired or different-input receipts are rejected. History stores source and actual mode/status, **not generated motion**; reopening regenerates and can fail if the model is offline or changed.

## Verification limits

Software tests cover wrong languages, omitted text, incompatible rigs, missing fingers, timing/quaternions, license/review metadata, HTTP failures/size/cancellation, signed history receipts, and actual 3D sampling. All synthetic poses are in `tests/fixtures`, explicitly marked **NOT ISL**, and never seeded into the application or used as a fallback. Browser fixture tests prove rendering, not translation quality.

Real weights can now be installed and decoded, and mechanical tests exercise novel combinations. Before claiming accurate arbitrary-text ISL: evaluate unseen sentences and held-out signers, test the campus examples with Deaf ISL users, evaluate names/numbers/negation/questions/regional forms/non-manual grammar, inspect uncertainty and rejection behavior, and record review evidence and licensing/consent. These linguistic and permission tasks remain outstanding.
