import YAML from 'yaml';
import { layouts, metadataPositions, metadataValues } from './slide-options';
import { validFontFamily } from './font-family';

export { layouts };
export type Layout = typeof layouts[number];
export interface Diagnostic { line: number; column: number; message: string }
export interface SlideItem { text: string; line: number; step: number; slot: string }
export interface Slide {
  id: string; parent: string | null; title: string; number: string; index: number;
  layout: Layout; section?: string; metadata: Record<string, string>;
  items: SlideItem[]; notes: string[]; reveals: number;
}
export interface Deck { title: string; master: Record<string, unknown>; slides: Slide[] }
export interface Compilation { deck: Deck | null; diagnostics: Diagnostic[] }

const attr = /^([a-zA-Z][\w-]*)="([^"]*)"$/;
const slideId = /^[A-Za-z][\w-]*$/;
const themes = new Set(['signal', 'paper', 'midnight', 'forest']);
const colors = new Set(['surface', 'text', 'accent', 'muted']);
const fonts = new Set(['headingFont', 'bodyFont', 'codeFont']);
const sizes = new Set(['headingSize', 'bodySize', 'codeSize']);
const metadataKeys = new Set(metadataPositions.map(position => `metadata${position}`));
const allowedMetadata = new Set(metadataValues);
const insets = new Set(['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']);
// Built-in static components (rendered in render.ts); any other tag remains rejected as executable JSX/HTML.
const staticComponents = /<\/?(?:Cards|Card|Callout)(?:\s+[a-z]+="[^"<>{}]*")*\s*>|<Mark(?:\s+note="[^"<>{}]*")?\s*>|<\/Mark>/g;

function attributes(raw: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  let rest = raw.trim();
  while (rest) {
    const match = /^([a-zA-Z][\w-]*="[^"]*")(?:\s+|$)/.exec(rest);
    if (!match) return null;
    const pair = attr.exec(match[1]);
    if (!pair || Object.hasOwn(result, pair[1])) return null;
    result[pair[1]] = pair[2];
    rest = rest.slice(match[0].length);
  }
  return result;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function outsideMath(line: string, state: { block: boolean }): string {
  let plain = '';
  for (let i = 0; i < line.length;) {
    if (line.startsWith('$$', i)) { state.block = !state.block; i += 2; continue; }
    if (state.block) { i++; continue; }
    if (line[i] === '$') {
      const closing = line.indexOf('$', i + 1);
      if (closing >= 0) { i = closing + 1; continue; }
    }
    plain += line[i++];
  }
  return plain;
}

export function compileDeck(source: string, filenameTitle?: string): Compilation {
  const diagnostics: Diagnostic[] = [];
  const fail = (line: number, message: string, column = 1) => diagnostics.push({ line, column, message });
  if (typeof source !== 'string' || source.length > 2_000_000) {
    return { deck: null, diagnostics: [{ line: 1, column: 1, message: 'Source must be text under 2 MB' }] };
  }
  const lines = source.split(/\r?\n/);
  let start = 0;
  let metadata: Record<string, unknown> = {};
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end < 0) fail(1, 'Unclosed YAML frontmatter');
    else {
      const doc = YAML.parseDocument(lines.slice(1, end).join('\n'), { uniqueKeys: true });
      for (const error of doc.errors) fail(2 + (error.linePos?.[0]?.line ?? 1) - 1, error.message);
      const parsed: unknown = doc.toJS();
      if (record(parsed)) metadata = parsed;
      else fail(2, 'Frontmatter must be a mapping');
      start = end + 1;
    }
  }
  const config = metadata.slides;
  const options = record(config) ? config : {};
  if (config !== undefined && !record(config)) fail(2, 'slides must be a mapping');
  if (options.formatVersion !== undefined && options.formatVersion !== 1) fail(2, 'Only formatVersion 1 is supported');
  if (options.title !== undefined && typeof options.title !== 'string') fail(2, 'slides.title must be text');
  const master = record(options.master) ? options.master : {};
  if (options.master !== undefined && !record(options.master)) fail(2, 'slides.master must be a mapping');
  const theme = master.theme ?? 'signal';
  if (typeof theme !== 'string' || !themes.has(theme)) fail(2, 'Unknown master theme');
  for (const [key, value] of Object.entries(master)) {
    if (key === 'theme') continue;
    if (key === 'metadata') {
      if (!record(value)) fail(2, 'slides.master.metadata must be a mapping');
      else for (const [position, assignment] of Object.entries(value)) {
        if (!metadataKeys.has(position)) fail(2, `Unknown metadata position: ${position}`);
        else if (typeof assignment !== 'string' || !allowedMetadata.has(assignment as typeof metadataValues[number])) fail(2, `Invalid metadata for ${position}`);
        if (Object.hasOwn(master, position)) fail(2, `Duplicate metadata position: ${position}`);
      }
    } else if (colors.has(key) && (typeof value !== 'string' || !/^#[\da-fA-F]{6}$/.test(value))) fail(2, `${key} must be a hex color`);
    else if (fonts.has(key) && !validFontFamily(value)) fail(2, `${key} must be a valid font family`);
    else if (sizes.has(key) && (typeof value !== 'number' || value < 12 || value > 120)) fail(2, `${key} must be between 12 and 120`);
    else if (insets.has(key) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 20)) fail(2, `${key} must be between 0 and 20 percent`);
    else if (key === 'headingPlacement' && !['left', 'center', 'right'].includes(String(value))) fail(2, 'Unknown heading placement');
    else if (key === 'footerNumber' && typeof value !== 'boolean') fail(2, 'footerNumber must be boolean');
    else if (metadataKeys.has(key) && (typeof value !== 'string' || !allowedMetadata.has(value as typeof metadataValues[number]))) fail(2, `Invalid metadata for ${key}`);
    else if (key === 'background' && !['solid', 'gradient', 'band'].includes(String(value))) fail(2, 'Unknown background');
    else if (key === 'backdrop' && !['off', 'drift'].includes(String(value))) fail(2, 'Unknown backdrop');
    else if (['logo', 'footer'].includes(key) && typeof value !== 'string') fail(2, `${key} must be text`);
    else if (!['logo', 'footer', 'footerNumber', 'background', 'backdrop', 'headingPlacement'].includes(key) && !insets.has(key) && !metadataKeys.has(key) && !colors.has(key) && !fonts.has(key) && !sizes.has(key)) fail(2, `Unknown master setting: ${key}`);
  }
  const effectiveMaster = { ...master };
  delete effectiveMaster.metadata;
  if (record(master.metadata)) Object.assign(effectiveMaster, master.metadata);
  const configuredLayouts = record(options.layouts) ? options.layouts : {};
  if (options.layouts !== undefined && !record(options.layouts)) fail(2, 'slides.layouts must be a mapping');
  for (const [id, layout] of Object.entries(configuredLayouts)) {
    if (!slideId.test(id) || !layouts.includes(layout as Layout)) fail(2, `Invalid layout for ${id}`);
  }

  const slides: Slide[] = [];
  let current: Slide | undefined;
  let container: 'notes' | 'reveal' | 'slot' | undefined;
  let step = 0;
  let slot = '';
  let fence: string | undefined;
  const math = { block: false };
  const ids = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const text = lines[i];
    const trimmed = text.trim();
    const line = i + 1;
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (trimmed.startsWith(fence[0].repeat(fence.length))) fence = undefined;
    }
    if (!fence && trimmed.startsWith('::slide')) {
      if (container) fail(line, 'Close the container before the next slide');
      const match = /^::slide\{(.*)\}$/.exec(trimmed);
      const attrs = match && attributes(match[1]);
      if (!attrs || !attrs.id || !slideId.test(attrs.id) ||
          Object.keys(attrs).some(k => !['id', 'parent', 'layout', 'section'].includes(k) && !metadataKeys.has(k))) {
        fail(line, 'Invalid slide directive (expected id, optional parent, layout, section and metadata positions)');
        current = undefined;
        container = undefined;
        continue;
      }
      if (attrs.section !== undefined && (!attrs.section.trim() || attrs.section.length > 60 || /[{}<>]/.test(attrs.section))) {
        fail(line, 'Section must be 1–60 characters without markup');
      }
      for (const key of metadataKeys) if (attrs[key] !== undefined && !allowedMetadata.has(attrs[key] as typeof metadataValues[number])) {
        fail(line, `Invalid metadata for ${key}`);
      }
      if (ids.has(attrs.id)) fail(line, `Duplicate slide id: ${attrs.id}`);
      ids.add(attrs.id);
      const chosen = attrs.layout ?? configuredLayouts[attrs.id] ?? 'title-content';
      if (!layouts.includes(chosen as Layout)) fail(line, `Invalid slide layout: ${chosen}`);
      current = {
        id: attrs.id, parent: attrs.parent || null, title: '', number: '', index: slides.length,
        layout: layouts.includes(chosen as Layout) ? chosen as Layout : 'title-content',
        section: attrs.section?.trim(), metadata: Object.fromEntries(Object.entries(attrs).filter(([key]) => metadataKeys.has(key))),
        items: [], notes: [], reveals: 0
      };
      slides.push(current);
      container = undefined;
      step = 0;
      slot = '';
      continue;
    }
    if (!fence && trimmed === ':::') {
      if (!container) fail(line, 'Unexpected container close');
      container = undefined; step = 0; slot = '';
      continue;
    }
    if (!fence && trimmed.startsWith(':::')) {
      if (container) fail(line, 'Nested containers are not supported');
      const match = /^:::(notes|reveal|slot)(?:\{(.*)\})?$/.exec(trimmed);
      const attrs = match && attributes(match[2] ?? '');
      if (!current || !match || !attrs ||
          (match[1] === 'notes' && Object.keys(attrs).length !== 0) ||
          (match[1] === 'reveal' && (Object.keys(attrs).join() !== 'step' || !/^[1-9]\d*$/.test(attrs.step))) ||
          (match[1] === 'slot' && (Object.keys(attrs).join() !== 'name' || !slideId.test(attrs.name)))) {
        fail(line, 'Invalid container directive');
        continue;
      }
      container = match[1] as typeof container;
      step = container === 'reveal' ? Number(attrs.step) : 0;
      slot = container === 'slot' ? attrs.name : '';
      if (container === 'reveal') current.reveals = Math.max(current.reveals, step);
      continue;
    }
    if (!current) {
      if (trimmed && !fence) fail(line, 'Content must follow a slide directive');
      continue;
    }
    const prose = fence ? '' : outsideMath(text, math).replace(staticComponents, '');
    if (!fence && (/<\/?[a-z][^>]*>/i.test(prose) || /\{(?:[a-z_$][\w.$]*|\.\.\.)\}/i.test(prose))) {
      fail(line, 'Executable JSX/HTML is not supported');
    }
    if (container === 'notes') current.notes.push(text);
    else {
      if (!current.title && !container && /^#\s+/.test(trimmed)) current.title = trimmed.replace(/^#\s+/, '');
      current.items.push({ text, line, step, slot });
    }
  }
  if (fence) fail(lines.length, 'Unclosed code fence');
  if (math.block) fail(lines.length, 'Unclosed math block');
  if (container) fail(lines.length, 'Unclosed container');
  if (!slides.length) fail(1, 'Add at least one ::slide{id="..."} directive');
  for (const slide of slides) {
    if (slide.parent && !ids.has(slide.parent)) fail(slide.items[0]?.line ?? 1, `Unknown parent: ${slide.parent}`);
    if (slide.parent === slide.id) fail(slide.items[0]?.line ?? 1, `Slide ${slide.id} cannot parent itself`);
    const steps = new Set(slide.items.filter(item => item.step > 0).map(item => item.step));
    for (let n = 1; n <= slide.reveals; n++) if (!steps.has(n)) fail(slide.items[0]?.line ?? 1, `Reveal steps must be contiguous from 1 (missing ${n})`);
  }
  const byId = new Map(slides.map(slide => [slide.id, slide]));
  const ordered: Slide[] = [];
  const visited = new Set<string>();
  function visit(slide: Slide, ancestry: Set<string>, number: string) {
    if (ancestry.has(slide.id)) { fail(slide.items[0]?.line ?? 1, `Cycle at ${slide.id}`); return; }
    if (visited.has(slide.id)) return;
    visited.add(slide.id);
    slide.number = number;
    slide.index = ordered.length;
    ordered.push(slide);
    const next = new Set([...ancestry, slide.id]);
    let child = 0;
    for (const candidate of slides) if (candidate.parent === slide.id) visit(candidate, next, `${number}.${++child}`);
  }
  let root = 0;
  for (const slide of slides) if (!slide.parent) visit(slide, new Set(), String(++root));
  for (const slide of slides) if (!visited.has(slide.id)) {
    let ancestor: Slide | undefined = slide;
    const chain = new Set<string>();
    while (ancestor && !chain.has(ancestor.id)) {
      chain.add(ancestor.id);
      ancestor = ancestor.parent ? byId.get(ancestor.parent) : undefined;
    }
    fail(slide.items[0]?.line ?? 1, `Cycle involving ${slide.id}`);
  }
  return {
    deck: diagnostics.length ? null : {
      title: typeof options.title === 'string' && options.title.trim() && options.title !== 'Untitled presentation'
        ? options.title : filenameTitle || slides[0]?.title || 'Untitled deck',
      master: { ...effectiveMaster, theme }, slides: ordered
    },
    diagnostics
  };
}

export function audienceProjection(deck: Deck, slideId: string, step: number) {
  const slide = deck.slides.find(item => item.id === slideId);
  if (!slide) throw new Error('Slide not found');
  return {
    title: deck.title,
    master: deck.master,
    slide: {
      id: slide.id, title: slide.title, number: slide.number, index: slide.index,
      layout: slide.layout, reveals: slide.reveals, metadata: slide.metadata,
      items: slide.items.filter(item => item.step <= step).map(({ text, step, slot }) => ({ text, step, slot }))
    },
    total: deck.slides.length, step
  };
}
