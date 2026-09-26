import { describe, expect, test } from 'bun:test';
import { publicAssetPath } from '../src/asset-path';

describe('private host asset allowlist', () => {
  test('serves only the static entry and built assets', () => {
    expect(publicAssetPath('/')).toBe('index.html');
    expect(publicAssetPath('/index.html')).toBe('index.html');
    expect(publicAssetPath('/_astro/page.Ab12-Cd.css')).toBe('_astro/page.Ab12-Cd.css');
  });

  test.each([
    '/src/host.ts',
    '/api/decks',
    '/_astro/../secret',
    '/_astro/%2e%2e%2fsecret',
    '/_astro/deeper/file.js',
    '/_astro/secret%5Cnotes',
    '/index.html/../private',
  ])('rejects non-public path %s', (path) => {
    expect(publicAssetPath(path)).toBeNull();
  });
});
