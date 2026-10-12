'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ClipboardPaste,
  X,
  Languages,
  Copy,
  BookmarkPlus,
  Info,
  BookOpen,
  LoaderCircle,
  FileText,
  Check,
  ArrowUpRight,
  FlaskConical,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Play,
  BrainCircuit,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import type { Manifest, Translation } from '@/lib/schemas';
import type { IslCapabilities } from '@/lib/isl-motion-schema';
import { RequestGuard } from '@/lib/request-guard';
import { MAX_TEXT_LENGTH } from '@/lib/asl-alphabet';
import { request, useApp, useRemote } from './providers';
import { Viewer } from './viewer';
import { IconButton, Badge, ErrorState, Loading } from './ui';
import type { ParaphraseStatus } from '@/lib/paraphrase-schema';

const emptySequence: Translation['sequence'] = [];
export function Translator({
  initialMode = 'translation',
  initialText = '',
  reviewedOnly = false,
}: {
  initialMode?: 'translation' | 'lab' | 'fingerspelling';
  initialText?: string;
  reviewedOnly?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<Translation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedPhraseId, setSavedPhraseId] = useState<string | null>(null);
  const [mode, setMode] = useState(initialMode);
  const [demo, setDemo] = useState('demo-open');
  const [allowReferencePreview, setAllowReferencePreview] = useState(!reviewedOnly);
  const [modelOptIn, setAllowUnreviewedModel] = useState<boolean | null>(null);
  const [guard] = useState(() => new RequestGuard());
  const { notify, preferences } = useApp();
  const manifest = useRemote<Manifest>('/api/assets');
  const capabilities = useRemote<IslCapabilities>('/api/capabilities');
  const paraphraseStatus = useRemote<ParaphraseStatus>('/api/paraphrase/status');
  const modelConfigured = capabilities.data?.model.state === 'configured';
  const isLocalResearch = capabilities.data?.model.engine === 'local-sign-vqvae';
  const allowUnreviewedModel = modelOptIn ?? (isLocalResearch && modelConfigured && !reviewedOnly);
  useEffect(() => {
    const englishOffline = paraphraseStatus.data && paraphraseStatus.data.state !== 'ready';
    const islStarting = isLocalResearch && capabilities.data?.model.state === 'misconfigured';
    if (!englishOffline && !islStarting) return;
    // Local models may finish loading after Next.js starts serving the studio.
    const timer = setInterval(() => {
      if (englishOffline) paraphraseStatus.reload();
      if (islStarting) capabilities.reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [paraphraseStatus, capabilities, isLocalResearch]);
  const spellingManifest = useMemo(
    () =>
      manifest.data
        ? {
            ...manifest.data,
            avatar: {
              ...manifest.data.avatar,
              url: null,
              name: 'Original SignBridge articulated rig',
            },
          }
        : null,
    [manifest.data],
  );
  const demos = useMemo(
    () => manifest.data?.signs.filter((s) => s.review === 'illustrative' && s.available) || [],
    [manifest.data],
  );
  const demoSequence = useMemo(() => {
    const selected = demos.find((s) => s.id === demo);
    const rest = demos.find((s) => s.id === 'demo-rest');
    return selected ? [selected, ...(rest && selected !== rest ? [rest] : [])] : emptySequence;
  }, [demo, demos]);
  useEffect(() => () => guard.invalidate(), [guard]);
  function editText(next: string) {
    guard.invalidate();
    setText(next);
    setResult(null);
    setBusy(false);
    setSavedPhraseId(null);
    setError('');
  }
  function changeMode(next: 'translation' | 'lab' | 'fingerspelling') {
    guard.invalidate();
    setBusy(false);
    setError('');
    setResult(null);
    setSavedPhraseId(null);
    setMode(next);
  }
  async function translate() {
    const task = guard.start();
    const sourceText = text;
    setBusy(true);
    setError('');
    setSavedPhraseId(null);
    setResult(null);
    try {
      const r = await request<Translation>('/api/translate', {
        method: 'POST',
        signal: task.signal,
        body: JSON.stringify({
          text: sourceText,
          language: 'en',
          outputMode: mode === 'fingerspelling' ? 'asl-fingerspelling' : 'isl',
          allowReferencePreview: mode === 'translation' && allowReferencePreview,
          allowUnreviewedModel: mode === 'translation' && allowUnreviewedModel,
        }),
      });
      if (!task.isCurrent()) return;
      setResult(r);
      setBusy(false);
      try {
        await request('/api/history', {
          method: 'POST',
          body: JSON.stringify({
            text: sourceText,
            language: 'en',
            outputMode: mode === 'fingerspelling' ? 'asl-fingerspelling' : 'isl',
            allowReferencePreview: mode === 'translation' && allowReferencePreview,
            allowUnreviewedModel: mode === 'translation' && allowUnreviewedModel,
            historyReceipt: r.historyReceipt,
          }),
        });
      } catch (e) {
        if (task.isCurrent())
          notify('Result processed, but history was not saved: ' + (e as Error).message, true);
      }
    } catch (e) {
      if (task.isCurrent() && (e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (task.isCurrent()) setBusy(false);
    }
  }
  async function paste() {
    try {
      const clipboard = await navigator.clipboard.readText();
      editText(clipboard.slice(0, MAX_TEXT_LENGTH));
      if (clipboard.length > MAX_TEXT_LENGTH)
        notify('Pasted the first 5,000 characters. Split longer documents into sections.');
    } catch {
      notify(
        'Clipboard permission was denied. Paste into the text field with your keyboard.',
        true,
      );
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.originalSourceText || text);
      notify('Source text copied.');
    } catch {
      notify('Clipboard access is unavailable.', true);
    }
  }
  async function save() {
    if (!result?.phrase) return;
    const phraseId = result.phrase.id;
    try {
      await request('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ phraseId }),
      });
      setSavedPhraseId(phraseId);
      notify('Phrase saved to your guest workspace.');
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const isLab = mode === 'lab';
  const isSpelling = mode === 'fingerspelling';
  const isAslOutput = isSpelling;
  const isReferencePreview = result?.rendering === 'isl-reference-preview';
  const isModelMotion = result?.rendering === 'isl-model-motion';
  const saved = result?.phrase?.id === savedPhraseId;
  const hasReviewedAssets = manifest.data?.signs.some(
    (s) => s.available && s.review === 'reviewed',
  );
  const blockedMessage = busy
    ? 'Paraphrasing English and preparing output'
    : result
      ? result.playback === 'ready'
        ? undefined
        : result.blockReason
          ? {
              'model-not-configured': 'ISL generation model not installed',
              'model-unavailable': 'ISL model unavailable',
              'model-output-invalid': 'ISL motion validation failed',
              'model-review-required': 'ISL model review required',
              'model-vocabulary-unavailable': 'Some vocabulary is unavailable',
              'model-input-unsupported': 'ISL input needs adjustment',
            }[result.blockReason]
          : result.playback === 'unsupported'
            ? isSpelling
              ? 'No supported English characters'
              : 'No matching phrase'
            : 'Reviewed animation unavailable'
      : text
        ? 'New result required'
        : isSpelling
          ? 'No text converted'
          : 'No phrase selected';
  return (
    <div className="studio-experience" data-mode={mode} data-processing={busy}>
      <div className="page-heading studio-heading">
        <div>
          <div className="eyebrow studio-eyebrow">
            <span aria-hidden="true" /> SIGNBRIDGE / WORKSPACE 01
          </div>
          <h1>
            {isLab ? 'Motion ' : 'Translation '}
            <span className="studio-title-word">{isLab ? 'lab' : 'studio'}</span>
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {isLab
              ? 'Engineering previews. Not sign-language translations.'
              : isSpelling
                ? 'English paraphrasing, followed by ASL fingerspelling.'
                : 'English paraphrasing, followed by available ISL motion.'}
          </p>
        </div>
        <div className="studio-heading-actions">
          <span className="studio-edition" aria-hidden="true">
            LANGUAGE IN MOTION
            <br />
            SIGNBRIDGE / STUDIO
          </span>
          <Link href="/library" className="button secondary">
            <BookOpen size={16} />
            Phrase library
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="studio-modebar">
        <div className="studio-modes" role="group" aria-label="Studio mode">
          {(
            [
              { id: 'translation', label: 'ISL translation', Icon: Languages },
              { id: 'fingerspelling', label: 'ASL fingerspelling', Icon: Languages },
              { id: 'lab', label: 'Motion lab', Icon: FlaskConical },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => changeMode(id)}
            >
              {mode === id && (
                <motion.span
                  className="mode-highlight"
                  layoutId="studio-mode"
                  transition={{ duration: preferences.reducedMotion ? 0 : 0.24 }}
                />
              )}
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className={`mode-status ${isLab ? 'lab' : ''}`}>
          <span />
          {isLab
            ? 'DEMO MOTION ONLY'
            : isSpelling
              ? 'ASL ALPHABET / BETA'
              : modelConfigured
                ? 'ISL MODEL / PROVIDER CONFIGURED'
                : allowReferencePreview
                  ? 'ISL REFERENCE PREVIEWS / BETA'
                  : 'REVIEWED ASSETS ONLY'}
        </span>
      </div>
      <div className="studio-pipeline" aria-label="Translation processing stages">
        {[
          {
            label: isLab ? 'Choose a motion' : 'Compose',
            Icon: FileText,
            state: isLab || text ? 'complete' : 'current',
          },
          {
            label: isLab ? 'Original clip' : 'English paraphrase',
            Icon: isLab ? ScanLine : BrainCircuit,
            state: busy
              ? 'working'
              : result?.paraphrase || isLab
                ? 'complete'
                : result
                  ? 'blocked'
                  : 'waiting',
          },
          {
            label: isLab
              ? 'Unreviewed demo'
              : isAslOutput
                ? 'Alphabet mapping'
                : isReferencePreview
                  ? 'Review pending'
                  : 'ISL motion mapping',
            Icon: ShieldCheck,
            state:
              isLab || isReferencePreview || (result && result.playback !== 'ready')
                ? 'blocked'
                : result
                  ? 'complete'
                  : 'waiting',
          },
          {
            label: isLab ? 'Preview' : 'Playback',
            Icon: Play,
            state: isLab || result?.playback === 'ready' ? 'current' : 'waiting',
          },
        ].map(({ label, Icon, state }, i) => (
          <div key={i} className={`pipeline-step ${state}`}>
            <span className="pipeline-index">0{i + 1}</span>
            <Icon size={15} aria-hidden="true" />
            <span>{label}</span>
            {i < 3 && <ArrowRight size={13} className="pipeline-arrow" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className={`studio-grid ${isLab ? 'lab-mode' : ''}`}>
        <section
          className="input-workspace"
          aria-label={isLab ? 'Motion selection' : 'Text input workspace'}
        >
          {isLab ? (
            <motion.div
              className="motion-library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="section-bar">
                <span>
                  <FlaskConical size={17} />
                  Motion collection
                </span>
                <Badge tone="amber">TEST RIG</Badge>
              </div>
              <div className="motion-options" role="group" aria-label="Demo motions">
                {demos.map((s, index) => (
                  <motion.button
                    key={s.id}
                    className="motion-option"
                    aria-pressed={demo === s.id}
                    onClick={() => setDemo(s.id)}
                    initial={preferences.reducedMotion ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: preferences.reducedMotion ? 0 : 0.35,
                      delay: preferences.reducedMotion ? 0 : index * 0.06,
                    }}
                  >
                    <span className="motion-number">0{index + 1}</span>
                    <span>
                      <strong>{s.label}</strong>
                      <small>{s.duration.toFixed(1)}s / Original procedural clip</small>
                    </span>
                    <ArrowUpRight size={18} />
                  </motion.button>
                ))}
              </div>
              <div className="demo-note">
                <Info size={18} />
                <p>
                  <strong>Not an ISL translation</strong>These original rig exercises are
                  independent of any source text. They test animation, timing, and camera controls
                  only.
                </p>
              </div>
              <dl className="lab-facts">
                <div>
                  <dt>Source</dt>
                  <dd>Original procedural animation</dd>
                </div>
                <div>
                  <dt>Linguistic review</dt>
                  <dd>None</dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd>Project MIT</dd>
                </div>
              </dl>
            </motion.div>
          ) : (
            <>
              <div className="studio-source-pane studio-tool-pane" id="studio-panel-source">
                <div className="section-bar">
                  <span>
                    <FileText size={17} />
                    Source text
                  </span>
                  <Badge>ENGLISH</Badge>
                </div>
                <div className="source-field">
                  <div className="input-tools">
                    <label className="language-label">
                      Input language
                      <select aria-label="Input language" defaultValue="en">
                        <option value="en">English</option>
                        <option value="hi" disabled>
                          Hindi - not configured
                        </option>
                      </select>
                    </label>
                    <div className="flex">
                      <IconButton label="Paste text" onClick={paste}>
                        <ClipboardPaste size={17} />
                      </IconButton>
                      <IconButton label="Clear text" disabled={!text} onClick={() => editText('')}>
                        <X size={17} />
                      </IconButton>
                    </div>
                  </div>
                  <label className="sr-only" htmlFor="source-text">
                    Text to translate
                  </label>
                  <textarea
                    id="source-text"
                    value={text}
                    maxLength={MAX_TEXT_LENGTH}
                    onChange={(e) => editText(e.target.value)}
                    placeholder={
                      isSpelling
                        ? 'Enter a sentence, a name, or a whole paragraph...'
                        : 'Enter English text, a name, or a paragraph...'
                    }
                    aria-describedby="studio-output-boundary studio-paraphrase-caption"
                  />
                  <div className="field-bottom">
                    <span>
                      {isSpelling
                        ? 'English → ASL fingerspelling'
                        : 'English → Indian Sign Language'}
                    </span>
                    <span>
                      {text.length} / {MAX_TEXT_LENGTH.toLocaleString('en')}
                    </span>
                  </div>
                </div>
                <section
                  className="studio-paraphrase-preview"
                  aria-label="Paraphrased English preview"
                >
                  <div className="section-bar">
                    <span>
                      <BrainCircuit size={17} /> Paraphrased English
                    </span>
                    <IconButton
                      label="Copy paraphrased English"
                      disabled={!result?.paraphrase}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(result!.paraphrase!.paraphrase);
                          notify('Paraphrased English copied.');
                        } catch {
                          notify('Clipboard access is unavailable.', true);
                        }
                      }}
                    >
                      <Copy size={16} />
                    </IconButton>
                  </div>
                  <p
                    className={`studio-paraphrase-sentence ${result?.paraphrase ? '' : 'pending'}`}
                    aria-live="polite"
                    aria-atomic="true"
                    tabIndex={result?.paraphrase ? 0 : undefined}
                  >
                    {result?.paraphrase?.paraphrase ||
                      (busy
                        ? 'Paraphrasing and preparing signing output...'
                        : error
                          ? 'No accepted paraphrase.'
                          : 'Not generated yet.')}
                  </p>
                  <p id="studio-paraphrase-caption" className="studio-paraphrase-caption">
                    {result?.paraphrase
                      ? `${isSpelling ? 'ASL alphabet' : 'ISL model'} input · compare with your original`
                      : 'English model output'}
                  </p>
                  {result?.generatedMotion?.lexicalMappings?.length ? (
                    <div className="studio-coverage-note">
                      <strong>Contextual motion mapping · unreviewed</strong>
                      <p>
                        {[
                          ...new Set(
                            result.generatedMotion.lexicalMappings.map(
                              (m) => `${m.source} → ${m.target}`,
                            ),
                          ),
                        ].join(', ')}
                        . Existing dataset motions; meaning and ISL grammar still require expert
                        review.
                      </p>
                    </div>
                  ) : null}
                  {result?.unsupportedWords?.length ? (
                    <div className="studio-coverage-note" role="status">
                      <strong>
                        Missing ISL vocabulary: {result.unsupportedWords.slice(0, 20).join(', ')}
                        {result.unsupportedWords.length > 20
                          ? ` (+${result.unsupportedWords.length - 20} more)`
                          : ''}
                      </strong>
                      <p>
                        No suitable motion mapping was found for these words. Nothing was discarded
                        or fingerspelled. Missing entries require licensed ISL motion assets and
                        expert-reviewed mappings; ambiguous words also need the correct sense.
                      </p>
                    </div>
                  ) : result?.blockReason === 'model-input-unsupported' ? (
                    <div className="studio-coverage-note" role="status">
                      <p>{result.message}</p>
                    </div>
                  ) : null}
                </section>
                <div className="examples">
                  <span className="eyebrow">{isSpelling ? 'TRY AN INPUT' : 'SAMPLE PHRASES'}</span>
                  <div>
                    {(isSpelling
                      ? [
                          'Hello',
                          'Kattankulathur',
                          'What time does the SRM Central Library close today?',
                        ]
                      : ['Hello', 'Thank you', 'Good morning']
                    ).map((p) => (
                      <button key={p} className="example-button" onClick={() => editText(p)}>
                        {p}
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="studio-action-dock">
                <div className="signing-model-status" role="status">
                  <BrainCircuit size={16} aria-hidden="true" />
                  <span>
                    {paraphraseStatus.data?.state === 'ready'
                      ? 'English model online · paraphrasing required'
                      : paraphraseStatus.loading
                        ? 'Checking English model...'
                        : 'English model unavailable · signing paused'}
                  </span>
                  <IconButton
                    label="Refresh model status"
                    onClick={() => {
                      paraphraseStatus.reload();
                      capabilities.reload();
                    }}
                  >
                    <RefreshCw size={16} />
                  </IconButton>
                </div>
                {paraphraseStatus.data && paraphraseStatus.data.state !== 'ready' && (
                  <p className="inline-error" role="alert">
                    Start the local services with <code>pnpm dev:full</code>, then refresh model
                    status. No conversion runs without paraphrasing.
                  </p>
                )}
                {paraphraseStatus.error && (
                  <ErrorState message={paraphraseStatus.error} retry={paraphraseStatus.reload} />
                )}
                <motion.button
                  whileTap={preferences.reducedMotion ? undefined : { scale: 0.98 }}
                  className="button primary translate-button"
                  onClick={translate}
                  disabled={
                    !text.trim() ||
                    busy ||
                    paraphraseStatus.loading ||
                    paraphraseStatus.data?.state !== 'ready' ||
                    (!isSpelling && capabilities.loading)
                  }
                  aria-busy={busy}
                >
                  {busy ? <LoaderCircle size={18} className="spin" /> : <Languages size={18} />}
                  {busy
                    ? 'Paraphrasing & processing...'
                    : isSpelling
                      ? 'Paraphrase & spell'
                      : 'Paraphrase & translate'}
                  <ArrowRight size={18} />
                </motion.button>
                {error && (
                  <p className="inline-error" role="alert">
                    {error}
                  </p>
                )}
                <p className="studio-boundary" id="studio-output-boundary">
                  <LockKeyhole size={14} />
                  <span>
                    {isSpelling
                      ? 'ASL alphabet · unreviewed. Not sentence translation.'
                      : modelConfigured
                        ? isLocalResearch
                          ? 'Local ISL research output · unreviewed. Not certified interpretation.'
                          : 'ISL model output requires expert review.'
                        : 'Unreviewed ISL previews only. Sentence generation unavailable.'}
                  </span>
                </p>
                <details className="studio-output-details">
                  <summary>
                    <SlidersHorizontal size={15} />
                    {isSpelling ? 'Alphabet & asset details' : 'Output settings & asset details'}
                    <ChevronDown size={15} />
                  </summary>
                  <div className="studio-output-content" tabIndex={0}>
                    {!isSpelling && (
                      <fieldset className="isl-options">
                        <legend>ISL output options</legend>
                        <label>
                          <input
                            type="checkbox"
                            checked={allowReferencePreview}
                            onChange={(e) => {
                              editText(text);
                              setAllowReferencePreview(e.target.checked);
                            }}
                          />
                          Reference animation previews (unreviewed)
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={allowUnreviewedModel}
                            disabled={!modelConfigured}
                            onChange={(e) => {
                              editText(text);
                              setAllowUnreviewedModel(e.target.checked);
                            }}
                          />
                          Unreviewed model output
                        </label>
                      </fieldset>
                    )}
                    <div className="demo-note" id="translation-note">
                      <LockKeyhole size={17} />
                      <p>
                        <strong>
                          {isSpelling
                            ? 'ASL fingerspelling · awaiting review'
                            : modelConfigured
                              ? isLocalResearch
                                ? 'Local ISL research decoder'
                                : 'ISL model endpoint configured'
                              : allowReferencePreview
                                ? 'ISL reference previews · review pending'
                                : hasReviewedAssets
                                  ? 'Reviewed asset playback'
                                  : 'Reviewed ISL assets not installed'}
                        </strong>
                        {isSpelling
                          ? 'Spells English letters with original hand animations. J and Z include movement. This is not ISL or ASL sentence translation; an ASL expert must validate the rendered shapes before public reliance.'
                          : modelConfigured
                            ? isLocalResearch
                              ? 'A trained SignVQVAE decoder reconstructs available ISL sign motions from an experimental English gloss plan. This is not validated sentence translation. Unknown vocabulary blocks output; no ASL or alphabet fallback. Local research only, not cleared for commercial deployment.'
                              : 'The complete text is sent to your configured ISL motion model. Availability, output format, and full-input coverage are checked per request. Linguistic accuracy requires independent expert evaluation.'
                            : allowReferencePreview
                              ? 'Seven complete greeting phrases have unreviewed reference motions. Sentence generation requires an available ISL model with matching vocabulary. ISL mode never substitutes ASL or invents signs.'
                              : hasReviewedAssets
                                ? 'Only complete, reviewed phrase mappings can play. Unknown text never receives a substitute motion.'
                                : 'Sample text can be matched, but it cannot be signed yet. Generic motions are available separately in Motion lab.'}
                      </p>
                    </div>
                    {!isSpelling && capabilities.error && (
                      <ErrorState message={capabilities.error} retry={capabilities.reload} />
                    )}
                    {!isSpelling && capabilities.data && (
                      <p className="model-capability-note" role="status">
                        {capabilities.data.model.message}
                      </p>
                    )}
                    <div className="input-meta">
                      <span>
                        <span className="status-dot" />
                        {isSpelling || !modelConfigured
                          ? 'Local assets only'
                          : 'Configured model service'}
                      </span>
                      <Link href="/about">
                        Asset provenance
                        <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>
                </details>
              </div>
            </>
          )}
        </section>
        <section className="avatar-workspace" aria-label="Avatar workspace">
          {manifest.error ? (
            <ErrorState message={manifest.error} retry={manifest.reload} />
          ) : manifest.data ? (
            <Viewer
              presentation="studio"
              sequence={isLab ? demoSequence : result?.sequence || emptySequence}
              manifest={
                isAslOutput || isReferencePreview || isModelMotion
                  ? spellingManifest!
                  : manifest.data
              }
              fingerspelling={isAslOutput}
              islPreview={isReferencePreview || isModelMotion}
              generatedMotion={result?.generatedMotion}
              sourceText={result?.sourceText || ''}
              contextLabel={
                isLab
                  ? 'Motion lab / not ISL'
                  : isAslOutput
                    ? 'ASL fingerspelling / left hand'
                    : isModelMotion
                      ? 'ISL model-generated motion / provider evidence'
                      : isReferencePreview
                        ? 'ISL reference preview / unreviewed'
                        : result?.phrase?.text || 'ISL translation'
              }
              emptyMessage={isLab ? 'No demo clip available' : blockedMessage}
            />
          ) : (
            <Loading label="Loading avatar registry" />
          )}
        </section>
        {!isLab && (
          <section className="result-panel" aria-label="Translation result" tabIndex={0}>
            <div className="section-bar">
              <span>
                <Languages size={17} />
                {isSpelling ? 'Text conversion' : 'ISL result'}
              </span>
              {result && (
                <div className="flex gap-2">
                  <IconButton label="Copy source text" onClick={copy}>
                    <Copy size={16} />
                  </IconButton>
                  <button
                    className="button small secondary"
                    disabled={!result.phrase || saved}
                    onClick={save}
                  >
                    {saved ? <Check size={15} /> : <BookmarkPlus size={15} />}
                    {saved ? 'Saved' : 'Save phrase'}
                  </button>
                </div>
              )}
            </div>
            {busy ? (
              <Loading label="Paraphrasing English, then preparing signing output" />
            ) : result ? (
              <motion.div
                className="result-content"
                role="status"
                key={result.sourceText}
                initial={{ opacity: 0, y: preferences.reducedMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div>
                  {result.paraphrase && (
                    <section className="signing-paraphrase" aria-label="English paraphrase result">
                      <div className="section-bar">
                        <span>
                          <BrainCircuit size={17} /> English used for signing
                        </span>
                        <Badge>GENERATED FIRST</Badge>
                      </div>
                      <p className="signing-paraphrase-text">{result.paraphrase.paraphrase}</p>
                      <p className="signing-paraphrase-note">
                        Check the meaning against your original. This is English, not an ISL gloss.
                      </p>
                      <details>
                        <summary>Original text, checks & model evidence</summary>
                        <p>
                          <strong>Original:</strong> {result.originalSourceText}
                        </p>
                        <p>
                          {result.paraphrase.model.id} ·{' '}
                          {(result.paraphrase.metrics.latencyMs / 1000).toFixed(1)}s ·{' '}
                          {result.paraphrase.strategy} · {result.paraphrase.prompt.version}
                        </p>
                        <ul>
                          {result.paraphrase.checks.map((c) => (
                            <li key={c.label}>
                              {c.label}: {c.status} · {c.detail}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Heuristic checks only. Semantic review required. Evidence{' '}
                          {result.paraphrase.persistence === 'saved-local'
                            ? 'saved locally'
                            : 'not saved'}
                          .
                        </p>
                        <details>
                          <summary>Actual prompt</summary>
                          <pre>{result.paraphrase.prompt.system}</pre>
                          <pre>{result.paraphrase.prompt.user}</pre>
                        </details>
                      </details>
                    </section>
                  )}
                  <Badge tone={result.playback === 'ready' ? 'teal' : 'amber'}>
                    {result.blockReason
                      ? result.blockReason === 'model-review-required'
                        ? 'MODEL REVIEW REQUIRED'
                        : 'ISL GENERATION UNAVAILABLE'
                      : result.status === 'unsupported'
                        ? 'NO MATCH'
                        : result.playback === 'ready'
                          ? isModelMotion
                            ? 'ISL MODEL OUTPUT'
                            : isReferencePreview
                              ? 'ISL REFERENCE PREVIEW'
                              : isAslOutput
                                ? 'READY TO SPELL'
                                : 'READY TO SIGN'
                          : 'ANIMATION UNAVAILABLE'}
                  </Badge>
                  <h2>
                    {result.blockReason
                      ? blockedMessage
                      : result.status === 'unsupported'
                        ? isSpelling
                          ? 'No supported letters found'
                          : 'Phrase not supported'
                        : isAslOutput
                          ? 'ASL fingerspelling ready'
                          : isModelMotion
                            ? 'ISL motion ready for inspection'
                            : result.phrase?.text ||
                              `${result.phraseMatches?.length || 0} ISL reference phrases`}
                  </h2>
                  <p>{result.message}</p>
                  {result.datasetMatch && (
                    <div className="dataset-annotation">
                      <span className="eyebrow">ISL-CSLTR / PUBLISHED TEXT ANNOTATION</span>
                      <p>
                        <strong>{result.datasetMatch.gloss}</strong>
                      </p>
                      <p>
                        {isModelMotion
                          ? 'Published annotation only; not the source of this generated motion.'
                          : 'No corresponding avatar motion is installed for this annotation.'}
                      </p>
                      <details>
                        <summary>Dataset source and attribution</summary>
                        <p>{result.datasetMatch.attribution}</p>
                        <a className="text-link" href={result.datasetMatch.source}>
                          View dataset <ArrowUpRight size={14} />
                        </a>
                        <a className="text-link" href={result.datasetMatch.licenseUrl}>
                          {result.datasetMatch.license}
                        </a>
                      </details>
                    </div>
                  )}
                  <div className="result-meta">
                    {isAslOutput ? (
                      <>
                        <span>
                          {result.sequence.filter((s) => s.token?.kind === 'letter').length} letter
                          motions
                        </span>
                        <span>{result.wordCount} source words</span>
                        <span>Language: ASL · Review pending</span>
                      </>
                    ) : (
                      <>
                        <span>Match: {result.match || 'None'}</span>
                        <span>
                          Review:{' '}
                          {isReferencePreview
                            ? 'Pending expert review'
                            : isModelMotion
                              ? `${result.generatedMotion?.review.status} (provider-reported)`
                              : result.phrase?.review || 'Not available'}
                        </span>
                        <span>
                          {isReferencePreview
                            ? 'Reference motions'
                            : isModelMotion
                              ? 'Generated segments'
                              : 'Playable ISL assets'}
                          : {result.sequence.length}
                        </span>
                      </>
                    )}
                  </div>
                  {result.generatedMotion && (
                    <div className="dataset-annotation">
                      <span className="eyebrow">MODEL PROVENANCE / PROVIDER-REPORTED</span>
                      <p>
                        {result.generatedMotion.model.id} · {result.generatedMotion.model.version}
                      </p>
                      <details>
                        <summary>Model source, license and review evidence</summary>
                        <p>{result.generatedMotion.model.attribution}</p>
                        <a className="text-link" href={result.generatedMotion.model.source}>
                          Model source <ArrowUpRight size={14} />
                        </a>
                        <a className="text-link" href={result.generatedMotion.model.licenseUrl}>
                          {result.generatedMotion.model.license}
                        </a>
                        {result.generatedMotion.review.evidenceUrl && (
                          <a className="text-link" href={result.generatedMotion.review.evidenceUrl}>
                            Review evidence: {result.generatedMotion.review.reviewer}
                          </a>
                        )}
                      </details>
                    </div>
                  )}
                  {result.warnings?.length ? (
                    <ul className="conversion-warnings">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="provenance">Source: {result.provenance}</p>
                </div>
                <Link
                  href={
                    isAslOutput || isReferencePreview
                      ? result.provenance
                      : result.phrase
                        ? `/phrases/${result.phrase.id}`
                        : '/library'
                  }
                  className="text-link"
                >
                  {isAslOutput
                    ? 'ASL alphabet reference'
                    : isReferencePreview
                      ? 'NISH greeting reference'
                      : result.phrase
                        ? 'View provenance'
                        : 'Browse supported phrases'}
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            ) : (
              <div className="result-empty">
                <span className="result-empty-icon">
                  <Languages size={23} />
                </span>
                <div>
                  <h3>{text ? 'Ready for a new result' : 'Your next conversation'}</h3>
                  <p>No animation is attached to the current text.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
