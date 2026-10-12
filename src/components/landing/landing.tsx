'use client';

import '@fontsource-variable/manrope';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Code2,
  Hand,
  Layers3,
  Menu,
  MoveUpRight,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp, useRemote } from '@/components/providers';
import type { Manifest } from '@/lib/schemas';
import s from './landing.module.css';
import PipelineStory from './pipeline-story';

const HeroScene = dynamic(() => import('./hero-scene'), { ssr: false });
const Viewer = dynamic(() => import('@/components/viewer').then((m) => m.Viewer), { ssr: false });
const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  className,
  paused,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  paused: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={paused ? false : { opacity: 0, y: 28 }}
      animate={paused ? { opacity: 1, y: 0 } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: paused ? 0 : 0.75, ease, delay: paused ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

function LivePreview() {
  const { data, error, reload } = useRemote<Manifest>('/api/assets');
  const [selected, setSelected] = useState('demo-open');
  const sequence = useMemo(
    () =>
      data?.signs.filter(
        (sign) => sign.id === selected && sign.review === 'illustrative' && sign.available,
      ) ?? [],
    [data, selected],
  );
  return (
    <>
      <div className={s.previewHeader}>
        <span>
          <span className={s.liveDot} /> MOTION LAB <small>/ ENGINEERING DEMO</small>
        </span>
        <div className={s.previewTabs} aria-label="Demonstration motion">
          {[
            ['demo-open', 'Open hand'],
            ['demo-reach', 'Reach'],
          ].map(([id, label]) => (
            <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <div className={s.previewPlaceholder} role="alert">
          <p>The motion assets could not be loaded.</p>
          <button className={s.textLink} onClick={reload}>
            Try again <RotateCcw size={16} />
          </button>
        </div>
      ) : data ? (
        <Viewer sequence={sequence} manifest={data} contextLabel="Engineering demo / not ISL" />
      ) : (
        <div className={s.previewPlaceholder} role="status">
          Loading the live workspace...
        </div>
      )}
    </>
  );
}

const capabilities = [
  {
    number: '01',
    Icon: AudioLines,
    title: 'Begin with a thought.',
    text: 'A phrase, a question, a moment of connection. Explore a growing foundation for text-to-sign translation.',
    label: 'Explore the translator',
    href: '/studio',
    note: 'ENGLISH INPUT / REVIEW-GATED OUTPUT',
  },
  {
    number: '02',
    Icon: Layers3,
    title: 'Get closer to motion.',
    text: 'Step into a real 3D workspace. Inspect a rig, slow down a motion, and see the details from another angle.',
    label: 'Enter the motion lab',
    href: '/studio?mode=lab',
    note: 'LIVE 3D / ILLUSTRATIVE MOTIONS',
  },
  {
    number: '03',
    Icon: BookOpen,
    title: 'Keep the conversation.',
    text: 'Find sample phrases, collect favorites, and return to the ideas that matter. Your workspace stays with you.',
    label: 'Browse the phrase library',
    href: '/library',
    note: 'PHRASE LIBRARY / SAVED FAVORITES',
  },
];
const questions = [
  {
    title: 'Can SignBridge translate anything into ISL?',
    answer:
      'Not reliably. With the optional local research decoder installed, new sentences can generate motion from supported sign vocabulary. Its English-to-gloss planning and avatar retargeting are experimental, not expert-verified ISL translation. Unknown vocabulary is reported; ISL mode never silently substitutes ASL or fingerspelling.',
  },
  {
    title: 'What am I seeing in the 3D experience?',
    answer:
      'The homepage hand sculpture is original concept artwork. The Motion lab contains an original procedural avatar and generic rig exercises. Both are engineering demonstrations, not Indian Sign Language. The studio also supports compatible GLB models and animation clips.',
  },
  {
    title: 'What will make real ISL playback possible?',
    answer:
      'The local research decoder can generate unreviewed motion today. Trustworthy interpretation still needs licensed assets, evaluation by fluent Deaf ISL users, accurate grammar, facial expressions and spatial structure. Word-for-word English substitution cannot replace that work.',
  },
  {
    title: 'Do I need an account or paid API?',
    answer:
      'No. This local prototype works without either. History and favorites use a guest session with real local-file persistence, or PostgreSQL when configured. Clearing your guest cookie loses access to those saved records. This is a demonstration workspace, not a production account.',
  },
];

export function Landing() {
  const { preferences, setPreferences } = useApp();
  const reducedMotionPreference = useReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const systemReduced = hydrated && reducedMotionPreference;
  const [motionPaused, setMotionPaused] = useState(false);
  const paused = motionPaused || preferences.reducedMotion || !!systemReduced;
  const [menuOpen, setMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [study, setStudy] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [question, setQuestion] = useState<number | null>(0);
  const hero = useRef<HTMLElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const heroVisible = useInView(hero, { amount: 0.05 });
  const previewVisible = useInView(preview, { once: true, margin: '180px' });
  const onReady = useCallback(() => setReady(true), []);
  const { scrollYProgress } = useScroll();
  const { scrollYProgress: heroProgress } = useScroll({
    target: hero,
    offset: ['start start', 'end end'],
  });
  const titleY = useTransform(heroProgress, [0, 1], [0, -24]);
  useMotionValueEvent(heroProgress, 'change', (value) => {
    setChapter(value < 0.34 ? 0 : value < 0.7 ? 1 : 2);
  });
  useEffect(() => {
    setHydrated(true);
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  function toggleMotion() {
    if (paused) {
      setMotionPaused(false);
      setPreferences({ reducedMotion: false });
    } else {
      setMotionPaused(true);
      setPreferences({ reducedMotion: true });
    }
  }
  const navLinks = (
    <>
      <a href="#vision" onClick={() => setMenuOpen(false)}>
        The vision
      </a>
      <a href="#workspace" onClick={() => setMenuOpen(false)}>
        Inside the studio
      </a>
      <a href="#questions" onClick={() => setMenuOpen(false)}>
        Good to know
      </a>
    </>
  );

  return (
    <div className={s.landing} data-motion-paused={paused}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <motion.div
        className={s.scrollProgress}
        style={{ scaleX: scrollYProgress }}
        aria-hidden="true"
      />
      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="SignBridge home">
          <Hand size={27} strokeWidth={1.8} aria-hidden="true" />
          SignBridge<span className={s.logoDot}>.</span>
        </Link>
        <nav className={s.desktopNav} aria-label="Homepage navigation">
          {navLinks}
        </nav>
        <div className={s.headerActions}>
          <Link className={s.navCta} href="/studio">
            Open studio <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <button className={s.menuButton} aria-label="Open homepage navigation">
                <Menu size={23} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className={s.menuOverlay} />
              <Dialog.Content className={s.mobileMenu}>
                <Dialog.Title>Explore SignBridge</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Navigate the homepage or open the translation studio.
                </Dialog.Description>
                <Dialog.Close asChild>
                  <button className={s.closeMenu} aria-label="Close homepage navigation">
                    <X size={23} />
                  </button>
                </Dialog.Close>
                <nav aria-label="Mobile homepage navigation">
                  {navLinks}
                  <Link href="/studio">
                    Open studio <ArrowUpRight size={22} />
                  </Link>
                  <Link href="/library">
                    Phrase library <ArrowUpRight size={22} />
                  </Link>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>

      <main id="main">
        <section
          className={s.hero}
          ref={hero}
          data-chapter={chapter}
          data-testid="immersive-story"
          aria-labelledby="hero-title"
          onPointerMove={(event) => {
            if (paused || event.pointerType !== 'mouse') return;
            const bounds = event.currentTarget.getBoundingClientRect();
            pointer.current = {
              x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
              y: ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
            };
          }}
          onPointerLeave={() => {
            pointer.current = { x: 0, y: 0 };
          }}
        >
          <div className={s.stickyStage}>
            <div className={s.heroGrid} aria-hidden="true" />
            <motion.div className={s.heroArt} data-testid="hero-art" data-ready={ready}>
              <HeroScene
                running={!paused && heroVisible && visible}
                rotation={rotation}
                pointer={pointer}
                onReady={onReady}
                progress={heroProgress}
                study={study}
              />
              {!ready && (
                <span className={s.sceneLoading} role="status">
                  Preparing the sculpture
                </span>
              )}
            </motion.div>
            <motion.div className={s.heroContent} style={{ y: paused ? 0 : titleY }}>
              <motion.div
                className={s.eyebrow}
                initial={paused ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className={s.liveDot} /> LANGUAGE IN MOTION{' '}
                <span className={s.eyebrowDivider}>/</span> ISL RESEARCH STUDIO
              </motion.div>
              <h1 id="hero-title" className={s.heroTitle} aria-label="SignBridge">
                {'SignBridge'.split('').map((letter, i) => (
                  <motion.span
                    key={i}
                    aria-hidden="true"
                    initial={paused ? false : { y: '110%', rotate: 7 }}
                    animate={{ y: 0, rotate: 0 }}
                    transition={{ duration: 0.9, delay: paused ? 0 : 0.08 + i * 0.035, ease }}
                  >
                    {letter}
                  </motion.span>
                ))}
                <span className={s.titleDot} aria-hidden="true">
                  .
                </span>
              </h1>
              <motion.div
                initial={paused ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: paused ? 0 : 0.4, ease }}
              >
                <p className={s.heroStatement}>
                  {
                    [
                      'Language, beyond the spoken word.',
                      'Every movement has a story.',
                      'From an idea to your workspace.',
                    ][chapter]
                  }
                </p>
                <p className={s.heroDescription}>
                  {
                    [
                      'English text. Indian Sign Language research. A new perspective on connection.',
                      'Explore articulation, spatial expression and the detail inside a real 3D rig.',
                      'Paraphrase English, inspect experimental sign motion, and keep your conversation.',
                    ][chapter]
                  }
                </p>
                <div className={s.heroActions}>
                  <Link href="/studio" className={s.primaryCta}>
                    Step into the studio <ArrowUpRight size={20} aria-hidden="true" />
                  </Link>
                  <Link href="/studio?mode=lab" className={s.secondaryCta}>
                    <span>
                      <Play size={15} fill="currentColor" aria-hidden="true" />
                    </span>
                    Explore motion
                  </Link>
                </div>
                <div className={s.heroFootnote}>
                  <span /> Open prototype. No account needed.
                </div>
              </motion.div>
            </motion.div>
            <div className={s.artCaption}>
              <span className={s.crosshair} aria-hidden="true">
                +
              </span>
              <div>
                SPATIAL ARCHIVE / 00{chapter + 1}
                <small>Original 3D artwork. Not ISL.</small>
              </div>
            </div>
            <div className={s.studySelector} aria-label="Sculpture study">
              {['Form', 'Articulation', 'Connection'].map((label, index) => (
                <button key={label} aria-pressed={study === index} onClick={() => setStudy(index)}>
                  <span>0{index + 1}</span>
                  {label}
                </button>
              ))}
            </div>
            <div className={s.heroBottom}>
              <a href="#vision" className={s.scrollLink}>
                A new perspective <ArrowDown size={16} aria-hidden="true" />
              </a>
              <div className={s.sceneControls}>
                <button
                  onClick={() => setRotation((r) => r - 0.25)}
                  aria-label="Rotate sculpture left"
                  title="Rotate sculpture left"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setRotation(0)}
                  aria-label="Reset sculpture"
                  title="Reset sculpture"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={() => setRotation((r) => r + 0.25)}
                  aria-label="Rotate sculpture right"
                  title="Rotate sculpture right"
                >
                  <ChevronRight size={18} />
                </button>
                <span className={s.controlDivider} />
                <button
                  onClick={toggleMotion}
                  aria-label={paused ? 'Resume page motion' : 'Pause page motion'}
                  title={
                    systemReduced
                      ? 'System reduced motion is active'
                      : paused
                        ? 'Resume page motion'
                        : 'Pause page motion'
                  }
                  disabled={!!systemReduced}
                  aria-pressed={paused}
                >
                  {paused ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <span className={s.motionLabel}>{paused ? 'MOTION OFF' : 'MOTION ON'}</span>
              </div>
            </div>
            <div className={s.chapterRail} aria-label="Experience chapters">
              {['Language', 'Movement', 'Connection'].map((label, index) => (
                <button
                  key={label}
                  aria-pressed={chapter === index}
                  onClick={() => {
                    const bounds = hero.current!.getBoundingClientRect();
                    window.scrollTo({
                      top:
                        window.scrollY +
                        bounds.top +
                        (bounds.height - window.innerHeight) * (index / 2),
                      behavior: paused ? 'instant' : 'smooth',
                    });
                  }}
                >
                  <span>0{index + 1}</span>
                  {label}
                  <i />
                </button>
              ))}
            </div>
          </div>
        </section>

        <PipelineStory paused={paused} />

        <div className={s.principleStrip}>
          <span>
            <Hand size={19} aria-hidden="true" /> Built around Indian Sign Language
          </span>
          <span>
            <Code2 size={19} aria-hidden="true" /> Real 3D. Open foundations.
          </span>
          <span>
            <ShieldCheck size={19} aria-hidden="true" /> Review before representation
          </span>
        </div>

        <section id="vision" className={s.vision} aria-labelledby="vision-title">
          <div className={s.sectionLabel}>
            <span>01 / THE VISION</span>
            <MoveUpRight size={21} aria-hidden="true" />
          </div>
          <Reveal paused={paused}>
            <h2 id="vision-title">
              Connection shouldn&apos;t
              <br />
              depend on <span>sound.</span>
            </h2>
          </Reveal>
          <div className={s.visionBottom}>
            <Reveal paused={paused} className={s.visionAside}>
              <span className={s.visionMark} aria-hidden="true">
                <Hand size={36} strokeWidth={1.3} />
              </span>
              <span>
                Different ways to express.
                <br />
                The same need to connect.
              </span>
            </Reveal>
            <Reveal paused={paused} delay={0.12} className={s.visionCopy}>
              <p>
                Words are only one way to be heard. SignBridge explores what happens when language
                becomes something you can see, feel, and move through.
              </p>
              <p>
                Our ambition is accessible communication. Our starting point is an honest, working
                prototype, with linguistic review at the center of what comes next.
              </p>
              <Link href="/about" className={s.textLink}>
                The thinking behind SignBridge <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </Reveal>
          </div>
        </section>

        <section id="experience" className={s.experience} aria-labelledby="experience-title">
          <div className={s.sectionLabel}>
            <span>02 / MADE TO EXPLORE</span>
            <span>FROM TEXT TO POSSIBILITY</span>
          </div>
          <Reveal paused={paused} className={s.sectionHeading}>
            <h2 id="experience-title">
              A little curiosity.
              <br />A whole new perspective.
            </h2>
            <p>
              Not just an idea on a slide.
              <br />A workspace you can step into.
            </p>
          </Reveal>
          <div className={s.capabilities}>
            {capabilities.map(({ number, Icon, title, text, label, href, note }, i) => (
              <Reveal paused={paused} delay={i * 0.08} key={number} className={s.capability}>
                <span className={s.capabilityNumber}>
                  {number}
                  <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link href={href}>
                  {label}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </Link>
                <span className={s.capabilityNote}>{note}</span>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="workspace" className={s.workspace} aria-labelledby="workspace-title">
          <div className={s.sectionLabel}>
            <span>03 / INSIDE THE STUDIO</span>
            <span className={s.liveLabel}>
              <span className={s.liveDot} /> LIVE, NOT A VIDEO
            </span>
          </div>
          <Reveal paused={paused} className={s.workspaceHeading}>
            <h2 id="workspace-title">
              See the movement.
              <br />
              <span>Explore the detail.</span>
            </h2>
            <div>
              <p>
                A real rig. A real playback engine.
                <br />
                Space to build something meaningful.
              </p>
              <Link className={s.textLink} href="/studio?mode=lab">
                Open the full workspace <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
          <div ref={preview} className={s.livePreview}>
            {previewVisible ? (
              <LivePreview />
            ) : (
              <div className={s.previewPlaceholder}>Motion workspace</div>
            )}
          </div>
          <div className={s.previewDisclaimer}>
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              These are rig exercises, not ISL signs. Reviewed language and licensed signing assets
              are the next essential step.
            </p>
            <Link href="/about">
              Why this matters <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className={s.principles} aria-labelledby="principles-title">
          <Reveal paused={paused} className={s.principlesIntro}>
            <span className={s.kicker}>A FOUNDATION, WITH INTENTION.</span>
            <h2 id="principles-title">
              Build boldly.
              <br />
              Represent
              <br />
              <span>responsibly.</span>
            </h2>
            <Link href="/about" className={s.textLink}>
              Our approach <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>
          <div className={s.principleList}>
            {[
              [
                'Language is not a lookup.',
                'ISL has its own grammar, expression, and spatial structure. Our pipeline keeps language decisions separate from animation.',
              ],
              [
                'Trust comes from provenance.',
                'Review status, asset availability, and sources remain visible. Unknown phrases get an honest answer, never a made-up sign.',
              ],
              [
                'Access is part of the foundation.',
                'Keyboard navigation, adjustable playback, contrast options, and reduced motion are part of the workspace from day one.',
              ],
            ].map(([title, text], i) => (
              <Reveal paused={paused} key={title} delay={i * 0.08} className={s.principle}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <Check size={20} aria-hidden="true" />
              </Reveal>
            ))}
          </div>
        </section>

        <section id="questions" className={s.questions} aria-labelledby="questions-title">
          <Reveal paused={paused} className={s.questionsIntro}>
            <span className={s.kicker}>THE DETAILS MATTER.</span>
            <h2 id="questions-title">
              Good questions.
              <br />
              Straight answers.
            </h2>
            <Link className={s.textLink} href="/help">
              More help & resources <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>
          <div className={s.accordion}>
            {questions.map(({ title, answer }, i) => (
              <div className={s.question} key={title}>
                <h3>
                  <button
                    aria-expanded={question === i}
                    aria-controls={`answer-${i}`}
                    id={`question-${i}`}
                    onClick={() => setQuestion((open) => (open === i ? null : i))}
                  >
                    <span>{title}</span>
                    <motion.span
                      animate={{ rotate: question === i ? 45 : 0 }}
                      transition={{ duration: paused ? 0 : 0.2 }}
                    >
                      <Plus size={21} />
                    </motion.span>
                  </button>
                </h3>
                <div
                  id={`answer-${i}`}
                  role="region"
                  aria-labelledby={`question-${i}`}
                  hidden={question !== i}
                >
                  <AnimatePresence initial={false}>
                    {question === i && (
                      <motion.p
                        key="answer"
                        initial={paused ? false : { opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: paused ? 0 : 0.25 }}
                      >
                        {answer}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={s.finalCta} aria-labelledby="final-title">
          <Reveal paused={paused}>
            <span className={s.kicker}>A NEW WAY TO CONNECT STARTS HERE.</span>
            <div className={s.finalHeading}>
              <h2 id="final-title">
                SignBridge<span>.</span>
              </h2>
              <Link
                href="/studio"
                className={s.finalArrow}
                aria-label="Enter the SignBridge studio"
              >
                <ArrowUpRight strokeWidth={1.2} aria-hidden="true" />
              </Link>
            </div>
            <div className={s.finalBottom}>
              <p>Bring your curiosity. Explore what&apos;s possible.</p>
              <span>
                OPEN PROTOTYPE <span>/</span> BUILT WITH INTENTION
              </span>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={s.footer}>
        <Link href="/" className={s.logo}>
          <Hand size={22} aria-hidden="true" />
          SignBridge<span className={s.logoDot}>.</span>
        </Link>
        <p>An independent ISL technology project.</p>
        <nav aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Help</Link>
          <a href="#main" aria-label="Back to top">
            <ArrowUpRight size={20} />
          </a>
        </nav>
      </footer>
      <button
        className={s.floatingMotion}
        hidden={heroVisible}
        onClick={toggleMotion}
        aria-label={paused ? 'Enable page animations' : 'Reduce page animations'}
        disabled={!!systemReduced}
        title={
          systemReduced
            ? 'System reduced motion is active'
            : paused
              ? 'Enable page animations'
              : 'Reduce page animations'
        }
      >
        {paused ? <Play size={16} /> : <CirclePause size={17} />}
        <span>{paused ? 'Motion off' : 'Motion on'}</span>
      </button>
    </div>
  );
}
