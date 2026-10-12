# ISL repair and ASL migration assessment

Checked 4 October 2026. This is a source/code/license audit, not an installed-model accuracy benchmark. No application mode was changed, no vendor account was created, and no user input was sent to an external translation service.

## Decision summary

Changing the target-language label does not install a translator. SignBridge's current ASL mode is alphabet fingerspelling, not English-to-ASL sentence translation. Its ISL mode has seven unreviewed reference previews and a motion-service connector, but no connected generation engine.

ASL has documented commercial integration options and more available research tooling. That makes a broader translator more feasible, not automatically accurate, free, local, or compatible with our avatar. For the current combination of free/local, custom 3D, arbitrary sentences, and no fingerspelling, neither language has a verified ready-to-install solution established by this audit.

ASL is not an interchangeable replacement for ISL. Choose the target language based on the intended signers, not just available software. The [NIDCD language overview](https://www.nidcd.nih.gov/health/american-sign-language) explains that sign languages differ, ASL has its own grammar, and fingerspelling is normally used for proper names. Requiring exact communication of every unfamiliar name while banning all fingerspelling needs a separate, linguistically valid policy; never invent name signs.

## What is actually available

### ISL: RKMVERI learned-pose demo

The [IJCAI 2026 paper](https://www.ijcai.org/proceedings/2026/823) describes gloss-driven ISL production using learned pose representations. The [authors' repository](https://github.com/suvajit-patra/sl-vqvae-gen-demo) now supplies model code and a pretrained-file link. Its README declares the project MIT licensed; separately applicable rights for the downloaded weights, encoded corpus and bundled avatar need clarification.

The public ZIP index was inspected without executing pickle/checkpoint files. Its five entries total a 402,504,406-byte archive: a checkpoint, two encoded-data pickles, a vocabulary CSV and an FBX. The CSV contains 1,997 distinct classes. Vocabulary entries include the screenshot's student, here, where, find, blue and building, but not SRM, Kattankulathur, bonafide, internship or appointment as exact lookup keys. That establishes dictionary coverage only, not sentence intelligibility.

The [inference source](https://github.com/suvajit-patra/sl-vqvae-gen-demo/blob/main/generate_inference_from_text_fdmse.py) spells missing words and strips question/past/future markers. It cannot be integrated unchanged as a universally accurate, no-fingerspelling translator. Obtain rights clarification and evaluate it as an experimental sentence-composition baseline.

### ISL: training data and announced products

The [Mendeley ISL-CSLTR corpus](https://data.mendeley.com/datasets/kcmpdxky7p/1) is published under CC BY 4.0. Our imported 101 sentence/gloss rows are annotations, not a trained generator. It is a limited-domain starting point; it does not establish unseen-paragraph coverage.

[iSign](https://huggingface.co/datasets/Exploration-Lab/iSign/blob/main/README.md) includes a Text2Pose task, but its access terms explicitly restrict use to research and prohibit commercial use and redistribution. Dataset availability does not establish a usable pretrained service.

[BhashaSetu](https://www.bhashasetuisl.in/) says its SDK and weights are not installable yet. [Ishaara webSign](https://www.ishaara.app/websign) advertises ISL avatar translation but labels the product as releasing soon and offers launch notifications. Neither was verified as an available integration in this audit.

### ASL: Hand Talk SDK

[Official SDK documentation](https://api-docs.handtalk.me/v1/en/introduction) describes ASL/Libras translation with a WebGL signing window. [Configuration](https://api-docs.handtalk.me/v1/en/javascript/reference/explain-configs) documents ASL as `en-ase` and requires a contract-issued token. [Methods](https://api-docs.handtalk.me/v1/en/javascript/reference/methods-and-props) expose `translate(sentence)`, pause/resume, stop/repeat, speed, zoom and rotation.

This is the most concrete documented vendor route found for retaining an interactive 3D signing experience. It uses the vendor's avatar/runtime, not arbitrary animation clips for our Three.js rig. Requests are limited to 1,000 characters. Longer documents would need sentence-aware queuing and context/quality evaluation. No unlimited free tier, custom-avatar export entitlement, no-fingerspelling guarantee or independent accuracy result was verified. Confirm all four before committing.

### ASL: Sign-Speak API

[API specifications](https://app.theneo.io/sign-speak/sign-speak-api/api-specifications) document `POST /produce-sign` with English input, an API key, blocking/batch operation, and generated MP4 output. It is a concrete text-to-ASL generation integration candidate, not just alphabet lookup.

This would need a video-output workspace, asynchronous-job handling and provider access. The documented response is not skeletal motion for our existing avatar. Provider claims about quality are not our evaluation; no credentials, pricing agreement or inference test was available in this audit.

### ASL: Signapse SignStream

[SignStream](https://www.signapse.ai/signstream-api) documents text-to-ASL/BSL video output and advertises a 60-second free chat trial, not unlimited free API access. Its FAQ explicitly says the API output has no human grammar checking/QA and can contain grammatical errors. It is not recommended by the vendor for formal, legal or official use.

It is a useful evaluation candidate, with the same video-versus-custom-avatar tradeoff. Do not treat a successful video response as verified interpretation.

### ASL: SignSparK research models

[Official code](https://github.com/JianHe0628/SignSparK) and [pretrained checkpoints](https://huggingface.co/LionelLow/SignSparK) are available. Code is Apache-2.0, but released data/checkpoints are noncommercial research-only. The Hub lists three checkpoint files of roughly 5.58 GB each, about 16.74 GB total before dependencies/data. GPU-oriented inference and SMPL-X retargeting need engineering and measurement.

Crucially, the main model uses sparse signing keyframes as well as text. The separate [text-to-gloss/retrieval pipeline](https://github.com/JianHe0628/SignSparK_Retrieval) currently documents Chinese CSL-Daily and German PHOENIX-2014T, not an ASL text-to-gloss model. Its missing-gloss behavior selects a nearest dictionary gloss, which must not silently substitute a different meaning. ASL training support in the pose generator does not establish a ready arbitrary-English-to-ASL application.

### ASL: SignGPT, SOKE and Neural Sign Actors

[SignGPT research code](https://github.com/signgpt-demo/SignGPT) supports dataset-specific ASL text-to-motion and has MIT source code. Its setup requires trained tokenizer/full-model checkpoints, statistics and external assets; no pretrained SignGPT weight download was documented in the checked README. The [paper](https://arxiv.org/html/2609.21709v1) explicitly presents a research-stage system, not deployment readiness. Its How2Sign data has [noncommercial terms](https://how2sign.github.io/).

[SOKE](https://github.com/2000ZRL/SOKE) supports 3D generation and supplies a tokenizer checkpoint link. A tokenizer/backbone alone is not the trained text-to-motion generator. Its [code license](https://github.com/2000ZRL/SOKE/blob/main/license.txt) is CC BY-NC-ND 4.0; commercial use and adapted distribution require separate consideration/permission.

The public [Neural Sign Actors repository](https://github.com/baltatzisv/neural-sign-actors) identifies itself as the project page, not a complete released inference implementation. A published paper or animation demo does not prove installable weights exist.

## How to fix ISL, technically

The following is proposed work, not implemented functionality:

1. **Establish the engine and rights first.** Request explicit model/encoded-data use and deployment terms from the RKMVERI authors. Request their vocabulary, unknown-concept policy and interpreter evaluation scope. Exclude the bundled FBX until its rights are established; our original rig can remain.
2. **Evaluate a real model offline.** Use the actual pretrained decoder and corpus, not random weights or generated glosses alone. Run the user's five campus examples, the screenshot, new unseen sentences and contrast pairs. Do not reuse test-set motion or ground-truth timing to make arbitrary input appear supported.
3. **Repair linguistic handling with ISL expertise.** Preserve negation, time, questions, referents and clause scope. Dependency parsing or a generic LLM may assist preprocessing, but neither proves correct ISL. For unavailable concepts, use reviewed explanatory constructions or ask for clarification. With spelling disallowed, reject unrecoverable concepts explicitly; do not discard them.
4. **Serve actual motion locally.** Build a bounded Python inference service, isolate output per request, avoid shared temporary-file races, constrain concurrency, and load checkpoint/pickle material only after a trust/security review. Convert temporal body/hand coordinates to our local skeletal rotations with handedness/contact tests, adding required facial grammar. Return complete-input provenance and explicit unsupported reasons.
5. **Integrate only after the benchmark passes.** Connect that actual service to the existing translation API and mixer. Model availability, input coverage and expert review are separate states. Do not mark a whole paragraph successful if only known pieces were signed.

For a production ISL system, rights-cleared signer recordings, temporal body/hand/face annotation and expert-reviewed translations will likely be needed beyond this limited baseline. That is a model/data program, not an avatar-library replacement. Do not infer universal capability from a finite vocabulary or a paper metric.

## ASL migration without repeating this failure

Keep the Next.js shell, history/favorites and reusable controls. Introduce explicit target-language and output-kind contracts; choose one real output path:

- Vendor 3D SDK: mount its runtime in the studio and use its documented controls. Do not pretend those motions are rendered by our mixer.
- Vendor video API: use a separate video player with generation/job/error states. Do not advertise an interactive custom 3D avatar.
- Local research model: keep Python inference outside Next, perform motion retargeting, and respect research-only weight/data terms. A commercially permitted code license does not establish commercial rights to models/assets.

Do not reuse the ISL phrase matcher and simply relabel it ASL. Do not call our existing alphabet pipeline sentence translation. Names are a separate requirement: ASL legitimately uses fingerspelling, so a blanket ban needs to be reconciled with how exact unfamiliar names are communicated.

## Benchmark before selecting or switching

Use at least 50 new sentences spanning campus directions, requests, questions, negation, time, numbers, names, ambiguous wording and the user's paragraph. This proposed set size is an engineering starting point, not a statistically validated threshold.

Include minimal pairs such as `I need help` / `I do not need help`, `The office closes today` / `The office closes tomorrow`, and `The blue building` / `The red building`. Distinct-looking motions alone are not evidence of correct meaning. Ask fluent Deaf users/reviewers to explain each generated message without seeing its English source, then assess meaning, grammar, hands/face, omissions, additions and repair behavior.

A [June 2026 preprint](https://arxiv.org/html/2606.01643v1) reports conditional-collapse and target-faithfulness failures across 14 How2Sign generator checkpoints. Its findings are specific to the studied models/protocol, not proof that every system fails. They do explain why motion smoothness and automatic scores cannot substitute for this review.

Record actual latency, failed jobs, source completeness and licensing costs as well as linguistic results. Do not promise any-text accuracy or no-fingerspelling from a successful HTTP response, a dictionary size, BLEU/FID alone, or provider marketing.

## Recommendation

For an ASL-facing product where a vendor service is acceptable, evaluate Hand Talk first for 3D, and Sign-Speak/Signapse if generated video is acceptable. Use temporary evaluation credentials and nonsensitive examples, not a full app migration or production signup before the test.

For the current free/local custom-avatar requirement, retain the working application and run a genuine model proof of concept before changing its language. ASL lowers some availability barriers, but a polished, accurate, arbitrary-text commercial translator is not established by the local research options above.

For an Indian ISL audience, retain ISL as the product goal and pursue the RKMVERI baseline plus expert review and rights clarification. ASL is a different product/audience decision, not a repair to ISL.

No pretrained model was installed or benchmarked, and no vendor translation was executed in this audit. Software unit/browser tests of fixtures cannot certify sign-language accuracy. Runtime code, persistence and current modes are unchanged.
