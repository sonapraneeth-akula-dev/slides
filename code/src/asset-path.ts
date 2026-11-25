export function publicAssetPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/index.html') return 'index.html';
  if (pathname === '/audience' || pathname === '/audience/' || pathname === '/audience/index.html') return 'audience/index.html';
  if (pathname === '/favicon.svg') return 'favicon.svg';
  if (/^\/_astro\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pathname)) {
    return pathname.slice(1);
  }
  return null;
}
