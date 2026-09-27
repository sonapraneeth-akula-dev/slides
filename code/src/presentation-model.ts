import type { Compilation, Deck as SourceDeck, Diagnostic as SourceDiagnostic, Slide as SourceSlide, SlideItem } from './deck';
import type { Deck, Slide, Snapshot, Stroke } from './render';

function content(items: SlideItem[], step: number, slot = ''): string {
  return items.filter(item => item.step === step && item.slot === slot).map(item => item.text).join('\n').trim();
}

function slide(source: Pick<SourceSlide, 'id' | 'parent' | 'index' | 'layout' | 'items' | 'reveals'>): Slide {
  const slots: Record<string, string> = {};
  for (const item of source.items) if (item.slot) slots[item.slot] = content(source.items, 0, item.slot);
  return {
    id: source.id, parent: source.parent ?? undefined, index: source.index, layout: source.layout,
    body: content(source.items, 0),
    slots,
    reveals: Array.from({ length: source.reveals }, (_, index) => content(source.items, index + 1)),
  };
}

export function renderDeck(source: SourceDeck): Deck {
  return {
    schemaVersion: 1, title: source.title, theme: String(source.master.theme ?? 'signal'),
    master: source.master, slides: source.slides.map(slide),
    order: source.slides.map(slide => slide.id),
  };
}

export interface Diagnostic extends SourceDiagnostic {
  severity: 'error';
  sourceSpan: { start: number; end: number };
}

export function renderDiagnostics(source: string, diagnostics: SourceDiagnostic[]): Diagnostic[] {
  const lines = source.split(/\r?\n/);
  return diagnostics.map(item => {
    const line = Math.min(Math.max(item.line, 1), lines.length);
    const start = lines.slice(0, line - 1).reduce((n, text) => n + text.length + 1, 0) + Math.max(0, item.column - 1);
    return { ...item, severity: 'error', sourceSpan: { start, end: start + lines[line - 1].length } };
  });
}

export function renderCompilation(source: string, compilation: Compilation) {
  return {
    deck: compilation.deck ? renderDeck(compilation.deck) : null,
    diagnostics: renderDiagnostics(source, compilation.diagnostics),
  };
}

export interface PublicState {
  schemaVersion: number;
  sessionId: string;
  sequence: number;
  slideId: string;
  step: number;
  stage: {
    title: string;
    master: Record<string, unknown>;
    total: number;
    slide: Pick<SourceSlide, 'id' | 'index' | 'layout' | 'reveals'> & {
      items: Array<Pick<SlideItem, 'text' | 'step' | 'slot'>>;
    };
  };
  overlay: {
    marks: Array<{ slideId: string; step: number; tool: 'pen' | 'highlight'; color: string; width: number; points: Array<{ x: number; y: number }> }>;
    blackout: boolean;
    canvas: boolean;
  };
}

export interface PrivateState extends PublicState {
  id: string;
  deck: SourceDeck;
  notes: Record<string, string[]>;
  localKey: string;
  started: number;
}

function overlay(state: PublicState): Snapshot['overlay'] {
  const strokes: Stroke[] = state.overlay.marks.map(mark => ({
    ...mark, tool: mark.tool === 'highlight' ? 'highlighter' : 'pen',
  }));
  return { strokes, mode: state.overlay.blackout ? 'blackout' : state.overlay.canvas ? 'canvas' : 'normal' };
}

export function publicSnapshot(state: PublicState): Snapshot {
  const current = state.stage.slide;
  const slideContent = slide({
    ...current, parent: null, items: current.items.map(item => ({ ...item, line: 0 })),
  });
  return {
    schemaVersion: state.schemaVersion, sessionId: state.sessionId, sequence: state.sequence,
    slideId: state.slideId, step: state.step,
    stage: {
      title: state.stage.title, master: state.stage.master,
      theme: String(state.stage.master.theme ?? 'signal'), total: state.stage.total, slides: [slideContent],
    },
    overlay: overlay(state), ended: false,
  };
}

export function presenterSession(state: PrivateState) {
  const deck = renderDeck(state.deck);
  return {
    sessionId: state.id, localKey: state.localKey, snapshot: {
      schemaVersion: state.schemaVersion, sessionId: state.id, sequence: state.sequence,
      slideId: state.slideId, step: state.step, stage: deck,
      overlay: overlay(state), ended: false,
    } satisfies Snapshot,
    notes: Object.fromEntries(Object.entries(state.notes).map(([id, lines]) => [id, lines.join('\n')])),
  };
}
