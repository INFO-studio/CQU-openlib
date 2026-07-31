import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { resolveLucideIconName } from '~/lib/icons';

const REGISTRY_FILE = resolve('app/utils/parser/parserIcon.tsx');

// Read the registry as text: importing it would pull all of lucide-react
// through the transform pipeline for what is otherwise a string check.
const readRegistry = () => {
  const source = readFileSync(REGISTRY_FILE, 'utf8');
  const block = source.match(
    /STATIC_ICONS: Record<string, LucideIcon> = \{([\s\S]*?)\n\};/,
  );
  if (!block) throw new Error('STATIC_ICONS block not found in parserIcon.tsx');
  const keys = [...block[1]!.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*(\w+),/gm)].map(
    ([, key, component]) => ({ key: key!, component: component! }),
  );
  const imported = new Set(
    [...source.matchAll(/^\s{2}(?:type )?(\w+),$/gm)].map((m) => m[1]!),
  );
  return { keys, imported };
};

const iconsUsedIn = (docPath: string): string[] => {
  const source = readFileSync(resolve('public/doc', docPath), 'utf8');
  return [...source.matchAll(/:(l-[a-z0-9-]+):/g)].map((m) => m[1]!);
};

// Full-corpus scanning lives outside the test suite on purpose: reading all
// 4000+ doc files costs tens of seconds. Self-check with
// `rg -oh ':l-[a-z0-9-]+:' public/doc | sort -u`.
describe('doc icon registry', () => {
  const { keys, imported } = readRegistry();

  it('maps every key to an imported component', () => {
    expect(keys.length).toBeGreaterThan(10);
    const unimported = keys.filter(({ component }) => !imported.has(component));
    expect(unimported).toEqual([]);
  });

  it('keys are lucide kebab names, sorted', () => {
    const names = keys.map(({ key }) => key);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(resolveLucideIconName(`l-${name}`)).toBe(name);
    }
    expect(names).toEqual([...names].sort());
  });

  it('registers the icons used by textbook and exam entries', () => {
    const used = new Set([
      ...iconsUsedIn('course/高等数学.md'),
      ...iconsUsedIn('course/泌尿系统与疾病.md'),
      ...iconsUsedIn('academic/专业总览/数统/数统教材.md'),
    ]);
    expect(used.size).toBeGreaterThan(5);
    const registered = new Set(keys.map(({ key }) => key));
    const missing = [...used].filter(
      (shortname) => !registered.has(resolveLucideIconName(shortname) ?? ''),
    );
    expect(missing).toEqual([]);
  });
});
