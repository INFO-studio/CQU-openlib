import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { mirrorDocMarkdown, resolveDocFile } from '../../vite/doc-markdown';

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'doc-md-'));
  temps.push(dir);
  return dir;
};

describe('resolveDocFile', () => {
  it('resolves leaf .md and folder index via /path.md alias', () => {
    const root = tempDir();
    mkdirSync(join(root, 'academic'), { recursive: true });
    writeFileSync(join(root, 'academic', 'index.md'), '# 学业\n');
    writeFileSync(join(root, 'standalone.md'), '# 单页\n');

    expect(
      resolveDocFile(root, '/standalone.md')?.endsWith('standalone.md'),
    ).toBe(true);
    expect(
      resolveDocFile(root, '/academic.md')?.endsWith(
        join('academic', 'index.md'),
      ),
    ).toBe(true);
    expect(
      resolveDocFile(root, '/academic/index.md')?.endsWith(
        join('academic', 'index.md'),
      ),
    ).toBe(true);
    expect(resolveDocFile(root, '/missing.md')).toBeNull();
  });

  it('serves /doc/ verbatim, without the folder alias production lacks', () => {
    const root = tempDir();
    mkdirSync(join(root, 'academic'), { recursive: true });
    writeFileSync(join(root, 'academic', 'index.md'), '# 学业\n');

    expect(
      resolveDocFile(root, '/doc/academic/index.md')?.endsWith(
        join('academic', 'index.md'),
      ),
    ).toBe(true);
    expect(resolveDocFile(root, '/doc/academic.md')).toBeNull();
  });
});

describe('mirrorDocMarkdown', () => {
  it('emits folder index.md and a sibling path.md alias', () => {
    const src = tempDir();
    const dest = tempDir();
    mkdirSync(join(src, 'academic'), { recursive: true });
    writeFileSync(join(src, 'academic', 'index.md'), '# 学业\n');
    writeFileSync(join(src, 'standalone.md'), '# 单页\n');
    writeFileSync(join(src, 'index.md'), '# 首页\n');

    mirrorDocMarkdown(src, dest);

    expect(readFileSync(join(dest, 'academic', 'index.md'), 'utf8')).toContain(
      '学业',
    );
    expect(readFileSync(join(dest, 'academic.md'), 'utf8')).toContain('学业');
    expect(readFileSync(join(dest, 'standalone.md'), 'utf8')).toContain('单页');
    expect(readFileSync(join(dest, 'index.md'), 'utf8')).toContain('首页');
  });
});
