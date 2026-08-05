import { apiUrl } from '~/lib/apiBase';

const ENDPOINT = apiUrl('/log');
const SID_STORAGE_KEY = 'cqu-openlib:sid';
const FLUSH_DELAY_MS = 3000;
const MAX_BATCH = 20;

export type LogKey = 'page_enter' | 'item_click' | 'search' | 'doc_error';

export type LogParams = Record<string, string | number | boolean | undefined>;

type Pending = {
  key: LogKey;
  params: LogParams;
  at: number;
};

const buffer: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let currentPath = '';
let previousPath = '';
let sid = '';

const randomId = (): string => {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch {
    // `crypto.randomUUID` is missing outside secure contexts.
    return Math.random().toString(36).slice(2, 14);
  }
};

/**
 * A random string scoped to this browser tab. It carries no device or network
 * information and dies with the tab; it exists only so sessions and bounce
 * rate are computable at all.
 */
const sessionId = (): string => {
  if (sid) return sid;
  try {
    const stored = sessionStorage.getItem(SID_STORAGE_KEY);
    if (stored) {
      sid = stored;
      return sid;
    }
    sid = randomId();
    sessionStorage.setItem(SID_STORAGE_KEY, sid);
  } catch {
    // Storage blocked: an in-memory id still holds for this page load.
    sid = randomId();
  }
  return sid;
};

const send = (payload: string, viaBeacon: boolean): void => {
  // `text/plain` keeps this a CORS-simple request. With `application/json` the
  // browser would preflight, doubling the serverless invocations per flush.
  if (viaBeacon && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon(ENDPOINT, blob)) return;
  }
  void fetch(ENDPOINT, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    keepalive: true,
  }).catch(() => {
    // Losing analytics is always preferable to surfacing an error.
  });
};

const flush = (viaBeacon = false): void => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  const sentAt = Date.now();
  do {
    const batch = buffer.splice(0, MAX_BATCH);
    if (!batch.length) return;
    send(
      JSON.stringify({
        sid: sessionId(),
        events: batch.map((item) => ({
          key: item.key,
          params: item.params,
          // Elapsed time, not a wall clock: the server rebuilds the timestamp
          // from its own clock so a wrong device date cannot skew reports.
          dt: sentAt - item.at,
        })),
      }),
      viaBeacon,
    );
    // A page being torn down gets no second chance, so drain it completely.
  } while (viaBeacon && buffer.length);

  if (buffer.length) schedule();
};

const schedule = (): void => {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_DELAY_MS);
};

const listen = (): void => {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  // `visibilitychange` is the one signal mobile browsers reliably deliver;
  // `unload` is routinely skipped when a tab is swiped away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
};

/**
 * Records one event. Never throws, never retries, never blocks: a broken
 * endpoint must be invisible to the reader.
 */
export const log = (key: LogKey, params: LogParams = {}): void => {
  // The maintainer console is our own tooling; counting it would inflate
  // every number on the dashboard it feeds.
  if (currentPath.startsWith('/admin')) return;

  const merged: LogParams = { page_path: currentPath, ...params };
  for (const name of Object.keys(merged)) {
    if (merged[name] === undefined) delete merged[name];
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', key, merged);
    return;
  }

  buffer.push({ key, params: merged, at: Date.now() });
  listen();
  if (buffer.length >= MAX_BATCH) flush();
  else schedule();
};

/**
 * Marks a page view and rebases the path that later events are attributed to.
 *
 * Repeat calls for the same path collapse into one, so it does not matter
 * whether the router or the initial bootstrap reports a given navigation
 * first, and anchor-only jumps never register as a new view.
 */
export const trackPageEnter = (path: string): void => {
  const from = currentPath;
  if (path === from) return;
  previousPath = from;
  currentPath = path;
  log('page_enter', { enter_from: from || undefined });
};

/** The page the reader came from, or undefined if they landed here directly. */
export const enterFrom = (): string | undefined => previousPath || undefined;

export type ItemClick = { item_type: string } & LogParams;

export const trackItemClick = (info: ItemClick): void => {
  log('item_click', info);
};
