'use client';
import '@fontsource-variable/manrope';
import './studio.css';
import './workspace.css';
import './cinematic.css';
import './continuum-foundation.css';
import './continuum-pages.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Hand,
  LayoutDashboard,
  Languages,
  History,
  Bookmark,
  BookOpen,
  Settings2,
  HelpCircle,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  CirclePause,
  Play,
  FlaskConical,
} from 'lucide-react';
import { useRemote, useApp, Tip, useInterfaceReducedMotion } from './providers';
const nav = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { href: '/studio', label: 'Translation studio', Icon: Languages },
  { href: '/review', label: 'Review evidence', Icon: FlaskConical },
  { href: '/history', label: 'History', Icon: History },
  { href: '/favorites', label: 'Saved phrases', Icon: Bookmark },
  { href: '/library', label: 'Learn & explore', Icon: BookOpen },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return <>{children}</>;
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { preferences, preferencesReady, setPreferences } = useApp();
  const reduced = useInterfaceReducedMotion();
  const [open, setOpen] = useState(false);
  const health = useRemote<{ storage: string; status: string }>('/api/health');
  const items = (
    <>
      <Link href="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-mark">
          <Hand size={23} />
        </span>
        <span>
          SignBridge<span className="brand-small">LANGUAGE IN MOTION</span>
        </span>
      </Link>
      <div className="nav-heading">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {nav.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${pathname === href ? 'active' : ''}`}
            aria-current={pathname === href ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={19} />
            {label}
            {pathname === href && (
              <motion.span
                className="active-dot"
                layoutId="active-route"
                transition={{ duration: reduced ? 0 : 0.35 }}
              />
            )}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link
          className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
          href="/settings"
          onClick={() => setOpen(false)}
        >
          <Settings2 size={18} />
          Settings
        </Link>
        <Link
          className={`nav-link ${pathname === '/help' ? 'active' : ''}`}
          href="/help"
          onClick={() => setOpen(false)}
        >
          <HelpCircle size={18} />
          Help & resources
          <ArrowUpRight size={14} />
        </Link>
        <div className="storage-status">
          <span className={`status-dot ${health.error ? 'bad' : ''}`} />
          <div>
            <strong>
              {health.error
                ? 'Storage unavailable'
                : health.data?.storage === 'postgresql'
                  ? 'PostgreSQL connected'
                  : 'Local development'}
            </strong>
            <span>
              {health.error ? 'Check server configuration' : 'Guest workspace · no account'}
            </span>
          </div>
        </div>
        <div className="legal-links">
          <Link href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
            About
          </Link>
          <Link href="/privacy" aria-current={pathname === '/privacy' ? 'page' : undefined}>
            Privacy
          </Link>
        </div>
      </div>
    </>
  );
  return (
    <div
      data-experience="cinematic"
      className={
        pathname === '/studio'
          ? 'workspace-shell continuum-shell studio-shell'
          : 'workspace-shell continuum-shell'
      }
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <LayoutGroup id="desktop-navigation">{items}</LayoutGroup>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-leading">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button className="icon-button mobile-menu" aria-label="Open navigation">
                  <Menu size={20} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="mobile-sidebar">
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    SignBridge workspace pages
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button className="drawer-close icon-button" aria-label="Close navigation">
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                  <LayoutGroup id="mobile-navigation">{items}</LayoutGroup>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="topbar-path">
              Workspace <span>/</span>{' '}
              <strong>
                {nav.find((n) => n.href === pathname)?.label ||
                  pathname.split('/')[1]?.replaceAll('-', ' ')}
              </strong>
            </span>
          </div>
          <div className="topbar-end">
            <Tip
              label={
                preferences.reducedMotion ? 'Enable interface motion' : 'Reduce interface motion'
              }
            >
              <button
                className="icon-button studio-motion-toggle"
                disabled={!preferencesReady}
                aria-label={
                  pathname === '/studio'
                    ? 'Reduce studio interface motion'
                    : 'Reduce workspace interface motion'
                }
                aria-pressed={preferences.reducedMotion}
                onClick={() => setPreferences({ reducedMotion: !preferences.reducedMotion })}
              >
                {preferences.reducedMotion ? <Play size={17} /> : <CirclePause size={18} />}
              </button>
            </Tip>
            <span className="demo-indicator">
              <span /> Demonstration workspace
            </span>
            <Link href="/about" className="profile" aria-label="About this guest workspace">
              SB
            </Link>
          </div>
        </header>
        <motion.main
          id="main"
          className="main"
          key={pathname}
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.main>
        <footer className="app-footer">
          <ShieldCheck size={14} />
          <span>No reviewed ISL motions are included.</span>
          <Link href="/about">
            Asset provenance <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
