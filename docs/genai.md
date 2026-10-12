# Local English paraphrasing and Review 2

## Implemented functionality

SignBridge uses pretrained Qwen2.5-1.5B-Instruct through the official llama.cpp CPU server to generate English paraphrases. Three real prompt strategies, model status, comparisons, preservation flags, exact prompt evidence, guest records and downloads are implemented. No model training or weight fine-tuning was performed. This English model does not generate ISL motion.

Open `/studio` for the mandatory paraphrase-first ISL/ASL workflow and `/review` for rubric-linked evidence. `/language-lab` remains an advanced three-prompt comparison experiment, not a separate signing step. Check the generated English against the original. Unsupported ISL vocabulary remains explicitly blocked. See [pipeline contract and failure handling](signing-pipeline.md).

## Setup and startup

```powershell
pnpm ai:setup
pnpm dev
```

`pnpm dev` starts the website and installed local models together; keep its terminal running. `pnpm dev:web` and `pnpm ai:start` are available for separate-process development. Installation downloads a pinned official Windows x64 runtime and about 1.1 GB of weights into `.local-ai/`. Weights are verified against the publisher's SHA-256. Internet is required once; inference works locally afterward. Allow at least around 2 GB of memory for the model plus memory for Next.js and the browser. Response time depends on hardware and input length.

The model binds to `127.0.0.1:8081`, using a generated key in `.local-ai/server.key` that only the backend reads. Both servers must run for the demo. One generation runs at a time; competing requests receive 429. For other operating systems, install an OpenAI-compatible llama.cpp/Ollama server and configure its `/v1` endpoint and loaded model ID.

| Environment variable     | Default                    | Purpose                                    |
| ------------------------ | -------------------------- | ------------------------------------------ |
| `PARAPHRASE_MODEL_URL`   | `http://127.0.0.1:8081/v1` | API base; loopback HTTP or HTTPS           |
| `PARAPHRASE_MODEL_NAME`  | `signbridge-qwen2.5-1.5b`  | Loaded model alias                         |
| `PARAPHRASE_MODEL_TOKEN` | Empty                      | Optional custom service token; server only |

The [official Qwen model](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) is Apache-2.0, revision `91cad51170dc346986eccefdc2dd33a9da36ead9`, Q4_K_M. SHA-256: `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`. [llama.cpp](https://github.com/ggml-org/llama.cpp) is MIT licensed; runtime release `b11445`. Installation provenance is stored in `.local-ai/provenance.json`. Custom endpoints require their own provenance; they are not automatically attributed to Qwen.

## Pipeline and API

```text
English -> validated input -> prompt -> pretrained Transformer
        -> validated English paraphrase -> preservation warnings
        -> ISL motion provider / ASL alphabet engine -> asset gate -> avatar
```

Requests support 1-5,000 characters with English letters, schema-constrained JSON, cancellation, bounded responses, a 180-second timeout and explicit errors. All prompt strategies use the same output schema. Returned evidence contains the exact system/user prompt, version, model ID, timings, token counts and timestamp. Offline or malformed responses never produce fake success.

- `GET /api/paraphrase/status`: checks that the server lists the configured model.
- `POST /api/paraphrase`: `{text, strategy}`; `zero-shot`, `few-shot`, or `constrained`.
- `GET /api/paraphrase`: latest 50 real results for the signed guest session.
- `GET /api/review/evidence`: fixed, nonsensitive demonstration report and scenarios.

Records are in `.data/paraphrases/<guest-uuid>.json`, even if translation records use PostgreSQL. Writes are serialized and atomic inside one local Node process. Source text and prompts are stored; losing the cookie loses access. The benchmark report contains authored examples only, never private guest generations. External endpoint configuration sends input to that endpoint.

## Actual prompt experiments

With both servers running, execute `pnpm ai:evaluate`. This makes 15 real requests: five scenarios times three prompts. Prompt examples differ from evaluation inputs. All requests use temperature 0, seed 42 and the same output schema. Warm-up/context reuse can affect timings. Exact outputs, failures, required terms and metrics are written to `outputs/review2-evidence.json`; a failed generation makes the command exit unsuccessfully. Re-running replaces that experiment report only.

Literal term retention and numeric/time/negation/name/question flags are heuristics, not semantic accuracy. Preserving a negation cue does not prove its scope. Human evaluation is still required for omissions, invented answers, question meaning, uncertainty and conditions. These metrics are not ISL grammar, accessibility or signing accuracy.

## Review conditions and limits

The three-slide presentation maps to 10/5/5 marks: model justification; actual outputs, objectives and refined pipeline; prompt scenarios. Notes allocate 1:45 + 1:45 + 1:30 = 5:00. Slide 1 includes the team-reported feedback: idea appreciated, no specific corrections requested. The original Review 1 template is reused. No autonomous agent architecture is implemented. All team members must still attend and rehearse.

The scoped software checklist does not prove 70% completion of unrestricted ISL translation. Faculty acceptance of the demonstrated scope is still needed. The installed experimental decoder supports available vocabulary, but unrestricted sentence-level ISL translation and ISL expert validation remain outstanding.

## Troubleshooting

- Offline: run `pnpm dev` (or `pnpm ai:start` separately) and refresh studio model status. Confirm port 8081 is available.
- Missing weights: run `pnpm ai:setup`; keep `.local-ai/` outside `public/`.
- 429: wait for the running request or evaluation to finish.
- Timeout/truncated output: use shorter sections; no partial result is accepted.
- ISL still blocked: confirm its local server is running. Paraphrasing does not supply missing ISL vocabulary or establish linguistic accuracy.
- Busy CPU: run one generation at a time and close unused applications.
