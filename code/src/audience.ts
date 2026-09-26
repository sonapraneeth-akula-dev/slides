import type { Snapshot } from './render';
import { drawStage, isNewSnapshot } from './stage-view';

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
let failures = 0;

async function refresh(): Promise<void> {
  try {
    if (!key || (sessionId !== null && !/^[0-9a-f-]{36}$/.test(sessionId))) throw new Error('Audience link is missing or invalid.');
    const response = await fetch(sessionId ? `/api/public/${sessionId}` : '/state', {
      headers: { 'X-Slides-Public': key },
      cache: 'no-store',
    });
    if (response.status === 404 || response.status === 410) {
      view.status.textContent = 'Presentation ended or unavailable.';
      return;
    }
    if (!response.ok) throw new Error(`Audience connection failed (${response.status}).`);
    const snapshot = await response.json() as Snapshot;
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
