'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Focus,
  Box,
  AlertTriangle,
  UserRound,
  Rotate3D,
  ScanFace,
  ChevronsLeft,
  ChevronsRight,
  Hand,
} from 'lucide-react';
import { PlaybackEngine } from '@/lib/playback';
import type { Manifest, Sign } from '@/lib/schemas';
import type { IslMotion } from '@/lib/isl-motion-schema';
import { IconButton, Loading, Badge } from './ui';
import { useApp } from './providers';
const Scene = dynamic(() => import('./avatar-scene'), {
  ssr: false,
  loading: () => <Loading label="Preparing 3D studio" />,
});
export function Viewer({
  sequence,
  manifest,
  contextLabel = 'Motion preview',
  emptyMessage = 'No animation available',
  presentation,
  fingerspelling = false,
  islPreview = false,
  sourceText = '',
  generatedMotion,
}: {
  sequence: Sign[];
  manifest: Manifest;
  contextLabel?: string;
  emptyMessage?: string;
  presentation?: 'studio';
  fingerspelling?: boolean;
  islPreview?: boolean;
  sourceText?: string;
  generatedMotion?: IslMotion;
}) {
  const [engine] = useState(() => new PlaybackEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const { preferences, setPreferences, notify } = useApp();
  const [status, setStatus] = useState('Preparing avatar');
  const [missing, setMissing] = useState<string[]>([]);
  const [loadedSequence, setLoadedSequence] = useState<{
    sequence: Sign[];
    missing: string[];
  } | null>(null);
  const [command, setCommand] = useState<{
    type: 'reset' | 'in' | 'out' | 'quarter' | 'detail';
    id: number;
  }>({
    type: 'reset',
    id: 0,
  });
  const frame = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const onStatus = useCallback((s: string, m: string[]) => {
    setStatus(s);
    setMissing(m);
  }, []);
  useEffect(() => {
    engine.setSequence(
      sequence.map((s) => ({
        id: s.id,
        duration:
          (!s.available || missing.includes(s.id)) && s.fallback === 'skip' ? 0.001 : s.duration,
      })),
    );
    setLoadedSequence({ sequence, missing });
    return () => engine.stop();
  }, [engine, sequence, missing]);
  useEffect(() => {
    engine.setSpeed(preferences.speed);
  }, [engine, preferences.speed]);
  useEffect(() => {
    const listener = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);
  const playable =
    loadedSequence?.sequence === sequence &&
    loadedSequence.missing === missing &&
    state.duration > 0 &&
    !/^(Preparing|Loading)/.test(status) &&
    sequence.some((s) => s.available && !missing.includes(s.id));
  const current = sequence[state.index];
  const windowStart = Math.max(0, Math.min(state.index - 8, sequence.length - 17));
  const visibleSequence = sequence.slice(windowStart, windowStart + 17);
  const selectedMissing = missing.filter((id) => sequence.some((s) => s.id === id));
  function moveWord(direction: -1 | 1) {
    const word = current?.token?.wordIndex ?? 0;
    const previousWord = sequence
      .slice(0, state.index)
      .findLast((s) => s.token && s.token.kind !== 'pause' && s.token.wordIndex < word)
      ?.token?.wordIndex;
    const target =
      direction > 0
        ? sequence.findIndex(
            (s, i) =>
              i > state.index && s.token && s.token.kind !== 'pause' && s.token.wordIndex > word,
          )
        : sequence.findIndex(
            (s) => s.token && s.token.kind !== 'pause' && s.token.wordIndex === previousWord,
          );
    if (target >= 0) engine.seekIndex(target);
  }
  const changeCamera = (type: 'reset' | 'in' | 'out' | 'quarter' | 'detail') =>
    setCommand((c) => ({ type, id: c.id + 1 }));
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      notify('Full screen is not available in this browser.', true);
    }
  }
  return (
    <div className="viewer" ref={frame} data-playback={state.phase}>
      <div className="viewer-toolbar">
        <div className="viewer-label">
          <Box size={16} />
          <span>3D STUDIO</span>
          <Badge tone="teal">{state.phase === 'playing' ? 'PLAYING' : 'LIVE CANVAS'}</Badge>
        </div>
        <div className="flex gap-1">
          <IconButton label="Zoom in" onClick={() => changeCamera('in')}>
            <ZoomIn size={17} />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => changeCamera('out')}>
            <ZoomOut size={17} />
          </IconButton>
          <IconButton label="Reset camera" onClick={() => changeCamera('reset')}>
            <Focus size={17} />
          </IconButton>
          <IconButton
            label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </IconButton>
        </div>
      </div>
      {!sequence.length && (
        <div className="viewer-empty-strip" role="status">
          <AlertTriangle size={15} />
          <span>{emptyMessage}. No signing output.</span>
        </div>
      )}
      <div className="canvas-wrap" data-testid="avatar-canvas">
        <Scene
          fingerspelling={fingerspelling}
          islPreview={islPreview}
          generatedMotion={generatedMotion}
          presentation={presentation}
          engine={engine}
          sequence={sequence}
          manifest={manifest}
          cameraCommand={command}
          onStatus={onStatus}
        />
        {presentation === 'studio' && (
          <>
            <div className="stage-registration" aria-hidden="true">
              <span>SB / VIEWPORT 01</span>
              <i />
              <span>Y-UP</span>
            </div>
            <div className="camera-presets" role="group" aria-label="Camera presets">
              <IconButton label="Front view" onClick={() => changeCamera('reset')}>
                <UserRound size={17} />
              </IconButton>
              <IconButton label="Three-quarter view" onClick={() => changeCamera('quarter')}>
                <Rotate3D size={17} />
              </IconButton>
              <IconButton
                label={fingerspelling ? 'Hand detail view' : 'Upper-body view'}
                onClick={() => changeCamera('detail')}
              >
                <ScanFace size={17} />
              </IconButton>
            </div>
          </>
        )}
        <div className="canvas-label">
          <span className="status-dot" />
          {manifest.avatar.url && !status.startsWith('Model loading failed')
            ? manifest.avatar.name
            : fingerspelling
              ? 'ASL alphabet / original rig / review pending'
              : generatedMotion
                ? `ISL model output / ${generatedMotion.review.status === 'reviewed' ? 'provider reports review' : 'review pending'}`
                : islPreview
                  ? 'ISL reference preview / expert review pending'
                  : 'Procedural rig / unreviewed motion'}
        </div>
        <div className="canvas-coordinate">
          <span>{contextLabel}</span>
          <span className="playback-meter" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <motion.div
          className="canvas-progress"
          aria-hidden="true"
          animate={{ scaleX: state.duration ? state.time / state.duration : 0 }}
          transition={{ duration: preferences.reducedMotion ? 0 : 0.08, ease: 'linear' }}
        />
      </div>
      {(fingerspelling || islPreview) && current?.token && (
        <div className="spelling-caption" aria-live="off">
          <span className="spelling-letter">
            {islPreview ? <Hand size={25} /> : current.token.kind === 'pause' ? '·' : current.label}
          </span>
          <div>
            <span className="eyebrow">
              {islPreview ? 'SOURCE PHRASE' : 'SOURCE WORD'} {current.token.wordIndex + 1}
            </span>
            <strong>{sourceText.slice(current.token.wordStart, current.token.wordEnd)}</strong>
          </div>
          <div className="word-controls">
            <IconButton
              label={islPreview ? 'Previous phrase' : 'Previous word'}
              disabled={!sequence.some((s) => (s.token?.wordIndex ?? 0) < current.token!.wordIndex)}
              onClick={() => moveWord(-1)}
            >
              <ChevronsLeft size={18} />
            </IconButton>
            <IconButton
              label={islPreview ? 'Next phrase' : 'Next word'}
              disabled={!sequence.some((s) => (s.token?.wordIndex ?? 0) > current.token!.wordIndex)}
              onClick={() => moveWord(1)}
            >
              <ChevronsRight size={18} />
            </IconButton>
          </div>
        </div>
      )}
      <div className="viewer-bottom">
        <div className="playback-heading">
          <div>
            <span className="eyebrow">
              {state.phase === 'complete'
                ? 'PLAYBACK COMPLETE'
                : state.phase === 'playing'
                  ? 'NOW PLAYING'
                  : 'AVATAR PLAYBACK'}
            </span>
            <strong>{current?.label || emptyMessage}</strong>
          </div>
          <span className="timecode">
            {state.time.toFixed(1)} <span>/ {state.duration.toFixed(1)}s</span>
          </span>
        </div>
        <input
          className="timeline"
          type="range"
          aria-label="Playback timeline"
          min={0}
          max={Math.max(state.duration, 0.01)}
          step={0.01}
          value={state.time}
          disabled={!sequence.length}
          onChange={(e) => engine.seek(Number(e.target.value))}
        />
        <div className="transport">
          <div className="transport-controls">
            <IconButton
              label="Restart playback"
              disabled={!playable}
              onClick={() => {
                engine.stop();
                engine.play();
              }}
            >
              <RotateCcw size={17} />
            </IconButton>
            <IconButton
              label="Previous sign"
              disabled={!sequence.length || state.index === 0}
              onClick={() => engine.previous()}
            >
              <SkipBack size={18} />
            </IconButton>
            <IconButton
              label={
                state.phase === 'playing'
                  ? 'Pause playback'
                  : state.phase === 'paused'
                    ? 'Resume playback'
                    : 'Play sequence'
              }
              className="play-button"
              disabled={!playable}
              onClick={() => (state.phase === 'playing' ? engine.pause() : engine.play())}
            >
              {state.phase === 'playing' ? (
                <Pause size={21} fill="currentColor" />
              ) : (
                <Play size={21} fill="currentColor" />
              )}
            </IconButton>
            <IconButton
              label="Next sign"
              disabled={!sequence.length || state.index >= sequence.length - 1}
              onClick={() => engine.next()}
            >
              <SkipForward size={18} />
            </IconButton>
          </div>
          <label className="speed-control">
            <span>Speed</span>
            <select
              aria-label="Playback speed"
              value={preferences.speed}
              onChange={(e) => setPreferences({ speed: Number(e.target.value) })}
            >
              {[0.5, 0.75, 1, 1.25].map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="viewer-status" role="status">
          {status.startsWith('Model loading failed') && <AlertTriangle size={14} />}
          <span>
            {status}
            {selectedMissing.length > 0 ? ` · ${selectedMissing.length} missing clips` : ''}
          </span>
        </div>
      </div>
      {sequence.length > 0 && (
        <div className="sequence-strip">
          {visibleSequence.map((s, offset) => {
            const i = windowStart + offset;
            return (
              <button
                key={`${s.id}-${i}`}
                className={`sequence-step ${state.index === i ? 'current' : ''}`}
                onClick={() => engine.seekIndex(i)}
                aria-label={`Go to motion ${i + 1}: ${s.label}`}
                aria-current={state.index === i ? 'step' : undefined}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.label}
                {(!s.available || missing.includes(s.id)) && <AlertTriangle size={13} />}
              </button>
            );
          })}
        </div>
      )}
      {sequence.length > 17 && (
        <div className="sequence-range">
          Motions {windowStart + 1}–{Math.min(windowStart + 17, sequence.length)} of{' '}
          {sequence.length}. Use the timeline or word controls to navigate.
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {state.phase === 'complete'
          ? 'Playback complete.'
          : state.phase === 'playing'
            ? `Playing motion ${state.index + 1}, ${current?.label}.`
            : state.phase === 'paused'
              ? 'Playback paused.'
              : ''}
      </span>
    </div>
  );
}
