/**
 * Display labels for pymdownx.keys shortcodes used in this corpus
 * (and common modifiers). Unknown ids fall back to Title Case.
 */
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

/** Split `ctrl+alt+"My Key"` into raw key tokens. */
export const splitKbdTokens = (inner: string): string[] => {
  const tokens: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|([A-Za-z0-9_.-]+)/g;
  let m = re.exec(inner);
  while (m) {
    tokens.push(m[1] ?? m[2] ?? m[3]!);
    m = re.exec(inner);
  }
  return tokens;
};
