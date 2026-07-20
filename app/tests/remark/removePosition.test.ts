import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import removePosition from '~/utils/remark/removePosition';

describe('removePosition', () => {
  it('strips position fields recursively', () => {
    const input = {
      type: 'root',
      position: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
      children: [
        {
          type: 'paragraph',
          position: {
            start: { line: 1, column: 1 },
            end: { line: 1, column: 2 },
          },
          children: [
            {
              type: 'text',
              value: 'hi',
              position: {
                start: { line: 1, column: 1 },
                end: { line: 1, column: 3 },
              },
            },
          ],
        },
      ],
    } as unknown as MnRoot;

    expect(removePosition(input)).toEqual({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'hi' }],
        },
      ],
    });
  });
});
