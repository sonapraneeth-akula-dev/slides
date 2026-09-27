import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { publicAssetPath } from './asset-path';
import { compileDeck } from './deck';
import { createDeck, deleteDeck, duplicateDeck, filenameTitle, grantDeck, LibraryError, listDecks, openDeck, removeDeck, renameDeck, saveDeck } from './library';
import { createTalk, endTalk, event, getTalk, privateState, publicState, shareOptions, startShare, stopShare } from './session';
import { presenterSession, publicSnapshot, renderCompilation } from './presentation-model';

const dist = join(process.cwd(), 'dist');
const ownerToken = randomBytes(32).toString('base64url');

async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new LibraryError(415, 'Expected application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new LibraryError(400, 'Missing request body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2_100_000) { await reader.cancel(); throw new LibraryError(413, 'Request too large'); }
    chunks.push(value);
  }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new LibraryError(400, 'Invalid JSON body'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LibraryError(400, 'Expected JSON object');
  return data as Record<string, unknown>;
}

function requireString(data: Record<string, unknown>, key: string): string {
  if (typeof data[key] !== 'string') throw new LibraryError(400, `${key} must be text`);
  return data[key];
}

function response(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function creationName(input: string): { title: string; filename: string } {
  const name = input.trim();
  const extension = /\.(md|mdx)$/i.exec(name)?.[0];
  if (!extension && /\.[A-Za-z0-9]+$/.test(name)) throw new LibraryError(400, 'Deck filenames must end in .md or .mdx');
  const title = extension ? name.slice(0, -extension.length).trim() : name;
  if (!title || title.length > 120 || !/^[\w][\w .-]*$/.test(title)) {
    throw new LibraryError(400, 'Enter a title using letters, numbers, spaces, hyphens, underscores or dots');
  }
  return { title, filename: `${title.replace(/ +/g, '-')}${extension ?? '.md'}` };
}

function starter(title: string): string {
  return `---
slides:
  formatVersion: 1
  title: ${JSON.stringify(title)}
  master:
    theme: signal
---
::slide{id="welcome"}
# Welcome

Edit this slide in Markdown.
`;
}

export function privateRouter(port: number) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (request.headers.get('host') !== `127.0.0.1:${port}` ||
          (request.headers.has('origin') && request.headers.get('origin') !== `http://127.0.0.1:${port}`)) {
        throw new LibraryError(403, 'Invalid host or origin');
      }
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        if (path === '/api/bootstrap' && request.method === 'GET') {
          return response({ token: ownerToken, library: await listDecks(), interfaces: shareOptions(), devMode: process.env.SLIDES_DEV_MODE === '1' });
        }
        const audienceMatch = /^\/api\/public\/([a-f0-9-]+)$/.exec(path);
        if (audienceMatch && request.method === 'GET') {
          const talk = getTalk(audienceMatch[1]);
          if (request.headers.get('X-Slides-Public') !== talk.localKey) throw new LibraryError(403, 'Audience key required');
          return response(publicSnapshot(publicState(talk)));
        }
        if (request.headers.get('X-Slides-Token') !== ownerToken) throw new LibraryError(403, 'Owner token required');
        if (path === '/api/library' && request.method === 'GET') return response({ library: await listDecks() });
        if (path === '/api/library' && request.method === 'POST') {
          const data = await body(request);
          if (data.action === 'create') {
            const { title, filename } = creationName(requireString(data, 'name'));
            const created = await createDeck(filename, starter(title));
            return response({ library: await listDecks(), id: created.id }, 201);
          }
          if (data.action === 'open' || data.action === 'relink') {
            const granted = await grantDeck(requireString(data, 'path'), data.action === 'relink' ? requireString(data, 'id') : undefined);
            return response({ library: await listDecks(), id: granted.id });
          }
          if (data.action === 'remove') {
            await removeDeck(requireString(data, 'id'));
            return response({ library: await listDecks() });
          }
          throw new LibraryError(400, 'Unsupported library action');
        }
        const libraryMatch = /^\/api\/library\/([A-Za-z0-9_-]+)(?:\/(duplicate))?$/.exec(path);
        if (libraryMatch && libraryMatch[2] === 'duplicate' && request.method === 'POST') {
          const data = await body(request);
          return response(await duplicateDeck(libraryMatch[1], requireString(data, 'name')), 201);
        }
        if (libraryMatch && !libraryMatch[2] && request.method === 'PATCH') {
          const data = await body(request);
          return response(await renameDeck(libraryMatch[1], requireString(data, 'name'), requireString(data, 'baseRevision')));
        }
        if (libraryMatch && !libraryMatch[2] && request.method === 'DELETE') {
          const data = await body(request);
          return response(await deleteDeck(libraryMatch[1], requireString(data, 'baseRevision'), data.confirm === true));
        }
        const deckMatch = /^\/api\/decks\/([A-Za-z0-9_-]+)$/.exec(path);
        if (deckMatch && request.method === 'GET') {
          const opened = await openDeck(deckMatch[1]);
          return response({ ...opened, ...renderCompilation(opened.text, opened) });
        }
        if (deckMatch && request.method === 'PUT') {
          const data = await body(request);
          const text = requireString(data, 'text');
          const saved = await saveDeck(deckMatch[1], requireString(data, 'baseRevision'), text);
          return response({ ...saved, ...renderCompilation(text, saved) });
        }
        if (path === '/api/compile' && request.method === 'POST') {
          const data = await body(request);
          const text = requireString(data, 'text');
          const title = data.deckId === undefined ? undefined : await filenameTitle(requireString(data, 'deckId'));
          return response(renderCompilation(text, compileDeck(text, title)));
        }
        if (path === '/api/sessions' && request.method === 'POST') {
          const data = await body(request);
          return response(presenterSession(privateState(await createTalk(requireString(data, 'deckId'), requireString(data, 'revision')))), 201);
        }
        const talkMatch = /^\/api\/sessions\/([a-f0-9-]+)(?:\/(events|share))?$/.exec(path);
        if (talkMatch) {
          const talk = getTalk(talkMatch[1]);
          if (!talkMatch[2] && request.method === 'GET') return response(presenterSession(privateState(talk)));
          if (!talkMatch[2] && request.method === 'DELETE') {
            const data = await body(request);
            endTalk(talk, data.discardMarks === true);
            return response({ ended: true });
          }
          if (talkMatch[2] === 'events' && request.method === 'POST') {
            event(talk, await body(request));
            return response(presenterSession(privateState(talk)));
          }
          if (talkMatch[2] === 'share' && request.method === 'POST') {
            const data = await body(request);
            return response(startShare(talk, requireString(data, 'host'), data.portStart as number, data.portEnd as number));
          }
          if (talkMatch[2] === 'share' && request.method === 'DELETE') { stopShare(talk); return response({ sharing: false }); }
        }
        throw new LibraryError(404, 'API route not found');
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new LibraryError(405, 'Method not allowed');
      const asset = publicAssetPath(path);
      if (!asset) throw new LibraryError(404, 'Not found');
      const file = Bun.file(join(dist, asset));
      if (!(await file.exists())) throw new LibraryError(404, 'Not found');
      return new Response(request.method === 'HEAD' ? null : file, {
        headers: {
          'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        }
      });
    } catch (error) {
      if (error instanceof LibraryError) return response({ error: error.message, details: error.details }, error.status);
      if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) return response({ error: 'File not found' }, 404);
      if (error instanceof Error && 'code' in error && String(error.code) === 'EEXIST') return response({ error: 'Deck already exists' }, 409);
      console.error('Host request failed:', error);
      return response({ error: 'Host request failed' }, 500);
    }
  };
}

export function startHost(port = 0) {
  let router: ReturnType<typeof privateRouter>;
  const server = Bun.serve({ hostname: '127.0.0.1', port, fetch(request: Request): Promise<Response> { return router(request); } });
  if (!server.port) throw new Error('Owner listener has no port');
  router = privateRouter(server.port);
  return server;
}

if (import.meta.main) {
  if (process.env.SLIDES_DEV_MODE !== '1' && !(await Bun.file(join(dist, 'index.html')).exists())) {
    throw new Error('Static UI missing; run bun run build from the code directory first.');
  }
  const port = process.env.SLIDES_DEV_MODE === '1' ? Number(process.env.SLIDES_DEV_API_PORT) : 0;
  if (process.env.SLIDES_DEV_MODE === '1' && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
    throw new Error('Invalid development API port.');
  }
  const server = startHost(port);
  console.log(`Local Slides: http://127.0.0.1:${server.port}`);
}
