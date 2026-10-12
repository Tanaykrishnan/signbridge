# ISL datasets and local implementation

Inspected 4 October 2026. No paid service or remote AI model is connected.

## Findings from the supplied datasets

| Source                                                                                              | Contents and published license                                                                                                                            | Use in this project                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Prathum Arikeri / Kaggle](https://www.kaggle.com/datasets/prathumarikeri/indian-sign-language-isl) | Character-level images; API lists 299,044,944 bytes and CC BY-SA 4.0. The creator describes combining self-made images with other GitHub/Kaggle datasets. | Not bundled. Useful for alphabet recognition and pose-reference research. Upstream provenance and share-alike obligations need checking before incorporating individual images or derivatives. No sentence motion or ready translation model established. |
| [Ayesha Hannure / GitHub](https://github.com/ayesha-hannure/Indian-Sign-Language-dataset)           | README describes approximately 12,700 processed/augmented A-Z images and CSV pixel values; repository includes Apache-2.0 LICENSE.                        | Not bundled. Recognition data, not time-series motion coordinates. README reports 486 images per class, which does not exactly equal its rounded total; archive counts were not independently audited.                                                    |
| [ISL-CSLTR / Mendeley, v1](https://data.mendeley.com/datasets/kcmpdxky7p/1)                         | Sentence videos, images, annotations; CC BY 4.0. DOI 10.17632/kcmpdxky7p.1; Elakkiya R and NATARAJAN B, 2021.                                             | Imported the source sentence/gloss CSV into `src/data/isl-csltr.json` with attribution. Exact matches expose textual annotations only. No source videos, images, trained model, or skeletal motion is bundled.                                            |

The Kaggle license and description were read through its public metadata endpoint:
`https://www.kaggle.com/api/v1/datasets/view/prathumarikeri/indian-sign-language-isl`.
The GitHub root LICENSE was inspected, not inferred from public repository visibility.

Mendeley's published description reports 700 videos and 100 sentences. The actual version-1 ZIP directory contains **687 MP4s, 19,899 JPGs, 483 DB files, three XLSX files, one CSV, and one TXT file**. Its CSV has **101 non-empty sentence/gloss pairs** plus a header. These observed counts differ from the description. Preserve this distinction in dataset reports. The CSV includes placeholder sentences and source spelling errors; this project retains them rather than silently rewriting them. No recognized GLB, FBX, BVH, or other skeletal animation files occur in the archive index. Spreadsheet internals were not inspected.

The archive is 8,905,822,924 bytes. The inspector read only 2,791,362 bytes to list its directory and retrieve the small CSV/TXT annotations. It uses Python's standard ZIP/CSV parsers, validates range responses, limits individual reads to 4 MiB and total transfer to 16 MiB, and never extracts archive paths onto disk.

```sh
python scripts/inspect_isl_dataset.py --annotations
# Optional independent export to a NEW file; existing files are refused.
python scripts/inspect_isl_dataset.py --export-glosses work/isl-csltr-check.json
```

The inspector pins the public version-1 object and length. If the publisher changes the object, inspect new metadata rather than bypassing its range validation. Source CSV pairs are used only for exact normalized matching. For example, `Are you free today?` retrieves its published gloss; `What is your name?` has no exact row. Glosses are sign labels, not executable hand poses. Importing annotations has not trained an AI model or established generalization to unseen sentences.

## What plays locally

Seven original, unreviewed 3D reference previews are available: **Hello, Thank you, Namaste, Sorry, Bye, How are you?, Good morning**. Aliases include hi/hey, thanks, and goodbye. These numeric animations were authored from the [NISH greeting illustration, PDF page 21 / printed page 36](https://nish.ac.in/docs/EIP_Magazine_2020.pdf#page=21), not generated from the three datasets. The source illustration is not redistributed. The original code/numeric tracks are under project MIT; this does not relicense the source publication.

The previews include wrist paths, two-arm inverse kinematics and three-joint fingers, with the original mannequin's anatomical left hand dominant. Non-manual grammar, facial expression, regional variation, and intelligibility have **not** been validated by an ISL expert. These are approximations, not verified translations or a teaching resource. Pose interpolation and contacts still require expert review.

Open `/studio` or `/studio?mode=isl`. Reference previews are explicitly unreviewed. `Hello. Thank you!` assembles two complete supported utterances. `Hello, please tell me your name` does not replace known words, discard unknown text, or fall back to ASL: it reports that a generation model is required. Inputs accept up to 5,000 English characters. A configurable [real model-motion transport](isl-model.md) exists, but no trained arbitrary-text ISL generator is installed.

## API and storage contract

```json
{
  "text": "Hello! Thank you.",
  "language": "en",
  "outputMode": "isl",
  "allowReferencePreview": true
}
```

`allowReferencePreview` defaults to **false**. The reviewed-only `phrasePlayback` gate is unchanged. `/studio?mode=isl&reviewedOnly=1` disables reference previews. Reviewed phrases/assets take priority; unreviewed previews use a separate whitelist and `rendering: isl-reference-preview`. No review flags are elevated. `fallback: asl-fingerspelling` now returns HTTP 400.

ISL responses always target ISL, with an empty sequence if no motion is available. History preserves actual output mode; existing ASL records still reopen in the separate ASL tool. `datasetMatch` carries the source sentence, published gloss, source URL, attribution, license, and `animationAvailable: false`. It does not supply animation IDs or infer unseen-sentence glosses.

After upgrading an existing local store, run `pnpm db:sync-local`; it refreshes fixture metadata and preserves history/favorites. For PostgreSQL, use `pnpm db:seed`. Existing custom fixture records should be backed up before synchronization. No additional database migration is required for these optional response fields.

## Next work needed for accurate ISL

Mendeley's paired sentences/videos are a promising limited-domain corpus. A real animation pipeline would need controlled video selection, body/hand/face tracking, temporal alignment, uncertainty handling for occluded fingers, rig retargeting, and review by Deaf ISL users. Held-out signers and unseen sentences need separate evaluation. Image-classifier accuracy cannot establish text-to-sign quality. The public license is documented; likeness, consent and any third-party rights must be checked before redistributing identifiable signing media. No such media is bundled in this implementation.

Without a configured model endpoint, no generative model is called. A general text LLM alone cannot supply validated sign motion or guarantee ISL grammar. Commercial-grade arbitrary sentence translation remains unimplemented until suitable weights, motion retargeting and independent expert evaluation are supplied.
