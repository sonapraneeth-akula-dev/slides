import type { PointerPosition, Snapshot } from './render';
import { drawPointer, drawStage, isNewSnapshot } from './stage-view';
import { consumeEventStream } from './sse';
import { renderViewers, type Viewer } from './viewers';

const status = document.getElementById('audience-status');
const frame = document.getElementById('audience-frame');
const stage = document.getElementById('audience-stage');
const ink = document.getElementById('audience-ink');
const mask = document.getElementById('audience-mode');
const laser = document.getElementById('audience-laser');
if (!status || !frame || !stage || !(ink instanceof SVGSVGElement) || !mask) {
  throw new Error('Audience view is incomplete');
}
const view = { status, frame, stage, ink, mask };
const sessionId = new URL(location.href).searchParams.get('session');
const key = decodeURIComponent(location.hash.slice(1));
let previous: Snapshot | null = null;
let renderQueue = Promise.resolve();
const viewerList = document.getElementById('viewer-list');
const viewerForm = document.getElementById('viewer-form');
const viewerInput = document.getElementById('viewer-name');
const stored = (store: Storage, name: string, create: () => string): string => {
  try {
    const value = store.getItem(name) ?? create();
    store.setItem(name, value);
    return value;
  } catch { return create(); }
};
// crypto.randomUUID needs a secure context, which plain-HTTP LAN pages are not.
const viewerId = stored(sessionStorage, 'slides-viewer-id', () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join(''));
let viewerName = stored(localStorage, 'slides-viewer-name', () => '');
const audienceHeaders = (): Record<string, string> => sessionId ? { 'X-Slides-Public': key } : {
  'X-Slides-Public': key, 'X-Slides-Viewer': viewerId, 'X-Slides-Viewer-Name': encodeURIComponent(viewerName),
};
if (!sessionId && viewerForm instanceof HTMLFormElement && viewerInput instanceof HTMLInputElement) {
  viewerForm.hidden = false;
  viewerInput.value = viewerName;
  viewerForm.addEventListener('submit', event => {
    event.preventDefault();
    viewerName = viewerInput.value.trim().slice(0, 40);
    try { localStorage.setItem('slides-viewer-name', viewerName); } catch { /* name still applies to this tab */ }
    void fetch('/state', { headers: audienceHeaders(), cache: 'no-store' }).catch(() => {});
  });
}
let failures = 0;

function applySnapshot(snapshot: Snapshot & { viewers?: Viewer[] }): Promise<void> {
  if (viewerList) renderViewers(viewerList, snapshot.viewers ?? []);
  drawPointer(laser, snapshot.overlay?.laser);
  view.status.textContent = snapshot.ended ? 'Presentation ended.' : '';
  if (!isNewSnapshot(previous, snapshot)) return Promise.resolve();
  previous = snapshot;
  renderQueue = renderQueue.then(() => drawStage(snapshot, view.stage, view.ink, view.mask, view.frame, laser)).catch(() => {});
  return renderQueue;
}

async function pollOnce(): Promise<'ok' | 'ended'> {
  const response = await fetch(sessionId ? `/api/public/${sessionId}` : '/state', {
    headers: audienceHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404 || response.status === 410) {
    drawPointer(laser, null);
    view.status.textContent = 'Presentation ended or unavailable.';
    return 'ended';
  }
  if (!response.ok) throw new Error(`Audience connection failed (${response.status}).`);
  const snapshot = await response.json() as Snapshot & { viewers?: Viewer[] };
  await applySnapshot(snapshot);
  failures = 0;
  return snapshot.ended ? 'ended' : 'ok';
}

async function connect(): Promise<void> {
  if (!key || (sessionId !== null && !/^[0-9a-f-]{36}$/.test(sessionId))) {
    view.status.textContent = 'Audience link is missing or invalid.';
    return;
  }
  const controller = new AbortController();
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
  while (!controller.signal.aborted) {
    try {
      const outcome = await consumeEventStream(
        sessionId ? `/api/public/${sessionId}/stream` : '/stream',
        audienceHeaders(),
        controller.signal,
        async (eventName, payload) => {
          failures = 0;
          if (eventName === 'state' && payload && typeof payload === 'object') {
            await applySnapshot(payload as Snapshot & { viewers?: Viewer[] });
          } else if (eventName === 'pointer' && payload && typeof payload === 'object') {
            drawPointer(laser, (payload as { pointer?: PointerPosition | null }).pointer);
          } else if (eventName === 'viewers' && payload && typeof payload === 'object' && viewerList) {
            renderViewers(viewerList, (payload as { viewers?: Viewer[] }).viewers ?? []);
          } else if (eventName === 'ended') {
            drawPointer(laser, null);
            view.status.textContent = 'Presentation ended or unavailable.';
          }
        },
      );
      if (outcome === 'ended') {
        drawPointer(laser, null);
        view.status.textContent = 'Presentation ended or unavailable.';
        return;
      }
      if (outcome === 'unauthorized') throw new Error('Audience connection failed (403).');
      if (await pollOnce() === 'ended') return;
    } catch (error) {
      if (controller.signal.aborted) return;
      try {
        if (await pollOnce() === 'ended') return;
      } catch (pollError) {
        failures++;
        view.status.textContent = `${pollError instanceof Error ? pollError.message : String(error)} Retrying…`;
      }
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(8000, 1000 * 2 ** Math.min(failures, 3))));
  }
}

void connect();
