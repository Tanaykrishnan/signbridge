# Review 2: five-minute presentation

Use `outputs/SignBridge-Review2.pptx`, exactly three content slides in the supplied SRM template. Slide 1 includes the actual team-reported Review 1 feedback. Keep all four members present: Kavin Krish, Tanay, Anant and Pranav (names taken from the original deck). Rehearse the exact time; attendance and faculty approval of the scoped prototype cannot be completed by software.

## Slide 1: 1:45, 10 marks

Explain that the implemented GenAI stage generates English paraphrases with pretrained Qwen. Describe learned weights (ML), neural layers (DL), rewriting (NLP), attention (Transformer) and token generation (GenAI). Say why local CPU inference suits this prototype. Show model status and exact prompt/output evidence. State that no training or weight fine-tuning was performed. Review 1 feedback: idea appreciated, no specific corrections requested. No autonomous agent architecture is used.

## Slide 2: 1:45, 5 marks

Walk through the refined implemented pipeline: English -> model prompt -> English paraphrase -> checks/user confirmation -> sign asset gate -> available reference playback. Tie results to preserving meaning, especially names, time and negation. Use actual failures: basic paraphrasing changed "bonafide certificate" to "valid certificate"; the example prompt omitted "today" from the library question. The constrained prompt preserved those literals in the recorded samples. ISL sentence generation remains incomplete. Refining a pipeline diagram is distinct from fine-tuning model weights.

## Slide 3: 1:30, 5 marks

Compare actual results from five scenarios across three prompts. Explain that all settings and the JSON schema were held fixed. Basic retained 14/17 tracked literals, examples 15/17, constrained 17/17 in the recorded demonstration. These are exact phrase checks, not semantic accuracy or a statistically representative benchmark. Show the preservation instruction excerpt. If a live example fits the time, use the campus question in the language lab; do not start all fifteen runs during the talk.

## Before the review

1. Run `pnpm ai:start` and `pnpm dev` in separate terminals.
2. Open `http://127.0.0.1:3000/language-lab` and confirm LOCAL MODEL ONLINE.
3. Keep `/review` open with the recorded evidence. It remains inspectable if inference is temporarily unavailable; label recorded results accurately.
4. Use nonsensitive examples and keep the exact deck/PDF/evidence files available.
5. Ask faculty to accept the demonstrated English-generation scope. Do not claim 70% of arbitrary-text ISL translation is implemented. The application has eight completed scoped milestones and two outstanding research milestones; that is an unweighted checklist, not a grade or an estimate of total effort.

## Likely questions

**Where is the GenAI?** Qwen generates the English output token by token. The avatar renderer and phrase lookup are ordinary application logic.

**Did you train or fine-tune it?** No. We integrate pretrained inference and compare prompts. We refined the pipeline diagram.

**Can it sign every sentence?** No. The language model can paraphrase new English within the input limit; signing requires compatible ISL motion assets/model output that are not installed.

**Does 17/17 mean 100% accuracy?** No. It means seventeen selected literals were found in these outputs. It cannot detect all meaning changes or establish ISL accuracy.

**What did your team build?** The model transport, prompt strategies, validation/checks, UI, comparisons, evidence generation, persistence and studio integration around an attributed pretrained model, alongside the existing avatar system.
