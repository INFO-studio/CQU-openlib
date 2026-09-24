import { describe, expect, it } from 'vite-plus/test';
import { placeholderMap } from '~/utils/placeholderMap';
import { buildSearchRecords, searchMetadata } from '../../vite/searchContent';

const doc = {
  title: '课程A',
  path: '/course/A',
  section: 'course',
  sectionLabel: '课程',
  codes: ['B1'],
};

describe('search content', () => {
  it('only indexes explicit search metadata and never indexes the template', () => {
    const markdown =
      '---\nplaceholder: course\nupdated: 2099-01-01\nsearch:\n  keywords: [自定义别名]\n  codes: [B2, B3]\n---\n';
    const records = buildSearchRecords(doc, markdown);
    expect(records).toHaveLength(1);
    expect(records[0].content).toContain('课程A');
    expect(records[0].content).toContain('自定义别名');
    expect(searchMetadata(markdown).codes).toEqual(['B2', 'B3']);
    for (const excluded of [
      'placeholder',
      'updated',
      '2099-01-01',
      '本门课程需要',
      'keywords',
    ]) {
      expect(records[0].content).not.toContain(excluded);
    }
  });

  it('indexes authored text without template or URL blacklists', () => {
    const html = buildSearchRecords(
      doc,
      `${placeholderMap.course}\n已知教材：概率论`,
    )[0].content;
    expect(html).toContain('概率论');
    expect(html).toContain('本门课程需要');
    expect(html).toContain('https://github.com/INFO-studio/CQU-openlib');
  });

  it('indexes every tab and admonition, not icons or link destinations', () => {
    const markdown =
      '## 资源\n\n=== "第一页"\n\n    * [教材](https://example.invalid/private-file-key) - :l-book-open:`甲教材`\n\n=== "第二页"\n\n    !!! info "阴文革"\n\n        第二页正文\n\n<!-- 秘密注释 -->\n';
    const html = buildSearchRecords(doc, markdown)[0].content;
    for (const text of ['甲教材', '阴文革', '第二页正文'])
      expect(html).toContain(text);
    for (const text of ['private-file-key', 'l-book-open', '秘密注释'])
      expect(html).not.toContain(text);
  });

  it('splits long pages at existing heading anchors and only pins the root record', () => {
    const records = buildSearchRecords(
      doc,
      `## 第一节\n${'知识内容。'.repeat(1000)}\n\n## 第二节\n${'其他内容。'.repeat(1000)}`,
    );
    expect(records.map((record) => record.url)).toEqual([
      '/course/A',
      '/course/A#第一节',
      '/course/A#第二节',
    ]);
    expect(
      records.every(
        (record) => !record.content.includes('data-pagefind-filter'),
      ),
    ).toBe(true);
  });

  it('rejects malformed metadata rather than silently losing search terms', () => {
    expect(() => searchMetadata('---\nsearch:\n  codes: B2\n---')).toThrow(
      '字符串数组',
    );
    expect(() => searchMetadata('---\nplaceholder: typo\n---')).toThrow(
      'placeholder',
    );
  });
});
