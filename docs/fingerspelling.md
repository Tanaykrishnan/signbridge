# English-to-ASL fingerspelling

## What works

The separate ASL tool at `/studio?mode=fingerspelling` accepts English text of 1-5,000 UTF-16 characters. It is never an automatic fallback for ISL requests. Text drives an ordered sequence of original ASL manual-alphabet hand poses, not the same generic motion for every request. Each finger has three animated joints. J and Z have moving paths; consecutive repeated letters have lateral movement; spaces and sentence boundaries introduce pauses. Play, pause, resume, restart, speed, seeking and word navigation share the playback clock. History preserves the selected output mode.

The built-in close hand view is left-handed. It uses an original procedural rig and original parameterized animations, with no third-party images, videos, models or motion-capture files bundled. Camera presets and orbit controls allow inspection from different angles.

**These animations are reference-informed but not expert-reviewed. Fingerspelling preserves written characters; it does not translate English sentence meaning, ISL grammar, ASL grammar or non-manual linguistic features.** A long paragraph can take many minutes to spell. Navigate by source word or timeline rather than expecting fluent sentence signing. Do not use it as an interpreter for urgent, medical, legal or safety-critical communication.

## Input contract

- ASCII English letters retain order; case is rendered uppercase. Apostrophes and punctuation do not add letter motions. Sentence-ending punctuation lengthens the next boundary pause.
- Hyphens introduce a pause within the same source word. Adjacent repeated letters use a different motion clip.
- Latin diacritics are reduced to their base letters using NFKD, with a visible warning. Source captions remain unchanged.
- Digits are spelled using ZERO through NINE, with a warning. This is not ASL number signing.
- `& @ % + $ # = /` are spelled using declared English names, with a warning. Other non-punctuation symbols, emoji and unsupported scripts produce explicit warnings, not guessed signs. Warnings are capped with an omitted-count summary for hostile/very long inputs.
- A punctuation-only or unsupported-only input produces no signing output. English is the only enabled input language.
- Source tokens carry character and word offsets; the UI derives captions from the original source text. API bodies are capped at 32 KiB, independently of the text limit.

## Architecture

```text
POST /api/translate { text, language: "en", outputMode: "asl-fingerspelling" }
  -> Zod limits
  -> FingerspellingProvider
  -> planFingerspelling: original spans, letters, repeats, pauses, warnings
  -> Sign[]: unreviewed, ASL provenance, original clip IDs
  -> Viewer: source captions, windowed sequence, word navigation
  -> PlaybackEngine: prefix timings, binary seek, transition origin
  -> AnimationMixer: actual joint quaternions and hand-motion paths
```

`src/lib/asl-alphabet.ts` owns metadata and poses. `src/lib/fingerspelling-clips.ts` owns animation generation. Neither attempts sentence parsing or a linguistic gloss. The independent `DictionaryProvider` continues requiring reviewed ISL phrases and complete reviewed assets; fingerspelling never bypasses that gate or labels its motions ISL. The API's omitted-mode default remains ISL for backward compatibility.

Persistence uses the existing guest-scoped local-file/PostgreSQL adapters. Migration `202610040001_long_text_fingerspelling` adds the output mode and expands stored text. Existing local history defaults to ISL. ASL results are retained in history, not inserted into the reviewed phrase library.

## Research and rights

Sources consulted for the design, not scraped or redistributed:

- [Lifeprint fingerspelling reference](https://www.lifeprint.com/asl101/pages-layout/fingerspelling.htm): manual-alphabet structure, moving J/Z and orientation distinctions. [Handshape reference](https://www.lifeprint.com/asl101/pages-layout/handshapes.htm) was also inspected. Our meshes, numeric poses and tracks are newly authored; reference photographs are not bundled. Attribution is not a grant to redistribute source media.
- [Gallaudet ASL language profile](https://sites.google.com/gallaudet.edu/a-language-profile-for-asl/home): the language-level distinction between fingerspelling borrowed written words and ASL itself.
- [iSign dataset terms](https://huggingface.co/datasets/Exploration-Lab/iSign/blob/main/README.md): noncommercial/research restrictions make it unsuitable as a drop-in dataset for the requested public/commercial application. Not integrated.
- [ISL fingerspelling dataset](https://kirandevraj.github.io/ISL-Fingerspelling/): published noncommercial terms. Not integrated.
- [ISLRTC FAQ](https://islrtc.nic.in/faq/) and [copyright policy](https://islrtc.nic.in/copyright-policy/): access does not establish commercial redistribution permission. No dictionary videos or copyrighted assets were imported.

The project MIT license covers its original code/geometry/animation data, not the reference sites or their media. A dataset listing or repository license must be checked against underlying media rights, likeness permissions, intended commercial use and redistribution terms before importing assets.

## Accuracy and release gates

Automated tests establish source-letter preservation, bound joint tracks, finite poses, actual J/Z movement, basic fingertip contact, playback behavior and differing rendered pixels. They do **not** establish linguistic accuracy or intelligibility. The current poses are engineering approximations, particularly thumb occlusion/contact in M/N/T, finger crossing in R, orientation and coarticulation. No confidence score or expert-review claim is fabricated.

Before advertising accurate ASL fingerspelling, engage a qualified Deaf ASL reviewer, evaluate all 26 letters (front and oblique views), J/Z trajectories, M/N/T distinctions, palm orientation, fingertip contact, repeated letters and complete words across speeds. Record reviewer, date, asset hash/version, dialect/handedness and observed limitations. Test recognition with Deaf users using unfamiliar words and names, not only labeled alphabet screenshots. Correct geometry and motion before setting any review status.

For semantic sentence translation, add an independently reviewed linguistic provider, properly licensed word/phrase motion assets and non-manual/facial grammar. Unknown content must still abstain or explicitly fall back to fingerspelling with language/mode labels. Do not present English word substitution as a sign-language translation.

## Testing

`tests/fixtures/srm-inputs.ts` contains the user's five campus requests, long paragraph and unfamiliar place name. Unit/API tests verify every letter and output-mode persistence; browser tests convert the combined paragraph, navigate words, copy, reopen history, inspect all 26 poses and compare live WebGL pixels. QA contact sheets are diagnostic captures only; the application always renders live Three.js geometry.

Run the standard README verification commands. A PostgreSQL deployment needs `pnpm db:migrate`; local-file development requires no external credential or paid service.
