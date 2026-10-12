'use client';
import { WorkspaceHeading } from './workspace-heading';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Download,
  FileCheck2,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge, IconButton } from './ui';
import { useRemote } from './providers';
import type { ReviewEvidence } from '@/lib/review-evidence';
import type { ParaphraseStatus } from '@/lib/paraphrase-schema';
import './paraphrase.css';
import './review.css';
const milestones = [
  ['English input and validation', true],
  ['Real pretrained model inference', true],
  ['Three prompt strategies', true],
  ['Output inspection and export', true],
  ['API and guest persistence', true],
  ['3D renderer and playback', true],
  ['Reference phrase playback', true],
  ['Measured experiment report', true],
  ['Arbitrary-text ISL motion generation', false],
  ['ISL expert evaluation', false],
] as const;
export function ReviewWorkspace() {
  const evidence = useRemote<{ report: ReviewEvidence | null }>('/api/review/evidence');
  const status = useRemote<ParaphraseStatus>('/api/paraphrase/status');
  const [strategy, setStrategy] = useState('constrained');
  const report = evidence.data?.report;
  return (
    <div className="review-workspace">
      <WorkspaceHeading
        eyebrow="SIGNBRIDGE / REVIEW 02"
        title="Evidence, in the open"
        description="Applied Generative AI · 7 October 2026 · 20 marks · 5 minutes"
      >
        <Link href="/studio" className="button primary">
          <BrainCircuit size={16} />
          Open live demo
          <ArrowUpRight size={15} />
        </Link>
      </WorkspaceHeading>
      <div className="review-status">
        <Badge tone={status.data?.state === 'ready' ? 'teal' : 'amber'}>
          {status.data?.state === 'ready' ? 'LOCAL MODEL ONLINE' : 'MODEL OFFLINE'}
        </Badge>
        <span>
          {report
            ? `${report.samples.filter((s) => s.result).length} recorded model runs · ${new Date(report.generatedAt).toLocaleString()}`
            : 'Experiment report not generated yet'}
        </span>
        <IconButton
          label="Refresh review evidence"
          onClick={() => {
            evidence.reload();
            status.reload();
          }}
        >
          <RefreshCw size={16} />
        </IconButton>
      </div>
      <section className="review-band">
        <div className="review-index">01 / 10 MARKS / 1:45</div>
        <h2>Model and GenAI justification</h2>
        <div className="review-two-col">
          <div>
            <h3>What generates content</h3>
            <p>
              Qwen2.5-1.5B-Instruct is a pretrained autoregressive Transformer. It generates a new
              English paraphrase from the source and prompt. Q4_K_M weights run locally through
              llama.cpp.
            </p>
            <p>
              ML: learned weights. DL: neural layers. NLP: English rewriting. Transformer: attention
              over input context. GenAI: token-by-token text generation.
            </p>
          </div>
          <div>
            <h3>Why this model</h3>
            <p>
              Small enough for local CPU inference, no paid API, and inspectable input/output. The
              application validates structured JSON and records the exact prompts and model timings.
            </p>
            <p>
              Pretrained inference is implemented. Model training and fine-tuning were not
              performed. No autonomous agent workflow is used.
            </p>
          </div>
        </div>
        <div className="review-feedback">
          <FileCheck2 size={18} />
          <p>
            <strong>Review 1 feedback</strong>Idea appreciated; no specific corrections requested.
            This is the team&apos;s report. Review 2 adds a working local GenAI stage and measured
            prompt experiments.
          </p>
        </div>
      </section>
      <section className="review-band">
        <div className="review-index">02 / 5 MARKS / 1:45</div>
        <h2>Pipeline, outputs and objectives</h2>
        <div className="review-pipeline">
          {[
            'English input',
            'Prompt + Transformer',
            'English paraphrase',
            'Preservation warnings',
            'ISL provider / ASL alphabet',
            '3D playback + evidence',
          ].map((s, i) => (
            <div key={s}>
              <span>0{i + 1}</span>
              <strong>{s}</strong>
              {i < 5 && <ArrowRight size={16} />}
            </div>
          ))}
        </div>
        <p className="review-limit">
          Every signing request requires English paraphrasing first (up to 5,000 input characters).
          ISL uses available assets or the configured motion model; unknown vocabulary blocks motion
          rather than substituting ASL. Local ISL output is experimental and unreviewed. The
          pipeline diagram was refined; model weights were not fine-tuned.
        </p>
        <div className="review-two-col">
          <div>
            <h3>Objective: preserve the message</h3>
            <p>
              Test campus questions, unfamiliar names, a paragraph, negation and numeric details.
              Record literal term retention, heuristic flags and latency. Meaning still requires
              human evaluation.
            </p>
          </div>
          <div>
            <h3>Implementation evidence</h3>
            <p>
              Live model requests, actual prompts/responses, persistent guest records, exportable
              JSON and the working avatar. The original unrestricted ISL objective remains
              incomplete.
            </p>
          </div>
        </div>
      </section>
      <section className="review-band">
        <div className="review-index">03 / 5 MARKS / 1:30</div>
        <h2>Prompt engineering in use</h2>
        <p>
          Compare a direct instruction, worked examples and explicit preservation rules on identical
          inputs, using identical inference settings.
        </p>
        {report ? (
          <>
            <div className="genai-comparison">
              <table>
                <thead>
                  <tr>
                    <th>Prompt</th>
                    <th>Successful runs</th>
                    <th>Mean generation time</th>
                    <th>Literal terms retained</th>
                    <th>Heuristic flags</th>
                  </tr>
                </thead>
                <tbody>
                  {report.summaries.map((s) => (
                    <tr key={s.strategy}>
                      <td>{s.strategy}</td>
                      <td>
                        {s.successfulRuns}/{s.totalRuns}
                      </td>
                      <td>{(s.meanLatencyMs / 1000).toFixed(1)}s</td>
                      <td>
                        {s.literalTermsFound}/{s.literalTermsTotal}
                      </td>
                      <td>{s.heuristicWarnings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="review-limit">{report.note}</p>
            <div className="genai-strategies" role="group" aria-label="Recorded prompt strategy">
              {report.summaries.map((s) => (
                <button
                  key={s.strategy}
                  aria-pressed={strategy === s.strategy}
                  onClick={() => setStrategy(s.strategy)}
                >
                  {s.strategy}
                </button>
              ))}
            </div>
            {report.samples
              .filter((s) => s.result?.strategy === strategy)
              .map((s) => (
                <details className="review-sample" key={s.scenarioId}>
                  <summary>
                    {s.scenarioId}
                    <Badge tone={s.missingTerms.length ? 'amber' : 'teal'}>
                      {s.requiredTerms.length - s.missingTerms.length}/{s.requiredTerms.length}{' '}
                      literal terms
                    </Badge>
                  </summary>
                  <p>
                    <strong>Source:</strong> {s.result?.sourceText}
                  </p>
                  <p>
                    <strong>Generated:</strong> {s.result?.paraphrase}
                  </p>
                  <p>
                    <strong>Objective:</strong> {s.objective}
                  </p>
                  <details className="genai-prompt">
                    <summary>Exact system prompt</summary>
                    <pre>{s.result?.prompt.system}</pre>
                  </details>
                </details>
              ))}
            <a
              className="button secondary"
              href="/api/review/evidence"
              download="signbridge-review-evidence.json"
            >
              <Download size={16} />
              Download actual evidence
            </a>
          </>
        ) : (
          <p className="review-limit">
            Run pnpm ai:evaluate while the app and model are online to create the report. No scores
            are shown until real inference has run.
          </p>
        )}
      </section>
      <section className="review-band">
        <div className="review-index">IMPLEMENTATION SCOPE</div>
        <h2>Progress against explicit milestones</h2>
        <div className="review-milestones">
          {milestones.map(([label, complete]) => (
            <div key={label}>
              <ShieldCheck size={16} />
              <span>{label}</span>
              <Badge tone={complete ? 'teal' : 'amber'}>
                {complete && (label !== 'Measured experiment report' || !!report)
                  ? 'IMPLEMENTED'
                  : 'OUTSTANDING'}
              </Badge>
            </div>
          ))}
        </div>
        <p className="review-limit">
          This checklist documents the scoped prototype. It is not proof that 70% of unrestricted
          ISL translation is complete; faculty must agree the review scope. All team members must
          attend. The three content slides total 5:00.
        </p>
        <Link className="button secondary" href="/studio">
          <FlaskConical size={16} />
          Open avatar studio
          <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
}
