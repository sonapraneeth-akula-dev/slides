import { join } from 'node:path';
import { publicAssetPath } from './asset-path';

const dist = join(process.cwd(), 'dist');
if (!(await Bun.file(join(dist, 'index.html')).exists())) {
  throw new Error('Static UI missing; run bun run build from the code directory first.');
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const asset = publicAssetPath(new URL(request.url).pathname);
    if (!asset) return new Response('Not found', { status: 404 });
    const file = Bun.file(join(dist, asset));
    if (!(await file.exists())) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: { 'Content-Type': file.type },
    });
  },
});

console.log(`Local Slides: http://127.0.0.1:${server.port}`);
