import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { publicAssetPath } from './asset-path';
import { sampleImageResponse } from './sample-image';
import { sampleImageUrl } from './sample-image-reference';
import { audienceProjection, type Deck } from './deck';
import { LibraryError, openDeck } from './library';
import { publicSnapshot } from './presentation-model';

interface Mark { slideId: string; step: number; tool: 'pen' | 'highlight'; color: string; width: number; points: { x: number; y: number }[] }
export interface Talk {
  id: string; localKey: string; deckId: string; revision: string; deck: Deck; notes: Record<string, string[]>;
  slideId: string; step: number; sequence: number; started: number;
  marks: Mark[]; blackout: boolean; canvas: boolean;
  share?: { server: ReturnType<typeof Bun.serve>; key: string; address: string; port: number };
}
const talks = new Map<string, Talk>();

export async function createTalk(deckId: string, revision: string): Promise<Talk> {
  const source = await openDeck(deckId);
  if (source.revision !== revision) throw new LibraryError(409, 'Deck revision changed', { diskRevision: source.revision, diskText: source.text });
  if (!source.deck) throw new LibraryError(422, 'Deck has errors', source.diagnostics);
  const deck = structuredClone(source.deck);
  const first = deck.slides[0];
  const talk: Talk = {
    id: randomUUID(), localKey: randomBytes(32).toString('base64url'), deckId, revision, deck, notes: Object.fromEntries(deck.slides.map(slide => [slide.id, slide.notes])),
    slideId: first.id, step: 0, sequence: 0, started: Date.now(), marks: [], blackout: false, canvas: false
  };
  talks.set(talk.id, talk);
  return talk;
}

export function getTalk(id: string): Talk {
  const talk = talks.get(id);
  if (!talk) throw new LibraryError(404, 'Presentation not found');
  return talk;
}

export function publicState(talk: Talk) {
  return {
    schemaVersion: 1, sessionId: talk.id, sequence: talk.sequence, slideId: talk.slideId, step: talk.step,
    stage: audienceProjection(talk.deck, talk.slideId, talk.step),
    overlay: { marks: talk.marks.filter(mark => mark.slideId === talk.slideId && mark.step <= talk.step), blackout: talk.blackout, canvas: talk.canvas },
    resources: [], mediaState: {}
  };
}

export function privateState(talk: Talk) {
  return {
    id: talk.id, localKey: talk.localKey, deckId: talk.deckId, revision: talk.revision, deck: talk.deck,
    notes: talk.notes, started: talk.started, ...publicState(talk),
    share: talk.share ? { address: talk.share.address, port: talk.share.port, url: `http://${talk.share.address}:${talk.share.port}/audience/#${talk.share.key}`, reachability: 'unverified' } : null
  };
}

export function event(talk: Talk, data: Record<string, unknown>) {
  if (!Number.isSafeInteger(data.sequence) || data.sequence !== talk.sequence) throw new LibraryError(409, 'Presentation state changed', publicState(talk));
  if (data.action === 'next' || data.action === 'previous') {
    const slide = talk.deck.slides.find(s => s.id === talk.slideId)!;
    if (data.action === 'next') {
      if (talk.step < slide.reveals) talk.step++;
      else if (slide.index + 1 < talk.deck.slides.length) { talk.slideId = talk.deck.slides[slide.index + 1].id; talk.step = 0; }
    } else {
      if (talk.step) talk.step--;
      else if (slide.index) {
        const prev = talk.deck.slides[slide.index - 1];
        talk.slideId = prev.id; talk.step = prev.reveals;
      }
    }
  } else if (data.action === 'jump') {
    if (typeof data.slideId !== 'string' || !talk.deck.slides.some(s => s.id === data.slideId)) throw new LibraryError(400, 'Unknown slide');
    talk.slideId = data.slideId; talk.step = 0;
  } else if (data.action === 'parent') {
    const slide = talk.deck.slides.find(s => s.id === talk.slideId)!;
    if (slide.parent) { talk.slideId = slide.parent; talk.step = 0; }
  } else if (['left', 'right', 'up', 'down'].includes(String(data.action))) {
    const slide = talk.deck.slides.find(s => s.id === talk.slideId)!;
    const siblings = talk.deck.slides.filter(s => s.parent === slide.parent);
    const siblingIndex = siblings.findIndex(s => s.id === slide.id);
    const target = data.action === 'up' ? talk.deck.slides.find(s => s.id === slide.parent)
      : data.action === 'down' ? talk.deck.slides.find(s => s.parent === slide.id)
      : siblings[siblingIndex + (data.action === 'left' ? -1 : 1)];
    if (target) { talk.slideId = target.id; talk.step = 0; }
  } else if (data.action === 'mode') {
    if (!['normal', 'canvas', 'blackout'].includes(String(data.mode))) throw new LibraryError(400, 'Invalid display mode');
    talk.blackout = data.mode === 'blackout';
    talk.canvas = data.mode === 'canvas';
  } else if (data.action === 'stroke') {
    const mark = data.stroke;
    if (!mark || typeof mark !== 'object' || Array.isArray(mark)) throw new LibraryError(400, 'Invalid mark');
    const m = mark as Record<string, unknown>;
    if (!['pen', 'highlighter'].includes(String(m.tool)) || typeof m.color !== 'string' || !/^#[\da-fA-F]{6}$/.test(m.color) ||
        typeof m.width !== 'number' || !Number.isFinite(m.width) || m.width < 1 || m.width > 30 ||
        m.slideId !== talk.slideId || m.step !== talk.step ||
        !Array.isArray(m.points) || m.points.length < 2 || m.points.length > 2000 ||
        !m.points.every(p => p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) {
      throw new LibraryError(400, 'Invalid stroke');
    }
    if (talk.marks.length >= 500) throw new LibraryError(422, 'Mark limit reached');
    talk.marks.push({ slideId: talk.slideId, step: talk.step, tool: m.tool === 'highlighter' ? 'highlight' : 'pen', color: m.color, width: m.width, points: m.points });
  } else if (data.action === 'undo') {
    const last = talk.marks.findLastIndex(mark => mark.slideId === talk.slideId);
    if (last >= 0) talk.marks.splice(last, 1);
  } else if (data.action === 'clear') {
    talk.marks = talk.marks.filter(mark => mark.slideId !== talk.slideId);
  } else throw new LibraryError(400, 'Unknown presentation action');
  talk.sequence++;
  return privateState(talk);
}

function addresses() {
  return Object.values(networkInterfaces()).flat().filter((item): item is NonNullable<typeof item> =>
    !!item && item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.'));
}

export function shareOptions() {
  return addresses().map(({ address }) => address);
}

export function startShare(talk: Talk, address: string, start: number, end: number) {
  if (talk.share) throw new LibraryError(409, 'Already sharing');
  if (!shareOptions().includes(address)) throw new LibraryError(400, 'Select an available LAN interface');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1024 || end > 65535 || end < start || end - start > 100) throw new LibraryError(400, 'Invalid port range');
  const manifest = join(process.cwd(), 'build', 'audience-assets.json');
  if (!existsSync(manifest)) throw new LibraryError(409, 'Build audience assets with bun run build before sharing on LAN.');
  const audienceAssets: string[] = JSON.parse(readFileSync(manifest, 'utf8'));
  const allowedAssets = new Set(audienceAssets);
  const key = randomBytes(32).toString('base64url');
  let server: ReturnType<typeof Bun.serve> | undefined;
  let lastError: unknown;
  for (let port = start; port <= end; port++) {
    try {
      server = Bun.serve({
        hostname: address, port,
        async fetch(request) {
          const url = new URL(request.url);
          if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
          if (url.pathname === '/state') {
            if (request.headers.get('X-Slides-Public') !== key) return new Response('Forbidden', { status: 403 });
            return Response.json(publicSnapshot(publicState(talk)), { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
          }
          if (url.pathname === sampleImageUrl) {
            try { return await sampleImageResponse(request.method); }
            catch (error) {
              if (error instanceof LibraryError) return new Response(error.message, { status: error.status });
              throw error;
            }
          }
          const asset = publicAssetPath(url.pathname);
          if (!asset || !allowedAssets.has(asset)) return new Response('Not found', { status: 404 });
          const file = Bun.file(join(process.cwd(), 'dist', asset));
          if (!(await file.exists())) return new Response('Not found', { status: 404 });
          return new Response(request.method === 'HEAD' ? null : file, { headers: {
            'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
          } });
        }
      });
      break;
    } catch (error) { lastError = error; }
  }
  if (!server) throw new LibraryError(503, `Cannot bind LAN listener: ${String(lastError)}`);
  talk.share = { server, key, address, port: server.port ?? start };
  return privateState(talk).share;
}

export function stopShare(talk: Talk) {
  if (talk.share) { talk.share.server.stop(true); talk.share = undefined; }
}

export function endTalk(talk: Talk, discardMarks: boolean) {
  if (talk.marks.length && !discardMarks) throw new LibraryError(409, 'Discard marks explicitly before ending');
  stopShare(talk);
  talks.delete(talk.id);
}
