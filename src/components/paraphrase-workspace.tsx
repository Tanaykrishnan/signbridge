'use client';
import { WorkspaceHeading } from './workspace-heading';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Download,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Square,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import { request, useApp, useRemote } from './providers';
import { IconButton, Badge } from './ui';
import { RequestGuard } from '@/lib/request-guard';
import {
  PARAPHRASE_LIMIT,
  PROMPT_STRATEGIES,
  type ParaphraseResult,
  type ParaphraseStatus,
  type PromptStrategy,
} from '@/lib/paraphrase-schema';
import { REVIEW_SCENARIOS } from '@/lib/review-scenarios';
import './paraphrase.css';

function download(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ParaphrasePanel({
  text,
  onApply,
  compact = false,
}: {
  text: string;
  onApply?: (text: string) => void;
  compact?: boolean;
}) {
  const [strategy, setStrategy] = useState<PromptStrategy>('constrained');
  const [results, setResults] = useState<ParaphraseResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('');
  const [guard] = useState(() => new RequestGuard());
  const status = useRemote<ParaphraseStatus>('/api/paraphrase/status');
  const history = useRemote<{ items: ParaphraseResult[] }>('/api/paraphrase');
  const { notify, preferences } = useApp();
  useEffect(() => {
    guard.invalidate();
    setResults([]);
    setBusy(false);
    setError('');
  }, [text, guard]);
  useEffect(() => () => guard.invalidate(), [guard]);
  async function generate(compare = false) {
    const task = guard.start();
    setBusy(true);
    setError('');
    setResults([]);
    const modes = compare ? PROMPT_STRATEGIES.map((s) => s.id) : [strategy];
    try {
      for (const mode of modes) {
        if (!task.isCurrent()) return;
        setPhase(PROMPT_STRATEGIES.find((s) => s.id === mode)?.label || mode);
        const result = await request<ParaphraseResult>('/api/paraphrase', {
          method: 'POST',
          signal: task.signal,
          body: JSON.stringify({ text, strategy: mode }),
        });
        if (!task.isCurrent()) return;
        setResults((previous) => [...previous, result]);
        if (result.persistence === 'not-saved')
          notify('Generated successfully, but the local record could not be saved.', true);
      }
      history.reload();
      status.reload();
    } catch (e) {
      if (task.isCurrent() && (e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (task.isCurrent()) setBusy(false);
    }
  }
  function cancel() {
    guard.invalidate();
    setBusy(false);
    setPhase('');
    history.reload();
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Generated text copied.');
    } catch {
      notify('Clipboard access is unavailable.', true);
    }
  }
  const ready = status.data?.state === 'ready';
  return (
    <section
      className={`paraphrase-panel ${compact ? 'compact' : ''}`}
      aria-label="English paraphrasing"
    >
      <div className="genai-section-heading">
        <div>
          <BrainCircuit size={19} />
          <strong>{compact ? 'English paraphrasing' : 'Generation workspace'}</strong>
        </div>
        <Badge tone={ready ? 'teal' : 'amber'}>
          {status.loading ? 'CHECKING MODEL' : ready ? 'LOCAL MODEL ONLINE' : 'MODEL OFFLINE'}
        </Badge>
      </div>
      {!ready && (
        <div className="genai-model-message">
          <p>{status.data?.message || status.error || 'Checking the language model.'}</p>
          <IconButton label="Refresh model status" onClick={status.reload}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
      )}
      <div className="genai-strategies" role="group" aria-label="Prompt strategy">
        {PROMPT_STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={strategy === s.id}
            onClick={() => setStrategy(s.id)}
            disabled={busy}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="genai-actions">
        <button
          className="button primary"
          onClick={() => generate()}
          disabled={!text.trim() || busy || !ready}
        >
          <WandSparkles size={17} />
          {busy ? (
            <>
              <LoaderCircle size={16} className="spin" /> Generating: {phase}
            </>
          ) : (
            'Paraphrase English'
          )}
        </button>
        {busy ? (
          <IconButton label="Cancel generation" onClick={cancel}>
            <Square size={17} />
          </IconButton>
        ) : (
          !compact && (
            <button
              className="button secondary"
              onClick={() => generate(true)}
              disabled={!text.trim() || !ready}
            >
              <FlaskConical size={16} />
              Compare prompts
            </button>
          )
        )}
      </div>
      <p className="genai-boundary">English output. Check meaning before using it for signing.</p>
      {error && (
        <div className="genai-error" role="alert">
          <TriangleAlert size={18} />
          {error}
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {busy
          ? 'Generating English paraphrase.'
          : results.length
            ? `${results.length} real model response${results.length > 1 ? 's' : ''} available.`
            : error}
      </div>
      {!results.length && !busy && !compact && (
        <div className="genai-empty">
          <WandSparkles size={32} />
          <h2>A clearer version of your words.</h2>
          <p>Names, questions and details deserve to stay intact.</p>
        </div>
      )}
      {busy && !results.length && (
        <div className="genai-generating" role="status">
          <div className="genai-loading-line" />
          <p>Running local inference. Longer paragraphs take more time.</p>
        </div>
      )}
      <div className="genai-results">
        {results.map((result) => (
          <motion.article
            key={result.id}
            className="genai-result"
            initial={preferences.reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="genai-result-heading">
              <Badge tone="teal">
                {PROMPT_STRATEGIES.find((s) => s.id === result.strategy)?.label}
              </Badge>
              <span>
                {(result.metrics.latencyMs / 1000).toFixed(1)}s · {result.metrics.outputWords} words
              </span>
            </div>
            <p className="genai-output">{result.paraphrase}</p>
            <div className="genai-result-tools">
              <IconButton label="Copy paraphrase" onClick={() => copy(result.paraphrase)}>
                <Clipboard size={16} />
              </IconButton>
              <IconButton
                label="Download generation evidence"
                onClick={() =>
                  download(result, `signbridge-${result.strategy}-${result.id.slice(0, 8)}.json`)
                }
              >
                <Download size={16} />
              </IconButton>
              {onApply ? (
                <button
                  className="button secondary"
                  onClick={() => onApply(result.paraphrase)}
                  disabled={result.paraphrase.length > PARAPHRASE_LIMIT}
                >
                  Use as source <ArrowRight size={15} />
                </button>
              ) : (
                <Link
                  className="button secondary"
                  href={`/studio?text=${encodeURIComponent(result.paraphrase)}`}
                >
                  Open in studio <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
            <details className="genai-checks">
              <summary>
                <ShieldCheck size={15} />
                {result.checks.filter((c) => c.status === 'warning').length
                  ? 'Review flags detected'
                  : 'Inspect preservation checks'}
                <span>Heuristics only</span>
              </summary>
              <ul>
                {result.checks.map((check) => (
                  <li key={check.label}>
                    {check.status === 'warning' ? (
                      <TriangleAlert size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <div>
                      <strong>{check.label}</strong>
                      <p>{check.detail}</p>
                    </div>
                    <span>{check.status}</span>
                  </li>
                ))}
              </ul>
              <p>Passing these checks does not prove semantic equivalence or ISL accuracy.</p>
            </details>
            <details className="genai-prompt">
              <summary>Actual prompt & model evidence</summary>
              <dl>
                <div>
                  <dt>Model</dt>
                  <dd>{result.model.id}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{new Date(result.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>
                    {result.persistence === 'saved-local'
                      ? 'Saved locally to this guest workspace'
                      : 'Not saved'}
                  </dd>
                </div>
                <div>
                  <dt>Tokens</dt>
                  <dd>
                    {result.metrics.promptTokens ?? 'Unknown'} input /{' '}
                    {result.metrics.completionTokens ?? 'Unknown'} output
                  </dd>
                </div>
              </dl>
              <pre>{result.prompt.system + '\n\n' + result.prompt.user}</pre>
            </details>
          </motion.article>
        ))}
      </div>
      {results.length > 1 && (
        <div className="genai-comparison">
          <div className="genai-section-heading">
            <strong>Same input. Different prompts.</strong>
            <IconButton
              label="Download prompt comparison"
              onClick={() =>
                download(
                  {
                    sourceText: text,
                    results,
                    note: 'Actual model responses. Heuristic flags are not semantic accuracy.',
                  },
                  'signbridge-prompt-comparison.json',
                )
              }
            >
              <Download size={16} />
            </IconButton>
          </div>
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Time</th>
                <th>Words</th>
                <th>Review flags</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{PROMPT_STRATEGIES.find((s) => s.id === r.strategy)?.label}</td>
                  <td>{(r.metrics.latencyMs / 1000).toFixed(1)}s</td>
                  <td>
                    {r.metrics.inputWords} → {r.metrics.outputWords}
                  </td>
                  <td>{r.checks.filter((c) => c.status === 'warning').length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && (
        <details className="genai-history">
          <summary>
            Recorded generations <span>{history.data?.items.length ?? 0}</span>
          </summary>
          {history.error && <p role="alert">{history.error}</p>}
          {history.data?.items.length ? (
            history.data.items.slice(0, 12).map((r) => (
              <button
                key={r.id}
                className="genai-history-item"
                aria-label="Download recorded generation"
                onClick={() => download(r, `signbridge-record-${r.id}.json`)}
              >
                <span>{r.paraphrase.slice(0, 100)}</span>
                <small>
                  {r.strategy} · {new Date(r.createdAt).toLocaleTimeString()}
                </small>
                <Download size={15} />
              </button>
            ))
          ) : (
            <p>No recorded generations in this guest workspace yet.</p>
          )}
          <p>Last 50 results persist locally. Single-server development storage.</p>
        </details>
      )}
    </section>
  );
}
export function ParaphraseWorkspace() {
  const [text, setText] = useState<string>(REVIEW_SCENARIOS[0].text);
  return (
    <div className="genai-workspace">
      <WorkspaceHeading
        eyebrow="SIGNBRIDGE / LANGUAGE LAB"
        title="Clarity before motion"
        description="English paraphrasing powered by a local language model."
      >
        <Link href="/review" className="button secondary">
          <FlaskConical size={16} />
          Review evidence
          <ArrowUpRight size={15} />
        </Link>
      </WorkspaceHeading>
      <div className="genai-layout">
        <section className="genai-editor" aria-label="Paraphrasing source">
          <div className="genai-section-heading">
            <strong>Source text</strong>
            <Badge>ENGLISH</Badge>
          </div>
          <label htmlFor="paraphrase-source" className="sr-only">
            English text to paraphrase
          </label>
          <textarea
            id="paraphrase-source"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={PARAPHRASE_LIMIT}
            placeholder="A sentence, a question, or a whole paragraph..."
          />
          <div className="genai-editor-footer">
            <span>{text.length.toLocaleString()} / 5,000</span>
            <IconButton
              label="Clear paraphrasing text"
              onClick={() => setText('')}
              disabled={!text}
            >
              <RefreshCw size={16} />
            </IconButton>
          </div>
          <div className="genai-scenarios">
            <span className="eyebrow">REVIEW SCENARIOS</span>
            {REVIEW_SCENARIOS.map((s, i) => (
              <button key={s.id} onClick={() => setText(s.text)}>
                <span>0{i + 1}</span>
                {s.label}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="genai-objective">
            <BrainCircuit size={18} />
            <p>
              Generate clearer English while preserving the message. ISL motion generation remains a
              separate research stage.
            </p>
          </div>
        </section>
        <ParaphrasePanel text={text} />
      </div>
    </div>
  );
}
