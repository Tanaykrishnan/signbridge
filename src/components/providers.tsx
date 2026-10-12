'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, MotionConfig, AnimatePresence } from 'motion/react';
import { z } from 'zod';

const preferencesSchema = z.object({
  speed: z.number().refine((n) => [0.5, 0.75, 1, 1.25].includes(n)),
  theme: z.enum(['dark', 'light']),
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  largeText: z.boolean(),
});
type Preferences = {
  speed: number;
  theme: 'dark' | 'light';
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
};
const defaults: Preferences = {
  speed: 1,
  theme: 'dark',
  reducedMotion: false,
  highContrast: false,
  largeText: false,
};
const Context = createContext<{
  preferences: Preferences;
  preferencesReady: boolean;
  setPreferences: (p: Partial<Preferences>) => void;
  notify: (message: string, error?: boolean) => void;
}>({ preferences: defaults, preferencesReady: false, setPreferences: () => {}, notify: () => {} });
export function Providers({ children }: { children: ReactNode }) {
  const [preferences, setPrefs] = useState(defaults);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sb-preferences') || 'null');
      const parsed = preferencesSchema.safeParse({ ...defaults, ...stored });
      if (stored && parsed.success) setPrefs(parsed.data);
      else if (matchMedia('(prefers-reduced-motion: reduce)').matches)
        setPrefs((p) => ({ ...p, reducedMotion: true }));
    } catch {
    } finally {
      setPreferencesReady(true);
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.contrast = String(preferences.highContrast);
    document.documentElement.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.text = preferences.largeText ? 'large' : 'normal';
  }, [preferences]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const setPreferences = useCallback(
    (p: Partial<Preferences>) =>
      setPrefs((prev) => {
        const next = { ...prev, ...p };
        try {
          localStorage.setItem('sb-preferences', JSON.stringify(next));
        } catch {
          /* Preferences still work when browser storage is disabled. */
        }
        return next;
      }),
    [],
  );
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  return (
    <Context.Provider value={{ preferences, preferencesReady, setPreferences, notify }}>
      <MotionConfig reducedMotion={preferences.reducedMotion ? 'always' : 'user'}>
        <Tooltip.Provider delayDuration={300}>
          {children}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className={`toast ${toast.error ? 'error' : ''}`}
                role={toast.error ? 'alert' : 'status'}
              >
                {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span>{toast.message}</span>
                <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Tooltip.Provider>
      </MotionConfig>
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
function subscribeSystemMotion(callback: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
const systemMotionSnapshot = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotionSnapshot = () => false;
export function useInterfaceReducedMotion() {
  const { preferences } = useApp();
  // Use the same server/client snapshot during hydration, then subscribe to the OS setting.
  const system = useSyncExternalStore(
    subscribeSystemMotion,
    systemMotionSnapshot,
    serverMotionSnapshot,
  );
  return preferences.reducedMotion || system;
}
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={7}>
          {label}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data as T;
}
export function useRemote<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    request<T>(url, { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [url, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
