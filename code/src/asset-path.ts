export function publicAssetPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/index.html') return 'index.html';
  if (/^\/_astro\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pathname)) {
    return pathname.slice(1);
  }
  return null;
}
