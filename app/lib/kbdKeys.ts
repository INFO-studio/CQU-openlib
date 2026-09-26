const KEY_LABELS: Record<string, string> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Option',
  opt: 'Option',
  shift: 'Shift',
  cmd: 'Cmd',
  command: 'Cmd',
  win: 'Win',
  windows: 'Win',
  meta: 'Meta',
  super: 'Super',
  spc: 'Space',
  space: 'Space',
  enter: 'Enter',
  return: 'Return',
  tab: 'Tab',
  esc: 'Esc',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Del',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  'page-up': 'PgUp',
  pageup: 'PgUp',
  'page-down': 'PgDn',
  pagedown: 'PgDn',
  plus: '+',
  minus: '−',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  'arrow-up': '↑',
  'arrow-down': '↓',
  'arrow-left': '←',
  'arrow-right': '→',
};

export const kbdKeyLabel = (raw: string): string => {
  if (raw.length === 1) return raw.toUpperCase();
  const lower = raw.toLowerCase();
  if (KEY_LABELS[lower]) return KEY_LABELS[lower]!;
  return raw
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export const splitKbdTokens = (inner: string): string[] =>
  [...inner.matchAll(/"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+)/g)].map(
    (matched) => matched[1] ?? matched[2] ?? matched[3]!,
  );
