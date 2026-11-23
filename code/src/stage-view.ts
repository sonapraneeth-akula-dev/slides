import { overlayMode, renderInk, renderStage, type PointerPosition, type Snapshot } from './render';

export function drawPointer(laser: HTMLElement | null, pointer: PointerPosition | null | undefined): void {
  if (!laser) return;
  if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y) ||
      pointer.x < 0 || pointer.x > 1 || pointer.y < 0 || pointer.y > 1) {
    laser.hidden = true;
    return;
  }
  laser.hidden = false;
  laser.style.left = `${pointer.x * 100}%`;
  laser.style.top = `${pointer.y * 100}%`;
}

export async function drawStage(
  snapshot: Snapshot, stage: HTMLElement, ink: SVGSVGElement, mask: HTMLElement, frame: HTMLElement, laser?: HTMLElement | null,
): Promise<void> {
  const slide = snapshot.stage.slides.find(item => item.id === snapshot.slideId);
  await renderStage(stage, snapshot.stage, slide, snapshot.step);
  const mode = overlayMode(snapshot.overlay?.mode);
  mask.hidden = mode === 'normal';
  mask.dataset.mode = mode;
  mask.textContent = mode === 'blackout' ? 'Blackout' : '';
  frame.dataset.mode = mode;
  renderInk(ink, snapshot.overlay?.strokes || [], snapshot.slideId, snapshot.step);
  if (laser) drawPointer(laser, snapshot.overlay?.laser);
}

export function isNewSnapshot(previous: Snapshot | null, next: Snapshot): boolean {
  return !previous || previous.sessionId !== next.sessionId || next.sequence > previous.sequence;
}
