import { renderInk, renderStage, type Slide, type Stage, type Stroke } from './render';

export interface ExportFrame {
  slide: Slide;
  step: number;
  strokes: Stroke[];
}

export interface ExportDocumentData {
  stage: Stage;
  frames: ExportFrame[];
}

const svgNs = 'http://www.w3.org/2000/svg';

async function renderAll(): Promise<void> {
  const payloadEl = document.getElementById('slides-export-payload');
  const deckHost = document.getElementById('export-deck');
  if (!payloadEl?.textContent || !deckHost) {
    document.documentElement.dataset.exportError = 'Missing export payload';
    return;
  }
  const data = JSON.parse(payloadEl.textContent) as ExportDocumentData;
  deckHost.replaceChildren();
  for (let i = 0; i < data.frames.length; i++) {
    const frame = data.frames[i];
    const section = document.createElement('section');
    section.className = 'export-slide';
    section.dataset.slideIndex = String(i);
    section.dataset.slideId = frame.slide.id;
    section.setAttribute('aria-label', `Slide ${i + 1} of ${data.frames.length}`);
    const stageFrame = document.createElement('div');
    stageFrame.className = 'stage-frame export-frame';
    const stage = document.createElement('div');
    stage.className = 'stage';
    const ink = document.createElementNS(svgNs, 'svg');
    ink.setAttribute('class', 'ink');
    ink.setAttribute('viewBox', '0 0 1000 562.5');
    ink.setAttribute('preserveAspectRatio', 'none');
    ink.setAttribute('aria-hidden', 'true');
    stageFrame.append(stage, ink);
    section.append(stageFrame);
    deckHost.append(section);
    await renderStage(stage, data.stage, frame.slide, frame.step);
    renderInk(ink, frame.strokes, frame.slide.id, frame.step);
  }
  await Promise.all(
    [...deckHost.querySelectorAll<HTMLImageElement>('img')].map(img =>
      img.complete ? Promise.resolve() : new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      }),
    ),
  );
  document.documentElement.dataset.exportReady = 'true';
}

void renderAll().catch(error => {
  document.documentElement.dataset.exportError = error instanceof Error ? error.message : String(error);
});
