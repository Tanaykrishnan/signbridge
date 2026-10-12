'use client';

import '@fontsource-variable/manrope';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Menu,
  MoveUpRight,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { useInterfaceReducedMotion } from '@/components/providers';
import s from './experience.module.css';

const Scene = dynamic(() => import('./continuum-scene'), { ssr: false });
const chapters = ['Beginning', 'Language', 'Movement', 'Possibility', 'Your turn'];
const ids = ['beginning', 'language', 'movement', 'possibility', 'your-turn'];
const forms = [
  '01 / ENTANGLED',
  '02 / SIGNAL',
  '03 / EXPRESSION',
  '04 / CONNECTION',
  '05 / CONTINUUM',
];

function Reveal({
  children,
  className,
  reduced,
}: {
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { y: 35, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduced ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Landing() {
  const reduced = useInterfaceReducedMotion();
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [question, setQuestion] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; rotation: number } | null>(null);
  const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end end'] });
  const background = useTransform(
    scrollYProgress,
    [0, 0.32, 0.41, 0.84, 0.92, 1],
    ['#f1f2eb', '#f1f2eb', '#171a17', '#171a17', '#eceee6', '#eceee6'],
  );
  const still = paused || reduced;
  const onReady = useCallback(() => setReady(true), []);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setChapter(Math.min(4, Math.round(p * 4))));
  useEffect(() => {
    const update = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const dark = chapter === 2 || chapter === 3;

  return (
    <div
      ref={root}
      className={s.experience}
      data-dark={dark}
      data-paused={still}
      data-chapter={chapter}
    >
      <a className={s.skip} href="#main">
        Skip to content
      </a>
      <motion.div className={s.backdrop} style={{ background }} aria-hidden="true" />
      <div
        className={s.scene}
        data-testid="hero-art"
        data-ready={ready}
        onPointerDown={(event) => {
          if (event.button !== 0 || event.pointerType === 'touch') return;
          drag.current = { x: event.clientX, rotation };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setRotation(drag.current.rotation + (event.clientX - drag.current.x) * 0.007);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <Scene
          progress={scrollYProgress}
          paused={still}
          active={active}
          rotation={rotation}
          onReady={onReady}
        />
        {!ready && (
          <div className={s.loading} role="status">
            <span />
            Preparing the experience
          </div>
        )}
      </div>
      <header className={s.header}>
        <Link href="/" className={s.logo} aria-label="SignBridge home">
          <AudioLines size={27} strokeWidth={2.2} />
          SignBridge<span className={s.logoMark}>/</span>
        </Link>
        <nav className={s.nav} aria-label="Homepage navigation">
          <a href="#language">The idea</a>
          <a href="#movement">The experience</a>
          <a href="#possibility">The possibilities</a>
        </nav>
        <div className={s.headerRight}>
          <Link href="/studio" className={s.headerCta}>
            Open studio
            <ArrowUpRight size={17} />
          </Link>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <button className={s.menuToggle} aria-label="Open homepage navigation">
                <Menu size={23} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className={s.menuOverlay} />
              <Dialog.Content className={s.menu}>
                <Dialog.Title>Explore SignBridge</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Jump to a chapter or enter the translation studio.
                </Dialog.Description>
                <Dialog.Close asChild>
                  <button aria-label="Close homepage navigation">
                    <X />
                  </button>
                </Dialog.Close>
                <nav>
                  {chapters.map((label, i) => (
                    <a key={label} href={`#${ids[i]}`} onClick={() => setMenuOpen(false)}>
                      <small>0{i + 1}</small>
                      {label}
                      <ArrowUpRight />
                    </a>
                  ))}
                  <Link href="/studio">
                    Open studio
                    <ArrowUpRight />
                  </Link>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>

      <aside className={s.chapterNav} aria-label="Page chapters">
        {chapters.map((label, i) => (
          <a
            key={label}
            href={`#${ids[i]}`}
            aria-label={`Chapter ${i + 1}: ${label}`}
            aria-current={chapter === i ? 'step' : undefined}
          >
            <span>{label}</span>
            <i />
          </a>
        ))}
      </aside>
      <div className={s.sceneFooter}>
        <span className={s.formLabel}>
          {forms[chapter]}
          <small>Original kinetic sculpture</small>
        </span>
        <div className={s.sceneControls}>
          <button
            onClick={() => setRotation((r) => r - 0.35)}
            aria-label="Rotate sculpture left"
            title="Rotate sculpture left"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => setRotation(0)}
            aria-label="Reset sculpture"
            title="Reset sculpture"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={() => setRotation((r) => r + 0.35)}
            aria-label="Rotate sculpture right"
            title="Rotate sculpture right"
          >
            <ChevronRight size={17} />
          </button>
          <span />
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={still ? 'Resume page motion' : 'Pause page motion'}
            aria-pressed={still}
            title={
              reduced
                ? 'Reduced motion is enabled in your preferences'
                : still
                  ? 'Resume page motion'
                  : 'Pause page motion'
            }
            disabled={reduced}
          >
            {still ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
      </div>
      <main id="main" className={s.main}>
        <section id="beginning" className={`${s.section} ${s.hero}`} aria-labelledby="hero-title">
          <div className={s.heroMeta}>
            <span>
              <i />
              LANGUAGE. REIMAGINED.
            </span>
            <span>AN INDEPENDENT ISL PROJECT / 2026</span>
          </div>
          <Reveal reduced={still} className={s.heroCopy}>
            <p className={s.kicker}>A DIFFERENT WAY TO CONNECT</p>
            <h1 id="hero-title">
              SignBridge<span>.</span>
            </h1>
            <p className={s.heroStatement}>
              Understanding,
              <br />
              in a new dimension.
            </p>
            <p className={s.body}>
              From the words we write to the way we express them. Explore language through movement.
            </p>
            <div className={s.actions}>
              <Link href="/studio" className={s.primary}>
                Step into the studio
                <ArrowUpRight size={20} />
              </Link>
              <a href="#language" className={s.textLink}>
                Discover the idea
                <ArrowDown size={17} />
              </a>
            </div>
            <p className={s.footnote}>Open prototype. No account needed.</p>
          </Reveal>
          <div className={s.heroBottom}>
            <a href="#language">
              <ArrowDown size={18} />
              SCROLL TO UNFOLD
            </a>
            <span>Text. Thought. Expression.</span>
            <span>01 / 05</span>
          </div>
        </section>

        <section
          id="language"
          className={`${s.section} ${s.right}`}
          aria-labelledby="language-title"
        >
          <div className={s.sectionIndex}>
            <span>01 / THE IDEA</span>
            <span>LANGUAGE STARTS WITH INTENT</span>
          </div>
          <Reveal reduced={still} className={s.sectionCopy}>
            <span className={s.kicker}>THERE IS MORE THAN ONE WAY TO BE HEARD.</span>
            <h2 id="language-title">
              A thought.
              <br />A connection.
              <br />
              <em>A possibility.</em>
            </h2>
            <p className={s.body}>
              A sentence carries more than words. SignBridge brings English paraphrasing,
              sign-language research and expressive 3D motion into one workspace.
            </p>
            <Link href="/studio" className={s.lineLink}>
              <span>Start with your words</span>
              <ArrowUpRight size={21} />
            </Link>
            <div className={s.smallNote}>
              <span>01</span>
              <p>
                ISL is a language of its own, with grammar, expression and spatial meaning. That is
                where our research begins.
              </p>
            </div>
          </Reveal>
        </section>

        <section
          id="movement"
          className={`${s.section} ${s.left} ${s.darkCopy}`}
          aria-labelledby="movement-title"
        >
          <div className={s.sectionIndex}>
            <span>02 / THE EXPERIENCE</span>
            <span>GET CLOSER TO EXPRESSION</span>
          </div>
          <Reveal reduced={still} className={s.sectionCopy}>
            <span className={s.kicker}>SPACE TO SEE EVERY DETAIL</span>
            <h2 id="movement-title">
              Language
              <br />
              takes <em>shape.</em>
            </h2>
            <p className={s.body}>
              A motion you can slow down. A gesture you can inspect. A new perspective on every
              sequence, inside a real 3D studio.
            </p>
            <div className={s.featureRows}>
              <Link href="/studio?mode=lab">
                <span aria-hidden="true">01</span>
                <strong>Explore the motion lab</strong>
                <MoveUpRight size={20} />
              </Link>
              <Link href="/studio">
                <span aria-hidden="true">02</span>
                <strong>Enter the ISL workspace</strong>
                <MoveUpRight size={20} />
              </Link>
              <Link href="/library">
                <span aria-hidden="true">03</span>
                <strong>Discover the phrase library</strong>
                <MoveUpRight size={20} />
              </Link>
            </div>
          </Reveal>
        </section>

        <section
          id="possibility"
          className={`${s.section} ${s.right} ${s.darkCopy}`}
          aria-labelledby="possibility-title"
        >
          <div className={s.sectionIndex}>
            <span>03 / THE POSSIBILITIES</span>
            <span>CURIOUS BY DESIGN</span>
          </div>
          <Reveal reduced={still} className={s.sectionCopy}>
            <span className={s.kicker}>BUILT TO EXPLORE. OPEN TO WHAT COMES NEXT.</span>
            <h2 id="possibility-title">
              Make room
              <br />
              for <em>more.</em>
            </h2>
            <p className={s.body}>
              Refine an idea with local AI. Explore experimental ISL motion. Save the phrases that
              matter and return to the conversation.
            </p>
            <Link href="/review" className={s.lineLink}>
              <span>See the project in depth</span>
              <ArrowUpRight size={21} />
            </Link>
            <div className={s.researchNote}>
              <span className={s.researchLabel}>RESEARCH, IN PROGRESS</span>
              <p>
                ISL output is experimental and has not been verified by fluent ISL reviewers.
                Vocabulary coverage and motion quality remain active areas of development.
              </p>
            </div>
          </Reveal>
        </section>

        <section
          id="your-turn"
          className={`${s.section} ${s.finale}`}
          aria-labelledby="final-title"
        >
          <div className={s.sectionIndex}>
            <span>04 / YOUR TURN</span>
            <span>LET THE CONVERSATION CONTINUE</span>
          </div>
          <Reveal reduced={still} className={s.sectionCopy}>
            <span className={s.kicker}>EVERY CONNECTION STARTS SOMEWHERE.</span>
            <h2 id="final-title">
              Your words.
              <br />
              <em>New possibilities.</em>
            </h2>
            <Link href="/studio" className={`${s.primary} ${s.finalButton}`}>
              Open SignBridge
              <ArrowUpRight size={23} />
            </Link>
            <div className={s.faq}>
              {[
                [
                  'What can I try today?',
                  'Local English paraphrasing, experimental ISL motion for supported vocabulary, a 3D motion lab, phrase search, history and favorites.',
                ],
                [
                  'Can it translate any sentence accurately?',
                  'No. The ISL planner and motion generation are research prototypes. Unknown vocabulary is reported, and fluent ISL evaluation is still required.',
                ],
                [
                  'Do I need an account?',
                  'No. You can explore the local prototype with a guest session. History and favorites are associated with your guest cookie.',
                ],
              ].map(([title, answer], i) => (
                <div key={title}>
                  <h3>
                    <button
                      onClick={() => setQuestion(question === i ? null : i)}
                      aria-expanded={question === i}
                      aria-controls={`landing-answer-${i}`}
                    >
                      {title}
                      <Plus
                        size={17}
                        style={{ transform: question === i ? 'rotate(45deg)' : undefined }}
                      />
                    </button>
                  </h3>
                  <div id={`landing-answer-${i}`} hidden={question !== i}>
                    <p>{answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <footer className={s.footer}>
            <Link href="/" className={s.logo}>
              <AudioLines size={24} />
              SignBridge.
            </Link>
            <span>Language in motion.</span>
            <nav aria-label="Footer navigation">
              <Link href="/about">About</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/help">Help</Link>
              <a href="#beginning" aria-label="Back to top">
                <ArrowRight size={19} className={s.upArrow} />
              </a>
            </nav>
          </footer>
        </section>
      </main>
      <motion.div className={s.progress} style={{ scaleX: scrollYProgress }} aria-hidden="true" />
    </div>
  );
}
