'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, BrainCircuit, FileText, Hand, ShieldCheck } from 'lucide-react';
import s from './landing.module.css';

const chapters = [
  {
    Icon: FileText,
    title: 'Intent',
    label: '01 / ENGLISH INPUT',
    heading: 'A thought, in your words.',
    copy: 'A question, a short sentence, or a paragraph. Your original text stays visible throughout the workspace.',
    href: '/studio',
    action: 'Compose in the studio',
  },
  {
    Icon: BrainCircuit,
    title: 'Language',
    label: '02 / LANGUAGE PROCESSING',
    heading: 'Meaning before movement.',
    copy: 'Local English paraphrasing is separate from the experimental ISL gloss planner. A simpler sentence is not, by itself, a sign-language translation.',
    href: '/language-lab',
    action: 'Open the language lab',
  },
  {
    Icon: Hand,
    title: 'Motion',
    label: '03 / SIGN MOTION',
    heading: 'Language becomes spatial.',
    copy: 'The optional research decoder reconstructs supported sign motions. The articulated avatar makes those movements inspectable in three dimensions.',
    href: '/studio',
    action: 'Explore the signing stage',
  },
  {
    Icon: ShieldCheck,
    title: 'Evidence',
    label: '04 / REVIEW & PROVENANCE',
    heading: 'Every motion accountable.',
    copy: 'Sources, vocabulary limits and review status travel with the output. Generated motion is experimental until its meaning and rendering receive expert validation.',
    href: '/review',
    action: 'Inspect the evidence',
  },
];

export default function PipelineStory({ paused }: { paused: boolean }) {
  const [selected, setSelected] = useState(0);
  const chapter = chapters[selected];
  return (
    <section className={s.pipelineStory} aria-labelledby="pipeline-story-title">
      <div className={s.sectionLabel}>
        <span>THE LANGUAGE / MOTION PIPELINE</span>
        <span>FOUR CONNECTED LAYERS</span>
      </div>
      <div className={s.pipelineComposition}>
        <h2 id="pipeline-story-title">
          From intent.
          <br />
          <span>To movement.</span>
        </h2>
        <div className={s.pipelineInterface}>
          <div className={s.pipelineTabs} role="tablist" aria-label="Language pipeline">
            {chapters.map(({ Icon, title }, index) => (
              <button
                key={title}
                role="tab"
                id={`chapter-${index}`}
                aria-controls="chapter-panel"
                aria-selected={selected === index}
                tabIndex={selected === index ? 0 : -1}
                onClick={() => setSelected(index)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % 4
                      : event.key === 'ArrowLeft'
                        ? (index + 3) % 4
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? 3
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    setSelected(next);
                    document.getElementById(`chapter-${next}`)?.focus();
                  }
                }}
              >
                <Icon size={21} aria-hidden="true" />
                <span>{title}</span>
                {selected === index && (
                  <motion.i
                    layoutId="pipeline-story-active"
                    transition={{ duration: paused ? 0 : 0.35 }}
                  />
                )}
              </button>
            ))}
          </div>
          <div
            id="chapter-panel"
            role="tabpanel"
            aria-labelledby={`chapter-${selected}`}
            tabIndex={0}
            className={s.chapterPanel}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                initial={paused ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: paused ? 0 : -8 }}
                transition={{ duration: paused ? 0 : 0.22 }}
              >
                <span className={s.kicker}>{chapter.label}</span>
                <h3>{chapter.heading}</h3>
                <p>{chapter.copy}</p>
                <Link className={s.textLink} href={chapter.href}>
                  {chapter.action}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
