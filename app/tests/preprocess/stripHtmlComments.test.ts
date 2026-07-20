import { describe, expect, it } from 'vite-plus/test';
import preprocess from '~/utils/preprocess';

describe('stripHtmlComments', () => {
  it('removes HTML comments before other preprocess', () => {
    const out = preprocess(
      '# Hi\n\n<!--\n!!! abstract "临近课程"\n-->\n\n## Next\n',
    );
    expect(out).not.toContain('临近课程');
    expect(out).not.toContain('-->');
    expect(out).toContain('## Next');
  });
});
