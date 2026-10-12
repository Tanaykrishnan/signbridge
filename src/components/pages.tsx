'use client';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Clock3,
  Grid2X2,
  Hand,
  GraduationCap,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Search,
  List,
  Trash2,
  Play,
  SlidersHorizontal,
  Database,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import type { Favorite, HistoryItem, Manifest, Phrase } from '@/lib/schemas';
import { Badge, EmptyState, ErrorState, IconButton, Loading, Pagination } from './ui';
import { request, useApp, useRemote, useInterfaceReducedMotion } from './providers';
import { Viewer } from './viewer';
import { phrasePlayback } from '@/lib/phrase-playback';
import { isReferencePhrase } from '@/lib/isl-reference';
import { WorkspaceHeading as Heading } from './workspace-heading';
type PageData<T> = { items: T[]; total: number; page: number; limit: number };
const categories = [
  ['greetings', 'Greetings'],
  ['education', 'Education'],
  ['travel', 'Travel'],
  ['emergencies', 'Emergencies'],
  ['everyday', 'Everyday'],
];
const icons = {
  greetings: Hand,
  education: GraduationCap,
  travel: MapPin,
  emergencies: ShieldAlert,
  everyday: MessageCircle,
};
function PhraseCard({
  phrase,
  favorite,
  onFavorite,
  working,
  available,
  index,
}: {
  phrase: Phrase;
  favorite?: Favorite;
  onFavorite: (phrase: Phrase, favorite?: Favorite) => void;
  working?: boolean;
  available: boolean;
  index: number;
}) {
  const Icon = icons[phrase.category];
  const reduce = useInterfaceReducedMotion();
  return (
    <motion.article
      className="phrase-card"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.48, delay: Math.min(index, 8) * 0.055, ease: 'easeOut' }}
    >
      <div className="phrase-card-top">
        <span className={`category-icon ${phrase.category}`}>
          <Icon size={23} />
        </span>
        <IconButton
          label={favorite ? 'Remove saved phrase' : 'Save phrase'}
          onClick={() => onFavorite(phrase, favorite)}
          disabled={working}
        >
          <Bookmark size={18} fill={favorite ? 'currentColor' : 'none'} />
        </IconButton>
      </div>
      <div className="phrase-card-body">
        <span className="eyebrow">{phrase.category}</span>
        <Link className="phrase-title" href={`/phrases/${phrase.id}`}>
          {phrase.text}
        </Link>
        <div className="phrase-badges">
          <Badge tone={phrase.review === 'reviewed' ? 'teal' : 'amber'}>
            {phrase.review === 'reviewed'
              ? 'Reviewed'
              : phrase.review === 'illustrative'
                ? 'Illustrative'
                : 'Awaiting review'}
          </Badge>
          <span>
            {available
              ? `${phrase.signIds.length} reviewed motions`
              : isReferencePhrase(phrase.id)
                ? 'Unreviewed reference preview'
                : 'Reviewed asset pending'}
          </span>
        </div>
      </div>
      <div className="phrase-card-bottom">
        <Link href={`/studio?mode=isl&text=${encodeURIComponent(phrase.text)}`}>
          <Play size={14} />
          Open in studio
        </Link>
        <Link href={`/phrases/${phrase.id}`} aria-label={`Details for ${phrase.text}`}>
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </motion.article>
  );
}
export function Library({ savedOnly = false }: { savedOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [review, setReview] = useState('');
  const [availability, setAvailability] = useState('');
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [working, setWorking] = useState('');
  const { notify } = useApp();
  const phrases = useRemote<PageData<Phrase>>(
    `/api/phrases?limit=${savedOnly ? 100 : 9}&page=${savedOnly ? 1 : page}&q=${encodeURIComponent(query)}${category ? `&category=${category}` : ''}${review ? `&review=${review}` : ''}${availability ? `&available=${availability}` : ''}`,
  );
  const favorites = useRemote<PageData<Favorite>>('/api/favorites?limit=100');
  const assets = useRemote<Manifest>('/api/assets');
  async function toggle(p: Phrase, f?: Favorite) {
    setWorking(p.id);
    try {
      if (f) await request(`/api/favorites/${f.id}`, { method: 'DELETE' });
      else
        await request('/api/favorites', {
          method: 'POST',
          body: JSON.stringify({ phraseId: p.id }),
        });
      favorites.reload();
      notify(f ? 'Phrase removed from saved.' : 'Phrase saved.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setWorking('');
    }
  }
  const visible = (phrases.data?.items || []).filter(
    (p) => !savedOnly || favorites.data?.items.some((f) => f.phraseId === p.id),
  );
  return (
    <>
      <Heading
        eyebrow={savedOnly ? 'YOUR COLLECTION' : 'LEARN & EXPLORE'}
        title={savedOnly ? 'Saved phrases' : 'Phrase library'}
        description={
          savedOnly
            ? 'Your collection, ready for another look.'
            : 'Explore the sample dictionary and its asset provenance.'
        }
      />
      <div className="library-notice">
        <InfoDot />
        <span>
          Sample phrases have no reviewed signing assets. Rig exercises are separate in Motion lab.
        </span>
        <Link href="/about">
          Read more <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="filters">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search phrases"
            placeholder="Search phrases..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Review status"
          value={review}
          onChange={(e) => {
            setReview(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All review statuses</option>
          <option value="illustrative">Illustrative</option>
          <option value="unreviewed">Awaiting review</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <select
          aria-label="Asset availability"
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All assets</option>
          <option value="true">Reviewed playback available</option>
          <option value="false">Asset missing</option>
        </select>
        <div className="segmented">
          <IconButton
            label="Grid layout"
            aria-pressed={layout === 'grid'}
            onClick={() => setLayout('grid')}
          >
            <Grid2X2 size={17} />
          </IconButton>
          <IconButton
            label="List layout"
            aria-pressed={layout === 'list'}
            onClick={() => setLayout('list')}
          >
            <List size={18} />
          </IconButton>
        </div>
      </div>
      {phrases.error || favorites.error || assets.error ? (
        <ErrorState
          message={phrases.error || favorites.error || assets.error}
          retry={() => {
            phrases.reload();
            favorites.reload();
            assets.reload();
          }}
        />
      ) : phrases.loading || favorites.loading || assets.loading ? (
        <Loading label="Loading phrases" />
      ) : !visible.length ? (
        <EmptyState title={savedOnly ? 'No saved phrases match' : 'No phrases match your filters'}>
          {savedOnly
            ? 'Save a phrase from the library to build your collection.'
            : 'Try another category or review status.'}
        </EmptyState>
      ) : (
        <div className={`phrase-grid ${layout === 'list' ? 'list-layout' : ''}`}>
          {visible.map((p, index) => (
            <PhraseCard
              key={p.id}
              phrase={p}
              available={phrasePlayback(p, assets.data?.signs || []).state === 'ready'}
              favorite={favorites.data?.items.find((f) => f.phraseId === p.id)}
              onFavorite={toggle}
              working={working === p.id}
              index={index}
            />
          ))}
        </div>
      )}
      {!savedOnly && phrases.data && (
        <Pagination page={page} total={phrases.data.total} limit={9} onPage={setPage} />
      )}
    </>
  );
}
function InfoDot() {
  return <span className="info-symbol">i</span>;
}
export function PhraseDetail({ id }: { id: string }) {
  const phrase = useRemote<Phrase>(`/api/phrases/${encodeURIComponent(id)}`);
  const manifest = useRemote<Manifest>('/api/assets');
  const favorites = useRemote<PageData<Favorite>>('/api/favorites?limit=100');
  const { notify } = useApp();
  const [working, setWorking] = useState(false);
  const playback = useMemo(
    () => phrasePlayback(phrase.data, manifest.data?.signs || []),
    [phrase.data, manifest.data],
  );
  if (phrase.error || manifest.error)
    return <ErrorState message={phrase.error || manifest.error} />;
  if (!phrase.data || !manifest.data) return <Loading label="Loading phrase" />;
  const p = phrase.data;
  const favorite = favorites.data?.items.find((f) => f.phraseId === p.id);
  const sequence = p.signIds
    .map((id) => manifest.data!.signs.find((s) => s.id === id))
    .filter((s): s is Manifest['signs'][number] => Boolean(s));
  return (
    <>
      <Link href="/library" className="text-link back-link">
        <ArrowRight className="rotate-180" size={15} />
        Phrase library
      </Link>
      <Heading eyebrow={p.category} title={p.text} description={p.description} />
      <div className="detail-grid">
        <div>
          <div className="provenance-block">
            <h2>Language & provenance</h2>
            <Badge tone="amber">{p.review}</Badge>
            <dl>
              <dt>Language</dt>
              <dd>English source / ISL target architecture</dd>
              <dt>Review</dt>
              <dd>{p.reviewer || 'No linguistic reviewer assigned'}</dd>
              <dt>Source</dt>
              <dd>{p.source}</dd>
              <dt>License</dt>
              <dd>{p.license}</dd>
              <dt>ISL gloss</dt>
              <dd>No verified gloss supplied</dd>
            </dl>
            <button
              className="button primary"
              disabled={working || favorites.loading || Boolean(favorites.error)}
              onClick={async () => {
                setWorking(true);
                try {
                  if (favorite) {
                    await request(`/api/favorites/${favorite.id}`, { method: 'DELETE' });
                  } else {
                    await request('/api/favorites', {
                      method: 'POST',
                      body: JSON.stringify({ phraseId: p.id }),
                    });
                  }
                  favorites.reload();
                  notify(favorite ? 'Phrase removed from saved.' : 'Phrase saved.');
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setWorking(false);
                }
              }}
            >
              <Bookmark size={16} />
              {favorite ? 'Remove saved phrase' : 'Save phrase'}
            </button>
            {favorites.error && <p className="inline-error">{favorites.error}</p>}
            {isReferencePhrase(p.id) && (
              <p>
                <Link
                  className="text-link"
                  href={`/studio?mode=isl&text=${encodeURIComponent(p.text)}`}
                >
                  Open unreviewed reference preview <ArrowRight size={15} />
                </Link>
              </p>
            )}
          </div>
          <h2 className="section-title">Motion assets</h2>
          {sequence.map((s, i) => (
            <div className="asset-row" key={`${s.id}-${i}`}>
              <div>
                <strong>{s.label}</strong>
                <p>{s.provenance}</p>
                <span>
                  {s.duration}s · {s.license}
                </span>
              </div>
              <Badge tone={s.available ? 'teal' : 'amber'}>
                {s.available
                  ? s.review === 'reviewed'
                    ? 'Asset available'
                    : 'Unreviewed preview'
                  : 'Missing asset'}
              </Badge>
            </div>
          ))}
        </div>
        <Viewer
          presentation="studio"
          sequence={playback.sequence}
          manifest={manifest.data}
          contextLabel={p.text}
          emptyMessage="Reviewed animation unavailable"
        />
      </div>
    </>
  );
}
export function HistoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { notify } = useApp();
  const reduce = useInterfaceReducedMotion();
  const history = useRemote<PageData<HistoryItem>>(
    `/api/history?page=${page}&limit=10&q=${encodeURIComponent(query)}${status ? `&status=${status}` : ''}`,
  );
  async function remove(id: string) {
    try {
      await request(`/api/history/${id}`, { method: 'DELETE' });
      history.reload();
      notify('History entry removed.');
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR WORKSPACE"
        title="Translation history"
        description="Revisit the phrases you have explored in this browser session."
      />
      <div className="filters">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search history"
            placeholder="Search your history..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="History status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All results</option>
          <option value="supported">Dictionary matches</option>
          <option value="unsupported">Unsupported phrases</option>
        </select>
      </div>
      {history.error ? (
        <ErrorState message={history.error} retry={history.reload} />
      ) : history.loading ? (
        <Loading label="Loading history" />
      ) : !history.data?.items.length ? (
        <EmptyState title="No translations here yet">
          Translate a phrase in the studio to add it to your history.
        </EmptyState>
      ) : (
        <div className="history-list">
          {history.data.items.map((item, index) => (
            <motion.article
              className="history-row"
              key={item.id}
              initial={reduce ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.38, delay: Math.min(index, 8) * 0.045 }}
            >
              <span className="history-icon">
                <Clock3 size={20} />
              </span>
              <div className="history-content">
                <Link
                  href={`/studio?mode=${item.outputMode === 'asl-fingerspelling' ? 'fingerspelling' : 'isl'}&text=${encodeURIComponent(item.sourceText)}`}
                >
                  {item.sourceText}
                </Link>
                <span>
                  {new Date(item.createdAt).toLocaleString()} ·{' '}
                  {item.outputMode === 'asl-fingerspelling'
                    ? 'ASL fingerspelling · review pending'
                    : item.status === 'supported'
                      ? 'Demonstration dictionary match'
                      : 'Unsupported'}
                </span>
              </div>
              <Link
                className="button small secondary"
                href={`/studio?mode=${item.outputMode === 'asl-fingerspelling' ? 'fingerspelling' : 'isl'}&text=${encodeURIComponent(item.sourceText)}`}
              >
                <Play size={14} />
                Reopen
              </Link>
              <IconButton
                label={`Remove history: ${item.sourceText}`}
                onClick={() => remove(item.id)}
              >
                <Trash2 size={16} />
              </IconButton>
            </motion.article>
          ))}
        </div>
      )}
      {history.data && (
        <Pagination page={page} total={history.data.total} limit={10} onPage={setPage} />
      )}
    </>
  );
}
export function Dashboard() {
  const reduce = useInterfaceReducedMotion();
  const history = useRemote<PageData<HistoryItem>>('/api/history?limit=5');
  const phrases = useRemote<PageData<Phrase>>('/api/phrases?limit=100');
  const favorites = useRemote<PageData<Favorite>>('/api/favorites?limit=1');
  return (
    <>
      <Heading
        eyebrow="WORKSPACE OVERVIEW"
        title="Welcome to SignBridge"
        description="Pick up where you left off, or explore a new phrase."
      />
      <div className="overview-stats">
        {[
          { label: 'Dictionary phrases', value: phrases.data?.total, Icon: BookOpen },
          { label: 'Your translations', value: history.data?.total, Icon: Clock3 },
          { label: 'Saved phrases', value: favorites.data?.total, Icon: Bookmark },
          {
            label: 'Reviewed phrases',
            value: phrases.data?.items.filter((p) => p.review === 'reviewed').length,
            Icon: FileCheck2,
          },
        ].map(({ label, value, Icon }, index) => (
          <motion.div
            className="stat"
            key={label}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: index * 0.09 }}
          >
            <Icon size={20} />
            <strong>{value ?? '--'}</strong>
            <span>{label}</span>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="overview-start"
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.22 }}
      >
        <div>
          <Badge tone="teal">STUDIO</Badge>
          <h2>Give a phrase a little movement.</h2>
          <p>Check a phrase, or explore original rig exercises in the separate Motion lab.</p>
        </div>
        <Link className="button primary" href="/studio">
          <Sparkles size={17} />
          Open studio
          <ArrowRight size={17} />
        </Link>
      </motion.div>
      <div className="section-bar">
        <h2>Recently explored</h2>
        <Link href="/history" className="text-link">
          View history
          <ArrowRight size={15} />
        </Link>
      </div>
      {history.error ? (
        <ErrorState message={history.error} />
      ) : history.loading ? (
        <Loading label="Loading activity" />
      ) : history.data?.items.length ? (
        <div className="history-list">
          {history.data.items.map((h, index) => (
            <motion.div
              key={h.id}
              className="history-row"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <Clock3 size={20} />
              <div className="history-content">
                <Link
                  href={`/studio?mode=${h.outputMode === 'asl-fingerspelling' ? 'fingerspelling' : 'isl'}&text=${encodeURIComponent(h.sourceText)}`}
                >
                  {h.sourceText}
                </Link>
                <span>
                  {h.outputMode === 'asl-fingerspelling'
                    ? 'ASL fingerspelling · review pending'
                    : h.status === 'supported'
                      ? 'Illustrative dictionary match'
                      : 'Unsupported phrase'}
                </span>
              </div>
              <Link
                className="history-open"
                href={`/studio?mode=${h.outputMode === 'asl-fingerspelling' ? 'fingerspelling' : 'isl'}&text=${encodeURIComponent(h.sourceText)}`}
                aria-label={`Reopen ${h.sourceText}`}
              >
                <ArrowUpRight size={18} />
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState title="A fresh workspace">Your translated phrases will appear here.</EmptyState>
      )}
    </>
  );
}
export function SettingsPage() {
  const { preferences, preferencesReady, setPreferences, notify } = useApp();
  const health = useRemote<{ storage: string }>('/api/health');
  return (
    <>
      <Heading
        eyebrow="PREFERENCES"
        title="Make it yours"
        description="Playback and accessibility preferences are stored on this device."
      />
      <div className="settings-page">
        <section>
          <h2>
            <SlidersHorizontal size={20} />
            Playback
          </h2>
          <div className="setting-row">
            <div>
              <strong>Default playback speed</strong>
              <p>Applies to the studio and phrase previews.</p>
            </div>
            <select
              aria-label="Default playback speed"
              disabled={!preferencesReady}
              value={preferences.speed}
              onChange={(e) => setPreferences({ speed: Number(e.target.value) })}
            >
              {[0.5, 0.75, 1, 1.25].map((v) => (
                <option key={v} value={v}>
                  {v}x
                </option>
              ))}
            </select>
          </div>
        </section>
        <section>
          <h2>Appearance & accessibility</h2>
          <div className="setting-row">
            <div>
              <strong>Theme</strong>
              <p>Choose a comfortable workspace appearance.</p>
            </div>
            <select
              aria-label="Theme"
              disabled={!preferencesReady}
              value={preferences.theme}
              onChange={(e) => setPreferences({ theme: e.target.value as 'dark' | 'light' })}
            >
              <option value="dark">Porcelain</option>
              <option value="light">Bright white</option>
            </select>
          </div>
          {(
            [
              {
                key: 'reducedMotion',
                label: 'Reduce interface motion',
                description:
                  'Minimizes interface animation. Avatar playback begins only when you press play.',
              },
              {
                key: 'highContrast',
                label: 'High contrast',
                description: 'Stronger borders and text contrast.',
              },
              {
                key: 'largeText',
                label: 'Larger text',
                description: 'Increases reading size throughout the workspace.',
              },
            ] as const
          ).map((s) => (
            <label className="setting-row" key={s.key}>
              <div>
                <strong>{s.label}</strong>
                <p>{s.description}</p>
              </div>
              <input
                className="toggle"
                type="checkbox"
                aria-label={s.label}
                disabled={!preferencesReady}
                checked={preferences[s.key]}
                onChange={(e) => setPreferences({ [s.key]: e.target.checked })}
              />
            </label>
          ))}
        </section>
        <section>
          <h2>
            <Database size={20} />
            Workspace storage
          </h2>
          <p>
            {health.error
              ? health.error
              : health.data?.storage === 'postgresql'
                ? 'PostgreSQL is configured. Records are scoped to your guest browser session.'
                : 'History and saved phrases persist in a local server file. They belong to this guest browser session; clearing the session cookie loses access.'}
          </p>
          <Link href="/privacy" className="text-link">
            Privacy & data
            <ArrowUpRight size={15} />
          </Link>
        </section>
        <button
          className="button secondary"
          disabled={!preferencesReady}
          onClick={() => {
            setPreferences({
              speed: 1,
              theme: 'dark',
              reducedMotion: false,
              highContrast: false,
              largeText: false,
            });
            notify('Preferences restored.');
          }}
        >
          Restore default preferences
        </button>
      </div>
    </>
  );
}
export function InformationPage({ kind }: { kind: 'about' | 'privacy' | 'help' }) {
  return (
    <>
      <Heading
        eyebrow="SIGNBRIDGE"
        title={
          kind === 'about'
            ? 'Built for clear communication'
            : kind === 'privacy'
              ? 'Your data, explained'
              : 'Help & resources'
        }
        description={
          kind === 'about'
            ? 'An honest foundation for an ISL translation experience.'
            : kind === 'privacy'
              ? 'What this application stores and where.'
              : 'Get comfortable with your workspace.'
        }
      />
      <div className="reading-page">
        {kind === 'about' ? (
          <>
            <h2>What works today</h2>
            <p>
              SignBridge converts English text into the ASL manual alphabet with original,
              reference-informed finger animations. It accepts up to 5,000 characters, preserves
              word boundaries, and distinguishes repeated letters. This is fingerspelling, not ASL
              sentence translation. ISL mode includes seven original, unreviewed greeting previews
              and never falls back to ASL. Published ISL-CSLTR sentence/gloss annotations appear for
              exact matching inputs; their avatar motions are not installed. It includes a real 3D
              scene, a procedural articulated rig, animation sequencing, library search, local
              history, and saved phrases.
            </p>
            <p>
              An optional local SignVQVAE research engine also generates body and finger motion from
              a 1,997-class ISL sign vocabulary. Its English gloss planner and avatar retargeting
              are experimental, not validated sentence translation. Unknown vocabulary is reported
              without fingerspelling. Model/data commercial permissions remain unestablished, so
              this engine is disabled in production.
            </p>
            <p>
              The English language lab runs a local pretrained Qwen model for paraphrasing, with
              prompt comparisons, generation evidence and preservation flags. This is English
              generation, not ISL motion synthesis. Generated text requires a meaning check.
            </p>
            <h2>What is demonstration content</h2>
            <p>
              The Motion lab clips are engineering demonstrations. The ASL alphabet animations are
              based on published fingerspelling references but have not been reviewed by an ASL
              expert. No bundled motion constitutes a verified ISL translation. The procedural rig
              is original geometry; it does not reproduce a real person&apos;s likeness.
            </p>
            <h2>What reviewed translation requires</h2>
            <p>
              A qualified ISL reviewer must validate linguistic content, regional variants, hand
              shapes, timing, non-manual markers, and animation intelligibility. Each imported asset
              needs documented rights and provenance. Dictionary matching alone does not establish
              correct ISL grammar.
            </p>
            <h2>Source and license</h2>
            <p>
              Bundled fixture data, procedural geometry, and code are provided under the
              project&apos;s MIT license. No third-party signing videos or human models are bundled.
              External dependencies retain their own licenses.
            </p>
            <p>
              ISL-CSLTR sentence/gloss annotations: Elakkiya R and NATARAJAN B (2021), version 1,
              DOI 10.17632/kcmpdxky7p.1. Extracted from the source CSV with whitespace trimmed; no
              source videos or images included.{' '}
              <a className="text-link" href="https://data.mendeley.com/datasets/kcmpdxky7p/1">
                Dataset
              </a>
              ,{' '}
              <a className="text-link" href="https://creativecommons.org/licenses/by/4.0/">
                CC BY 4.0
              </a>
              . Original greeting previews reference the{' '}
              <a className="text-link" href="https://nish.ac.in/docs/EIP_Magazine_2020.pdf#page=21">
                NISH greeting chart
              </a>{' '}
              and await expert review.
            </p>
            <Link className="button primary" href="/library">
              Explore the dictionary
              <ArrowRight size={16} />
            </Link>
          </>
        ) : kind === 'privacy' ? (
          <>
            <h2>Guest workspace</h2>
            <p>
              This app does not offer accounts or claim to authenticate you. A signed, HTTP-only
              guest cookie keeps your history and favorites separate from other browser sessions.
              The cookie lasts 30 days. Clearing it removes your browser&apos;s access to the
              associated records.
            </p>
            <h2>Stored records</h2>
            <p>
              Translating a phrase stores the source text, match status, matched phrase identifier,
              and timestamp. Saving a phrase stores its identifier and timestamp. You can remove
              each history entry or saved phrase from its page.
            </p>
            <p>
              English paraphrasing stores the latest 50 source texts, outputs, prompts and model
              metrics in a local file scoped to the same guest session. These generation records use
              local storage even when translation records use PostgreSQL.
            </p>
            <h2>Storage location</h2>
            <p>
              Without PostgreSQL credentials, records persist on the local server filesystem. This
              fallback supports a single server process. With PostgreSQL configured, records are
              stored in that database. Your device stores appearance and accessibility preferences
              in local storage.
            </p>
            <h2>Translation services</h2>
            <p>
              English paraphrasing sends text to the configured language-model endpoint. The
              included model runs locally; a remotely configured endpoint receives your input. No
              analytics, camera, microphone, or remote avatar downloads are enabled by default.
              Clipboard access only occurs when you press Paste or Copy. If an administrator
              configures an ISL motion model, the complete source text is sent to that endpoint for
              generation. Its operator must disclose data handling before public use. Model tokens
              remain server-only.
            </p>
            <h2>Before public use</h2>
            <p>
              A public deployment needs an explicit data retention policy, a secure account or
              guest-access policy, protected infrastructure, and licensed reviewed content. This
              local demonstration is not intended for sensitive communication.
            </p>
          </>
        ) : (
          <>
            {[
              {
                q: 'Which phrases can I use?',
                a: 'English input accepts up to 5,000 characters. ISL reference previews cover Hello, Thank you, Namaste, Sorry, Bye, How are you?, and Good morning, including their declared aliases. Separate complete phrases with punctuation. Arbitrary-text ISL requires a trained motion model; none is bundled. ISL mode never falls back to ASL. Reference previews are not expert-reviewed translations.',
              },
              {
                q: 'Why does the app say the motions are illustrative?',
                a: 'Both the original ASL alphabet animations and the seven ISL reference previews await expert review. Motion lab exercises are separate engineering fixtures. Published dataset glosses are attributed text annotations, without installed avatar motion.',
              },
              {
                q: 'How do I control the avatar?',
                a: 'Enter text, translate it, then use Play when motion is available. Timeline, speed, camera, and previous/next controls are available. In ISL mode, unreviewed reference previews and configured-model output have explicit review controls. The separate ASL tool never runs automatically.',
              },
              {
                q: 'What happens when an asset is missing?',
                a: 'The phrase displays an asset-pending indicator. Missing motion clips do not generate invented movement. If the entire sequence is unavailable, playback is disabled.',
              },
              {
                q: 'Why is the 3D viewer unavailable?',
                a: 'Enable WebGL and hardware acceleration, then refresh. If a configured GLB fails to load, the app reports the failure and uses the clearly labelled procedural rig.',
              },
              {
                q: 'Where are my saved phrases?',
                a: 'Open Saved phrases. Records belong to your signed guest cookie and persist on the server. A new browser, cleared cookie, or expired session starts a separate guest workspace.',
              },
            ].map((x) => (
              <details key={x.q}>
                <summary>{x.q}</summary>
                <p>{x.a}</p>
              </details>
            ))}
            <div className="help-links">
              <Link href="/studio" className="button primary">
                Open studio
                <ArrowRight size={16} />
              </Link>
              <Link href="/settings" className="button secondary">
                Accessibility settings
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
