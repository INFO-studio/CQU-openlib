import { describe, expect, it } from 'vite-plus/test';
import {
  counterpart,
  type EmailSummary,
  formatBytes,
  parseAddress,
  replySubject,
} from '~/admin/lib/emails';

const summary = (over: Partial<EmailSummary>): EmailSummary => ({
  id: 'e1',
  direction: 'inbound',
  from: 'someone@example.com',
  to: ['contact@cqu-openlib.cn'],
  subject: '反馈',
  preview: '',
  attachmentCount: 0,
  createdAt: '2026-08-01T12:00:00.000Z',
  notifiedAt: null,
  notifyError: null,
  ...over,
});

describe('parseAddress', () => {
  it('splits a display name from the address', () => {
    expect(parseAddress('张三 <zhang@example.com>')).toEqual({
      name: '张三',
      address: 'zhang@example.com',
    });
  });

  it('drops the quotes around a quoted display name', () => {
    expect(parseAddress('"Zhang, San" <zhang@example.com>').name).toBe(
      'Zhang, San',
    );
  });

  it('keeps a bare address as-is', () => {
    expect(parseAddress('  zhang@example.com ')).toEqual({
      name: '',
      address: 'zhang@example.com',
    });
  });
});

describe('counterpart', () => {
  it('is the sender for inbound mail', () => {
    expect(counterpart(summary({ from: 'Ann <ann@example.com>' }))).toBe(
      'ann@example.com',
    );
  });

  it('is the recipient for outbound mail', () => {
    expect(
      counterpart(
        summary({
          direction: 'outbound',
          from: 'contact@cqu-openlib.cn',
          to: ['Ann <ann@example.com>'],
        }),
      ),
    ).toBe('ann@example.com');
  });
});

describe('replySubject', () => {
  it('prefixes once and never stacks', () => {
    expect(replySubject('反馈')).toBe('Re: 反馈');
    expect(replySubject('Re: 反馈')).toBe('Re: 反馈');
    expect(replySubject('RE: 反馈')).toBe('RE: 反馈');
  });
});

describe('formatBytes', () => {
  it('scales the unit and blanks out unknown sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
    expect(formatBytes(null)).toBe('');
  });
});
