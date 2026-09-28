import type { Snapshot } from './render';
import { drawStage, isNewSnapshot } from './stage-view';
import { renderViewers, type Viewer } from './viewers';

const status = document.getElementById('audience-status');
const frame = document.getElementById('audience-frame');
const stage = document.getElementById('audience-stage');
const ink = document.getElementById('audience-ink');
const mask = document.getElementById('audience-mode');
if (!status || !frame || !stage || !(ink instanceof SVGSVGElement) || !mask) {
  throw new Error('Audience view is incomplete');
}
const view = { status, frame, stage, ink, mask };
const sessionId = new URL(location.href).searchParams.get('session');
const key = decodeURIComponent(location.hash.slice(1));
let previous: Snapshot | null = null;
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
if (!sessionId && viewerForm instanceof HTMLFormElement && viewerInput instanceof HTMLInputElement) {
  viewerForm.hidden = false;
  viewerInput.value = viewerName;
  viewerForm.addEventListener('submit', event => {
    event.preventDefault();
    viewerName = viewerInput.value.trim().slice(0, 40);
    try { localStorage.setItem('slides-viewer-name', viewerName); } catch { /* name still applies to this tab */ }
  });
}
let failures = 0;

async function refresh(): Promise<void> {
  try {
    if (!key || (sessionId !== null && !/^[0-9a-f-]{36}$/.test(sessionId))) throw new Error('Audience link is missing or invalid.');
    const response = await fetch(sessionId ? `/api/public/${sessionId}` : '/state', {
      headers: sessionId ? { 'X-Slides-Public': key } : {
        'X-Slides-Public': key, 'X-Slides-Viewer': viewerId, 'X-Slides-Viewer-Name': encodeURIComponent(viewerName),
      },
      cache: 'no-store',
    });
    if (response.status === 404 || response.status === 410) {
      view.status.textContent = 'Presentation ended or unavailable.';
      return;
    }
    if (!response.ok) throw new Error(`Audience connection failed (${response.status}).`);
    const snapshot = await response.json() as Snapshot & { viewers?: Viewer[] };
    if (viewerList) renderViewers(viewerList, snapshot.viewers ?? []);
    if (isNewSnapshot(previous, snapshot)) {
      await drawStage(snapshot, view.stage, view.ink, view.mask, view.frame);
      previous = snapshot;
    }
    failures = 0;
    view.status.textContent = snapshot.ended ? 'Presentation ended.' : '';
    if (snapshot.ended) return;
  } catch (error) {
    failures++;
    view.status.textContent = `${error instanceof Error ? error.message : String(error)} Retrying…`;
  }
  setTimeout(() => { void refresh(); }, Math.min(8000, 1000 * 2 ** Math.min(failures, 3)));
}

void refresh();
