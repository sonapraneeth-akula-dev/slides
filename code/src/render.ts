import MarkdownIt from 'markdown-it';
import katex from 'katex';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

export interface Slide {
  id: string;
  parent?: string;
  index: number;
  layout: string;
  body: string;
  reveals: string[];
  slots: Record<string, string>;
  notes?: string;
}

export interface Stage {
  title: string;
  theme: string;
  master: Record<string, unknown>;
  slides: Slide[];
  total?: number;
}

export interface Deck extends Stage {
  schemaVersion: number;
  order: string[];
}

export interface Stroke {
  points?: Array<{ x: number; y: number }>;
  d?: string;
  color?: string;
  width?: number;
  tool?: string;
  step?: number;
  slideId?: string;
}

export interface Snapshot {
  schemaVersion: number;
  sessionId: string;
  sequence: number;
  slideId: string;
  step: number;
  stage: Stage;
  overlay: { strokes: Stroke[]; mode: unknown };
  ended: boolean;
}

const md = new MarkdownIt({ html: false, linkify: false, breaks: true });
md.renderer.rules.image = (tokens, index) => {
  const token = tokens[index];
  const alt = token.content || 'Unlabelled image';
  return `<span class="asset-fallback" role="img" aria-label="${md.utils.escapeHtml(alt)}">Image unavailable: ${md.utils.escapeHtml(alt)}</span>`;
};
md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const language = token.info.trim().split(/\s/)[0].toLowerCase();
  if (language === 'mermaid' || language === 'chart') {
    return `<div class="special-fence" data-kind="${language}" data-source="${encodeURIComponent(token.content)}"></div>`;
  }
  const code = hljs.getLanguage(language) && token.content.length < 30_000
    ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value
    : md.utils.escapeHtml(token.content);
  return `<pre><code class="hljs">${code}</code></pre>`;
};
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('rel', 'noopener noreferrer');
  tokens[index].attrSet('target', '_blank');
  return self.renderToken(tokens, index, options);
};
md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
  if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') return false;
  const end = state.src.indexOf('$', state.pos + 1);
  if (end <= state.pos + 1 || end - state.pos > 1000) return false;
  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = state.src.slice(state.pos + 1, end);
  }
  state.pos = end + 1;
  return true;
});
md.renderer.rules.math_inline = (tokens, index) => {
  try {
    return katex.renderToString(tokens[index].content, { throwOnError: true, trust: false, maxExpand: 200 });
  } catch {
    return `<span class="render-fallback" role="note">Math could not be rendered: ${md.utils.escapeHtml(tokens[index].content)}</span>`;
  }
};
md.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
  const first = state.bMarks[start] + state.tShift[start];
  if (!state.src.slice(first, state.eMarks[start]).trim().startsWith('$$')) return false;
  let next = start;
  let content = state.src.slice(first, state.eMarks[start]).trim().slice(2);
  if (!content.endsWith('$$')) {
    while (++next < end) {
      const line = state.src.slice(state.bMarks[next], state.eMarks[next]);
      content += '\n' + line;
      if (line.trim().endsWith('$$')) break;
    }
    if (next >= end) return false;
  }
  if (!silent) {
    const token = state.push('math_block', '', 0);
    token.content = content.replace(/\$\$$/, '').trim();
    token.map = [start, next + 1];
  }
  state.line = next + 1;
  return true;
});
md.renderer.rules.math_block = (tokens, index) => {
  try {
    return katex.renderToString(tokens[index].content, { displayMode: true, throwOnError: true, trust: false, maxExpand: 200 });
  } catch {
    return `<p class="render-fallback" role="note">Math could not be rendered: ${md.utils.escapeHtml(tokens[index].content)}</p>`;
  }
};

export function markdown(source: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'slide-markdown';
  element.innerHTML = DOMPurify.sanitize(md.render(source), {
    FORBID_TAGS: ['iframe', 'object', 'form', 'script', 'style', 'img'],
  });
  return element;
}

function textFallback(target: HTMLElement, label: string, source: string): void {
  target.replaceChildren();
  const caption = document.createElement('p');
  caption.className = 'render-fallback';
  caption.textContent = label;
  const code = document.createElement('pre');
  code.textContent = source;
  target.append(caption, code);
}

const mermaidHeader = /^(?:flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\s*$/;
export function safeMermaid(source: string): boolean {
  return source.length <= 4000 && source.split('\n').length <= 100 &&
    mermaidHeader.test(source.trim().split('\n')[0]) &&
    !/(?:%%\{|<|>|&|click\b|href\b|linkStyle\b|style\b|classDef\b|script\b|https?:|javascript:|data:)/i.test(
      source.replace(/-->|--\|/g, '').replace(/->>/g, '')
    );
}

interface ChartData {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'donut';
  labels: string[];
  series: Array<{ name: string; data: Array<number | [number, number]> }>;
  unit?: string;
  x?: string;
  y?: string;
}

export function parseChart(source: string): ChartData {
  if (source.length > 20000) throw new Error('Chart exceeds size limit.');
  const input: unknown = JSON.parse(source);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Chart must be an object.');
  const chart = input as Record<string, unknown>;
  const allowed = ['type', 'labels', 'series', 'unit', 'x', 'y'];
  if (Object.keys(chart).some(key => !allowed.includes(key))) throw new Error('Unsupported chart option.');
  if (!['line', 'bar', 'area', 'scatter', 'pie', 'donut'].includes(String(chart.type))) {
    throw new Error('Unsupported chart type.');
  }
  const type = chart.type as ChartData['type'];
  const labels = chart.labels;
  const series = chart.series;
  if (!Array.isArray(labels) || labels.length > 120 ||
    !labels.every(label => typeof label === 'string' && label.length <= 100)) {
    throw new Error('Chart labels must be short text (up to 120).');
  }
  if (!Array.isArray(series) || !series.length || series.length > 4) throw new Error('Chart needs 1–4 series.');
  if (!series.every(item => item && typeof item === 'object' && !Array.isArray(item) &&
    Object.keys(item).every(key => key === 'name' || key === 'data') &&
    typeof item.name === 'string' && item.name.length <= 100 && Array.isArray(item.data) &&
    item.data.length <= 120 && (type === 'scatter'
      ? item.data.every((point: unknown) => Array.isArray(point) && point.length === 2 &&
          point.every((number: unknown) => typeof number === 'number' && Number.isFinite(number)))
      : item.data.every((number: unknown) => typeof number === 'number' && Number.isFinite(number))))) {
    throw new Error('Chart series must contain finite numbers or x/y pairs.');
  }
  if (type !== 'scatter' && series.some(item => item.data.length !== labels.length)) {
    throw new Error('Each series must match the label count.');
  }
  for (const key of ['unit', 'x', 'y'] as const) {
    if (chart[key] !== undefined && (typeof chart[key] !== 'string' || chart[key].length > 100)) {
      throw new Error(`Chart ${key} must be short text.`);
    }
  }
  return chart as unknown as ChartData;
}

let diagramCounter = 0;
const mountedCharts = new Map<HTMLElement, () => void>();
let chartCleanup: MutationObserver | undefined;
function cleanCharts(): void {
  for (const [canvas, dispose] of mountedCharts) {
    if (!canvas.isConnected) {
      dispose();
      mountedCharts.delete(canvas);
    }
  }
  if (!mountedCharts.size) chartCleanup?.disconnect();
}

async function renderFences(root: HTMLElement): Promise<void> {
  const fences = [...root.querySelectorAll<HTMLElement>('.special-fence')];
  for (const fence of fences) {
    if (!fence.isConnected) continue;
    const kind = fence.dataset.kind;
    const source = decodeURIComponent(fence.dataset.source ?? '');
    if (kind === 'mermaid') {
      if (!safeMermaid(source)) {
        textFallback(fence, 'Diagram is outside the supported safe subset.', source);
        continue;
      }
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
          flowchart: { htmlLabels: false },
          maxTextSize: 4000,
        });
        const { svg } = await mermaid.render(`slides-diagram-${++diagramCounter}`, source);
        if (!fence.isConnected) continue;
        fence.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'script'] });
        fence.setAttribute('role', 'img');
        fence.setAttribute('aria-label', `Diagram: ${source.slice(0, 250)}`);
      } catch {
        if (fence.isConnected) textFallback(fence, 'Diagram could not be rendered.', source);
      }
    } else if (kind === 'chart') {
      try {
        const chart = parseChart(source);
        const table = document.createElement('table');
        const caption = document.createElement('caption');
        caption.textContent = `${chart.type} chart data${chart.unit ? ` (${chart.unit})` : ''}`;
        table.append(caption);
        const header = table.createTHead().insertRow();
        for (const heading of [chart.x || 'Category', ...chart.series.map(item => item.name)]) {
          const cell = document.createElement('th');
          cell.scope = 'col';
          cell.textContent = heading;
          header.append(cell);
        }
        const body = table.createTBody();
        const rows = chart.type === 'scatter' ? Math.max(...chart.series.map(item => item.data.length)) : chart.labels.length;
        for (let i = 0; i < rows; i++) {
          const row = body.insertRow();
          const values = [chart.labels[i] || String(i + 1), ...chart.series.map(item =>
            Array.isArray(item.data[i]) ? (item.data[i] as [number, number]).join(', ') : String(item.data[i] ?? ''))];
          for (const value of values) row.insertCell().textContent = value;
        }
        const canvas = document.createElement('div');
        canvas.className = 'chart-visual';
        canvas.setAttribute('aria-hidden', 'true');
        fence.replaceChildren(canvas, table);
        const echarts = await import('echarts');
        if (!fence.isConnected) continue;
        const instance = echarts.init(canvas, undefined, { renderer: 'canvas' });
        try {
          const round = chart.type === 'pie' || chart.type === 'donut';
          instance.setOption({
            animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
            tooltip: { trigger: round ? 'item' : 'axis', renderMode: 'richText' },
            legend: { top: 0 },
            grid: { left: '12%', right: '5%', bottom: '16%', top: '18%' },
            xAxis: round ? undefined : { type: chart.type === 'scatter' ? 'value' : 'category', data: chart.type === 'scatter' ? undefined : chart.labels, name: chart.x },
            yAxis: round ? undefined : { type: 'value', name: chart.y },
            series: chart.series.map(item => ({
              name: item.name,
              type: round ? 'pie' : chart.type === 'bar' ? 'bar' : chart.type === 'scatter' ? 'scatter' : 'line',
              areaStyle: chart.type === 'area' ? {} : undefined,
              radius: chart.type === 'donut' ? ['42%', '68%'] : chart.type === 'pie' ? '68%' : undefined,
              data: round ? item.data.map((value, index) => ({ value, name: chart.labels[index] })) : item.data,
            })),
          });
        } catch (error) {
          instance.dispose();
          throw error;
        }
        const observer = new ResizeObserver(() => {
          if (canvas.isConnected) instance.resize();
        });
        observer.observe(canvas);
        mountedCharts.set(canvas, () => { observer.disconnect(); instance.dispose(); });
        chartCleanup ??= new MutationObserver(cleanCharts);
        chartCleanup.observe(document.body, { childList: true, subtree: true });
      } catch (error) {
        if (fence.isConnected) textFallback(fence, `Chart could not be rendered: ${error instanceof Error ? error.message : 'invalid data'}`, source);
      }
    }
  }
}

const presets: Record<string, Record<string, string>> = {
  signal: { surface: '#ffffff', text: '#1b1f24', accent: '#2563eb', muted: '#5b6470' },
  paper: { surface: '#fbf7ef', text: '#2b2620', accent: '#b4532a', muted: '#7a6f60' },
  midnight: { surface: '#0f172a', text: '#e2e8f0', accent: '#38bdf8', muted: '#94a3b8' },
  forest: { surface: '#f1f6f0', text: '#1d2b1f', accent: '#2f7d4a', muted: '#5d6f60' },
};
const fonts = new Set(['Segoe UI', 'Georgia', 'Trebuchet MS', 'Verdana', 'Palatino', 'Consolas', 'Cascadia Code', 'Courier New']);

function setAppearance(host: HTMLElement, stage: Stage): void {
  const preset = presets[stage.theme] || presets.signal;
  host.style.backgroundColor = preset.surface;
  host.style.color = preset.text;
  for (const key of ['surface', 'text', 'accent', 'muted'] as const) {
    const value = stage.master?.[key];
    host.style.setProperty(`--slide-${key}`, typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : preset[key]);
  }
  for (const key of ['headingFont', 'bodyFont', 'codeFont'] as const) {
    const value = stage.master?.[key];
    host.style.setProperty(`--${key}`, typeof value === 'string' && fonts.has(value) ? `"${value}"` : 'system-ui');
  }
  const size = (key: string, baseline: number): number => {
    const value = stage.master?.[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= 12 && value <= 120
      ? value / baseline : 1;
  };
  const bodyScale = size('bodySize', 32);
  host.style.setProperty('--bodySize-scale', String(bodyScale));
  host.style.setProperty('--headingSize-scale', String(size('headingSize', 80) / bodyScale));
  host.style.setProperty('--codeSize-scale', String(size('codeSize', 32) / bodyScale));
}

export async function renderStage(host: HTMLElement, stage: Stage, slide: Slide | undefined, step: number): Promise<void> {
  host.replaceChildren();
  setAppearance(host, stage);
  if (!slide) {
    host.textContent = 'Waiting for a slide…';
    return;
  }
  host.dataset.layout = slide.layout;
  if (slide.layout !== 'blank') {
    host.append(markdown(slide.body));
    const names = slide.layout === 'three-columns' ? ['left', 'center', 'right']
      : slide.layout === 'two-columns' ? ['left', 'right'] : slide.layout === 'picture-text' ? ['image', 'text'] : [];
    if (names.length) {
      const columns = document.createElement('div');
      columns.className = 'slide-columns';
      for (const name of names) {
        const column = markdown(slide.slots?.[name] || '');
        column.classList.add('slide-column');
        column.setAttribute('aria-label', `${name} column`);
        columns.append(column);
      }
      host.append(columns);
    }
    for (const [index, reveal] of (slide.reveals || []).entries()) {
      if (index >= step) break;
      const element = markdown(reveal);
      element.classList.add('slide-reveal');
      host.append(element);
    }
  }
  const master = stage.master || {};
  const positions = ['TopLeft', 'TopCenter', 'TopRight', 'BottomLeft', 'BottomCenter', 'BottomRight'] as const;
  const assigned = positions.map(position => master[`metadata${position}`]);
  for (const position of positions) {
    const configured = master[`metadata${position}`];
    const kind = configured === undefined
      ? position === 'BottomLeft' && master.footer && !assigned.includes('footer') ? 'footer'
        : position === 'BottomRight' && master.footerNumber === true && !assigned.includes('slideNumber') ? 'slideNumber' : 'none'
      : configured;
    const value = kind === 'slideNumber' ? `${slide.index + 1} / ${stage.total ?? stage.slides.length}`
      : kind === 'deckTitle' ? stage.title
      : kind === 'slideTitle' ? slide.body.match(/^#{1,3}\s+(.+)$/m)?.[1] || slide.id
      : kind === 'footer' || kind === 'logo' ? master[kind] : '';
    if (typeof value !== 'string' || !value) continue;
    const element = document.createElement('span');
    element.className = 'slide-meta';
    element.dataset.position = position;
    element.textContent = value;
    host.append(element);
  }
  await renderFences(host);
}

const svgNamespace = 'http://www.w3.org/2000/svg';
export function renderInk(host: SVGSVGElement, strokes: Stroke[], slideId: string, step: number): void {
  host.replaceChildren();
  for (const stroke of strokes || []) {
    if (stroke.slideId && stroke.slideId !== slideId || (stroke.step ?? 0) > step) continue;
    const color = stroke.color || '#e11d48';
    if (!/^#[0-9a-f]{6}$/i.test(color)) continue;
    const width = Math.min(30, Math.max(1, Number(stroke.width) || 5));
    const points = stroke.points;
    const path = Array.isArray(points) && points.length > 1 && points.length <= 2000 &&
      points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) &&
        point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
      ? points.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 1000} ${point.y * 562.5}`).join(' ')
      : typeof stroke.d === 'string' && /^[\d\s.,MLCQSTAZmlcqstaz+-]+$/.test(stroke.d) && stroke.d.length <= 20000
        ? stroke.d : '';
    if (!path) continue;
    const element = document.createElementNS(svgNamespace, 'path');
    element.setAttribute('d', path);
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', color);
    element.setAttribute('stroke-width', String(width));
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
    if (stroke.tool === 'highlighter') element.setAttribute('opacity', '0.38');
    host.append(element);
  }
}

export function overlayMode(mode: unknown): 'normal' | 'canvas' | 'blackout' {
  if (mode === 'canvas' || mode === 'blank') return 'canvas';
  if (mode === 'blackout') return 'blackout';
  if (mode && typeof mode === 'object' && 'mode' in mode) return overlayMode(mode.mode);
  return 'normal';
}
