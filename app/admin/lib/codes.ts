const ALNUM = '0123456789abcdefghijklmnopqrstuvwxyz';

export const randomLocalCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => ALNUM[byte % 36] ?? '0').join('');
};

export const canonicalLocalCode = (raw: string): string | null => {
  const code = raw.trim().toLowerCase();
  return /^[0-9a-z]{8}$/.test(code) ? code : null;
};

export const canonicalGroupCode = (raw: string): string | null => {
  const code = raw.trim().toLowerCase();
  return /^[0-9a-z]{4}$/.test(code) ? code : null;
};
