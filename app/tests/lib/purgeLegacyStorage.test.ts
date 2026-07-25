import { describe, expect, it } from 'vite-plus/test';
import { purgeLegacyStorage } from '~/lib/purgeLegacyStorage';

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    store: map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};

describe('purgeLegacyStorage', () => {
  it('drops the MkDocs 课表 credentials and keeps everything else', () => {
    const storage = fakeStorage();
    storage.setItem('userCredentials', btoa('{"username":"a","password":"b"}'));
    storage.setItem('curriculumEvents', '{}');
    storage.setItem('cqu-openlib-theme', 'dark');
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
    });

    purgeLegacyStorage();

    expect([...storage.store.keys()]).toEqual(['cqu-openlib-theme']);
  });

  it('is a no-op without a window', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });
    expect(() => purgeLegacyStorage()).not.toThrow();
  });
});
