import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { publicAssetPath } from './asset-path';
import { assetResponse, readDeckAsset, sampleImageResponse } from './sample-image';
import { sampleImageUrl } from './sample-image-reference';
import { audienceProjection, referencedAssets, type Deck } from './deck';
import { LibraryError, openDeck } from './library';
import { publicSnapshot } from './presentation-model';

interface Mark { slideId: string; step: number; tool: 'pen' | 'highlight'; color: string; width: number; points: { x: number; y: number }[] }
export interface SseClient {
  send: (eventName: string, payload: unknown) => void;
  close: () => void;
}
export interface Talk {
  id: string; localKey: string; assetToken: string; deckId: string; revision: string; deck: Deck; notes: Record<string, string[]>;
  assets: Map<string, { bytes: Uint8Array<ArrayBuffer>; mime: string }>;
  slideId: string; step: number; sequence: number; started: number;
  marks: Mark[]; blackout: boolean; canvas: boolean; laser: { x: number; y: number } | null;
  localClients: Set<{ client: SseClient; assetBase: string }>;
  presenterClients: Set<SseClient>;
  share?: {
    server: ReturnType<typeof Bun.serve>; key: string; address: string; port: number;
    viewers: Map<string, Viewer>; clients: Set<SseClient>;
  };
}
interface Viewer { name: string; ip: string; seen: number; streams?: Set<string> }
const talks = new Map<string, Talk>();

function sseStreamResponse(request: Request, onStart: (client: SseClient) => void, onClose: () => void): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    onClose();
    try { streamController?.close(); } catch { /* stream already closed */ }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      const client: SseClient = {
        send(eventName, payload) {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
          } catch {
            cleanup();
          }
        },
        close: cleanup,
      };
      request.signal.addEventListener('abort', cleanup, { once: true });
      heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); }
        catch { cleanup(); }
      }, 2_000);
      onStart(client);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function broadcastState(talk: Talk): void {
  const state = publicState(talk);
  for (const entry of talk.localClients) {
    entry.client.send('state', publicSnapshot(state, entry.assetBase));
  }
  if (talk.share) {
    const lanPayload = { ...publicSnapshot(state, `/assets/${talk.assetToken}`), viewers: publicViewers(talk) };
    for (const client of talk.share.clients) client.send('state', lanPayload);
  }
}

function broadcastViewers(talk: Talk): void {
  const presenterList = talk.share ? activeViewers(talk.share.viewers) : [];
  for (const client of talk.presenterClients) client.send('viewers', { viewers: presenterList });
  if (talk.share) {
    const audienceList = publicViewers(talk);
    for (const client of talk.share.clients) client.send('viewers', { viewers: audienceList });
  }
}

export async function createTalk(deckId: string, revision: string): Promise<Talk> {
  const source = await openDeck(deckId);
  if (source.revision !== revision) throw new LibraryError(409, 'Deck revision changed', { diskRevision: source.revision, diskText: source.text });
  if (!source.deck) throw new LibraryError(422, 'Deck has errors', source.diagnostics);
  const deck = structuredClone(source.deck);
  const assets = new Map<string, { bytes: Uint8Array<ArrayBuffer>; mime: string }>();
  let totalAssetBytes = 0;
  for (const rel of referencedAssets(deck)) {
    const asset = await readDeckAsset(deckId, rel);
    if (!asset) continue;
    totalAssetBytes += asset.bytes.byteLength;
    if (totalAssetBytes > 30_000_000) throw new LibraryError(400, 'Deck image assets exceed 30 MB total');
    assets.set(rel, asset);
  }
  const first = deck.slides[0];
  const talk: Talk = {
    id: randomUUID(), localKey: randomBytes(32).toString('base64url'), assetToken: randomBytes(24).toString('base64url'),
    deckId, revision, deck, assets, notes: Object.fromEntries(deck.slides.map(slide => [slide.id, slide.notes])),
    slideId: first.id, step: 0, sequence: 0, started: Date.now(), marks: [], blackout: false, canvas: false, laser: null,
    localClients: new Set(), presenterClients: new Set(),
  };
  talks.set(talk.id, talk);
  return talk;
}

export function talkAssetResponse(talk: Talk, token: string, encodedRelPath: string, method: 'GET' | 'HEAD'): Response {
  if (token !== talk.assetToken) throw new LibraryError(403, 'Asset key required');
  let relPath: string;
  try { relPath = encodedRelPath.split('/').map(segment => decodeURIComponent(segment)).join('/'); }
  catch { throw new LibraryError(400, 'Invalid asset path'); }
  const asset = talk.assets.get(relPath);
  if (!asset) throw new LibraryError(404, 'Asset not found');
  return assetResponse(asset, method);
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
    overlay: {
      marks: talk.marks.filter(mark => mark.slideId === talk.slideId && mark.step <= talk.step),
      blackout: talk.blackout, canvas: talk.canvas, laser: talk.laser,
    },
    resources: [], mediaState: {}
  };
}

// Audience pages stream via SSE or poll /state; actively streaming tabs stay live until disconnect.
export function activeViewers(viewers: Map<string, Viewer>, now = Date.now()): { name: string; ip: string }[] {
  for (const [id, viewer] of viewers) if (!viewer.streams?.size && now - viewer.seen > 5000) viewers.delete(id);
  return [...viewers.values()].map(({ name, ip }) => ({ name, ip }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.ip.localeCompare(b.ip));
}

export function publicViewers(talk: Talk): { name: string }[] {
  return talk.share ? activeViewers(talk.share.viewers).map(({ name }) => ({ name })) : [];
}

export function viewerName(value: string | null): string {
  let name = '';
  try { name = decodeURIComponent(value ?? ''); } catch { /* malformed names fall back to Guest */ }
  return [...name.replace(/\p{C}+/gu, ' ').replace(/\s+/g, ' ').trim()].slice(0, 40).join('').trim() || 'Guest';
}

export function privateState(talk: Talk) {
  return {
    id: talk.id, localKey: talk.localKey, deckId: talk.deckId, revision: talk.revision, deck: talk.deck,
    notes: talk.notes, started: talk.started, ...publicState(talk),
    share: talk.share ? { address: talk.share.address, port: talk.share.port, url: `http://${talk.share.address}:${talk.share.port}/audience/#${talk.share.key}`, reachability: 'unverified', viewers: activeViewers(talk.share.viewers) } : null
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
  if (['next', 'previous', 'jump', 'parent', 'left', 'right', 'up', 'down', 'mode'].includes(String(data.action))) {
    talk.laser = null;
  }
  talk.sequence++;
  broadcastState(talk);
  return privateState(talk);
}

export function setPointer(talk: Talk, raw: unknown): void {
  if (raw === null) {
    talk.laser = null;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number' ||
        !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y) ||
        candidate.x < 0 || candidate.x > 1 || candidate.y < 0 || candidate.y > 1) {
      throw new LibraryError(400, 'Invalid pointer coordinates');
    }
    talk.laser = { x: candidate.x, y: candidate.y };
  } else {
    throw new LibraryError(400, 'Invalid pointer payload');
  }
  const payload = { pointer: talk.laser };
  for (const entry of talk.localClients) entry.client.send('pointer', payload);
  if (talk.share) {
    for (const client of talk.share.clients) client.send('pointer', payload);
  }
}

export function localAudienceStream(talk: Talk, assetBase: string, request: Request): Response {
  let entry: { client: SseClient; assetBase: string } | undefined;
  return sseStreamResponse(request, client => {
    entry = { client, assetBase };
    talk.localClients.add(entry);
    client.send('state', publicSnapshot(publicState(talk), assetBase));
  }, () => {
    if (entry) talk.localClients.delete(entry);
  });
}

export function presenterStream(talk: Talk, request: Request): Response {
  let activeClient: SseClient | undefined;
  return sseStreamResponse(request, client => {
    activeClient = client;
    talk.presenterClients.add(client);
    client.send('viewers', { viewers: talk.share ? activeViewers(talk.share.viewers) : [] });
  }, () => {
    if (activeClient) talk.presenterClients.delete(activeClient);
  });
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
  // Re-read on rebuild: new builds rename hashed assets, which would otherwise 404 for a running share.
  let assets = { mtime: -1, allowed: new Set<string>() };
  const allowedAssets = () => {
    try {
      const mtime = statSync(manifest).mtimeMs;
      if (mtime !== assets.mtime) assets = { mtime, allowed: new Set(JSON.parse(readFileSync(manifest, 'utf8'))) };
    } catch { /* keep the last good list while a build rewrites the manifest */ }
    return assets.allowed;
  };
  allowedAssets();
  const key = randomBytes(32).toString('base64url');
  const viewers = new Map<string, Viewer>();
  const clients = new Set<SseClient>();
  let server: ReturnType<typeof Bun.serve> | undefined;
  let lastError: unknown;
  for (let port = start; port <= end; port++) {
    try {
      server = Bun.serve({
        hostname: address, port, idleTimeout: 30,
        async fetch(request, listener) {
          const url = new URL(request.url);
          if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
          if (url.pathname === '/state') {
            if (request.headers.get('X-Slides-Public') !== key) return new Response('Forbidden', { status: 403 });
            const ip = (listener.requestIP(request)?.address ?? '').replace(/^::ffff:/, '');
            const tab = request.headers.get('X-Slides-Viewer');
            const id = tab && /^[a-f0-9]{32}$/.test(tab) ? tab : ip;
            activeViewers(viewers);
            const nextName = viewerName(request.headers.get('X-Slides-Viewer-Name'));
            const prev = id ? viewers.get(id) : undefined;
            if (id && (prev || viewers.size < 200)) {
              viewers.set(id, { name: nextName, ip, seen: Date.now(), streams: prev?.streams });
              if (!prev || prev.name !== nextName) broadcastViewers(talk);
            }
            return Response.json({ ...publicSnapshot(publicState(talk), `/assets/${talk.assetToken}`), viewers: publicViewers(talk) }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
          }
          if (url.pathname === '/stream' && request.method === 'GET') {
            if (request.headers.get('X-Slides-Public') !== key) return new Response('Forbidden', { status: 403 });
            const ip = (listener.requestIP(request)?.address ?? '').replace(/^::ffff:/, '');
            const tab = request.headers.get('X-Slides-Viewer');
            const id = tab && /^[a-f0-9]{32}$/.test(tab) ? tab : ip;
            const streamId = randomUUID();
            let activeClient: SseClient | undefined;
            return sseStreamResponse(request, client => {
              activeClient = client;
              clients.add(client);
              activeViewers(viewers);
              const existing = id ? viewers.get(id) : undefined;
              if (id && (existing || viewers.size < 200)) {
                const streams = existing?.streams ?? new Set<string>();
                streams.add(streamId);
                viewers.set(id, { name: viewerName(request.headers.get('X-Slides-Viewer-Name')), ip, seen: Date.now(), streams });
              }
              client.send('state', { ...publicSnapshot(publicState(talk), `/assets/${talk.assetToken}`), viewers: publicViewers(talk) });
              broadcastViewers(talk);
            }, () => {
              if (activeClient) clients.delete(activeClient);
              if (id) {
                const current = viewers.get(id);
                current?.streams?.delete(streamId);
                if (current && !current.streams?.size) viewers.delete(id);
              }
              if (talk.share) broadcastViewers(talk);
            });
          }
          const talkAssetMatch = /^\/assets\/([A-Za-z0-9_-]+)\/(.+)$/.exec(url.pathname);
          if (talkAssetMatch) {
            try { return talkAssetResponse(talk, talkAssetMatch[1], talkAssetMatch[2], request.method); }
            catch (error) {
              if (error instanceof LibraryError) return new Response(error.message, { status: error.status });
              throw error;
            }
          }
          if (url.pathname === sampleImageUrl) {
            try { return await sampleImageResponse(request.method); }
            catch (error) {
              if (error instanceof LibraryError) return new Response(error.message, { status: error.status });
              throw error;
            }
          }
          const asset = publicAssetPath(url.pathname);
          if (!asset || !allowedAssets().has(asset)) return new Response('Not found', { status: 404 });
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
  talk.share = { server, key, address, port: server.port ?? start, viewers, clients };
  broadcastViewers(talk);
  return privateState(talk).share;
}

export function stopShare(talk: Talk) {
  if (talk.share) {
    for (const client of [...talk.share.clients]) {
      client.send('ended', { ended: true });
      client.close();
    }
    talk.share.server.stop(true);
    talk.share = undefined;
    broadcastViewers(talk);
  }
}

export function endTalk(talk: Talk, discardMarks: boolean) {
  if (talk.marks.length && !discardMarks) throw new LibraryError(409, 'Discard marks explicitly before ending');
  for (const entry of [...talk.localClients]) {
    entry.client.send('ended', { ended: true });
    entry.client.close();
  }
  for (const client of [...talk.presenterClients]) {
    client.send('ended', { ended: true });
    client.close();
  }
  stopShare(talk);
  talks.delete(talk.id);
}
