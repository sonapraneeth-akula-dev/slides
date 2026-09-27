import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

const dist = join(process.cwd(), 'dist');
const pending = ['audience/index.html'];
const assets = new Set<string>();
while (pending.length) {
  const asset = pending.pop()!;
  if (assets.has(asset)) continue;
  const source = await readFile(join(dist, asset), 'utf8');
  assets.add(asset);
  const references = asset.endsWith('.html')
    ? [...source.matchAll(/(?:src|href)="(\/_astro\/[A-Za-z0-9._-]+)"/g)].map(match => match[1])
    : asset.endsWith('.css')
      ? [...source.matchAll(/url\(["']?(\/_astro\/[A-Za-z0-9._-]+)["']?\)/g)].map(match => match[1])
      : asset.endsWith('.js')
        ? [...source.matchAll(/["'`]((?:\/_astro\/|\.\/)[A-Za-z0-9._-]+\.(?:js|css|woff2?|ttf))["'`]/g)].map(match => match[1])
        : [];
  for (const reference of references) {
    const next = reference.startsWith('/_astro/') ? reference.slice(1) : posix.join(posix.dirname(asset), reference);
    if (!/^_astro\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(next)) throw new Error(`Invalid audience asset: ${next}`);
    // Bundled libraries also contain unresolved, optional module names as strings.
    if (!(await stat(join(dist, next)).then(() => true, () => false))) continue;
    pending.push(next);
  }
}
await mkdir(join(process.cwd(), 'build'), { recursive: true });
await writeFile(join(process.cwd(), 'build', 'audience-assets.json'), `${JSON.stringify([...assets].sort(), null, 2)}\n`);
