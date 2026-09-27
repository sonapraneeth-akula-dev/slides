import { overlayMode, renderInk, renderStage, type Snapshot } from './render';

export async function drawStage(snapshot: Snapshot, stage: HTMLElement, ink: SVGSVGElement, mask: HTMLElement, frame: HTMLElement): Promise<void> {
  const slide = snapshot.stage.slides.find(item => item.id === snapshot.slideId);
  await renderStage(stage, snapshot.stage, slide, snapshot.step);
  const mode = overlayMode(snapshot.overlay?.mode);
  mask.hidden = mode === 'normal';
  mask.dataset.mode = mode;
  mask.textContent = mode === 'blackout' ? 'Blackout' : '';
  frame.dataset.mode = mode;
  renderInk(ink, snapshot.overlay?.strokes || [], snapshot.slideId, snapshot.step);
}

export function isNewSnapshot(previous: Snapshot | null, next: Snapshot): boolean {
  return !previous || previous.sessionId !== next.sessionId || next.sequence > previous.sequence;
}
