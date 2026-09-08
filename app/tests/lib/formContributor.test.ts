import { describe, expect, it } from 'vite-plus/test';
import {
  CONTRIBUTOR_DEFAULTS,
  toContributorPayload,
} from '../../lib/formContributor';

describe('toContributorPayload', () => {
  it('keeps introductions for every contributor block', () => {
    expect(
      toContributorPayload(
        {
          ...CONTRIBUTOR_DEFAULTS,
          credit: '  contributor  ',
          introKind: 'text',
          introText: '  personal intro  ',
          canContact: 'no',
        },
        { showAuthorCredit: false },
      ),
    ).toMatchObject({
      credit: 'contributor',
      introKind: 'text',
      introText: 'personal intro',
    });
  });
});
