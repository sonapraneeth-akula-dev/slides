import MarkdownIt from 'markdown-it';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import { parseAssetReference, sampleImageReference, sampleImageUrl } from './sample-image-reference';
import { parseChart, safeMermaid, type ChartData } from './fence-validation';
import { metadataPositions } from './slide-options';
import { defaultMonoFontStack, defaultSansFontStack, validFontFamily } from './font-family';

export { parseChart, safeMermaid, type ChartData };

export interface Slide {
  id: string;
  parent?: string;
  index: number;
  layout: string;
  title?: string;
  hideTitle?: boolean;
  theme?: string;
  eyebrow?: string;
  subtitle?: string;
  accentBar?: string;
  section?: string;
  metadata?: Record<string, string>;
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
  assetBase?: string;
  assetMap?: Record<string, string>;
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

export interface PointerPosition {
  x: number;
  y: number;
}

export interface Snapshot {
  schemaVersion: number;
  sessionId: string;
  sequence: number;
  slideId: string;
  step: number;
  stage: Stage;
  overlay: { strokes: Stroke[]; mode: unknown; laser?: PointerPosition | null };
  ended: boolean;
}

const md = new MarkdownIt({ html: false, linkify: false, breaks: true });
const safeAssetBase = /^\/(?:api\/(?:deck-assets|public)\/|assets\/)[A-Za-z0-9/_-]+$/;
const safeDataImage = /^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
md.renderer.rules.image = (tokens, index, _options, env) => {
  const token = tokens[index];
  const alt = token.content || 'Unlabelled image';
  const src = String(token.attrGet('src') ?? '');
  const context = env as { assetBase?: string; assetMap?: Record<string, string> } | undefined;
  if (src === sampleImageReference) {
    if (context?.assetMap?.[sampleImageReference]) {
      return `<img class="slide-image" alt="${md.utils.escapeHtml(alt)}" data-asset-key="${sampleImageReference}">`;
    }
    return `<img class="slide-image" src="${sampleImageUrl}" alt="${md.utils.escapeHtml(alt)}" loading="lazy">`;
  }
  const rel = parseAssetReference(src);
  if (rel && context?.assetMap?.[rel]) {
    return `<img class="slide-image" alt="${md.utils.escapeHtml(alt)}" data-asset-key="${md.utils.escapeHtml(rel)}">`;
  }
  const assetBase = context?.assetBase;
  if (rel && assetBase && safeAssetBase.test(assetBase)) {
    const encoded = rel.split('/').map(encodeURIComponent).join('/');
    return `<img class="slide-image" src="${assetBase}/${encoded}" alt="${md.utils.escapeHtml(alt)}" data-asset-alt="${md.utils.escapeHtml(alt)}">`;
  }
  return `<span class="asset-fallback" role="img" aria-label="${md.utils.escapeHtml(alt)}">Image unavailable: ${md.utils.escapeHtml(alt)}</span>`;
};
const escapeHtml = md.utils.escapeHtml;

// Code fence meta follows the MDX/rehype-pretty-code convention: ```ts title="app.ts" showLineNumbers {2,4-5}
export function fenceMeta(info: string): { language: string; title?: string; lineNumbers: boolean; marked: Set<number> } {
  const language = /^[^\s{]*/.exec(info.trim())![0].toLowerCase();
  const marked = new Set<number>();
  for (const range of /\{([\d,\s-]+)\}/.exec(info)?.[1].split(',') ?? []) {
    const [from, to = from] = range.split('-').map(value => Number(value.trim()));
    for (let line = from; line >= 1 && line <= Math.min(to, from + 500); line++) marked.add(line);
  }
  return { language, title: /\btitle="([^"]{1,120})"/.exec(info)?.[1], lineNumbers: /\bshowLineNumbers\b/.test(info), marked };
}

function terminal(content: string, title?: string): string {
  const lines = content.replace(/\n$/, '').split('\n').map(line => line.startsWith('$ ')
    ? `<span class="terminal-command"><span class="terminal-prompt" aria-hidden="true">$ </span>${escapeHtml(line.slice(2))}</span>`
    : `<span class="terminal-output">${escapeHtml(line)}</span>`);
  return `<figure class="terminal"><figcaption><span class="terminal-dots" aria-hidden="true"><i></i><i></i><i></i></span>${escapeHtml(title || 'Terminal')}</figcaption><pre><code>${lines.join('\n')}</code></pre></figure>`;
}

md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const { language, title, lineNumbers, marked } = fenceMeta(token.info);
  if (language === 'mermaid' || language === 'chart') {
    return `<div class="special-fence" data-kind="${language}" data-source="${encodeURIComponent(token.content)}"></div>`;
  }
  if (language === 'terminal') return terminal(token.content, title);
  const code = hljs.getLanguage(language) && token.content.length < 30_000
    ? hljs.highlight(token.content, { language, ignoreIllegals: true }).value
    : escapeHtml(token.content);
  if (!title && !language && !lineNumbers && !marked.size) return `<pre><code class="hljs">${code}</code></pre>`;
  const count = token.content.replace(/\n$/, '').split('\n').length;
  const header = title || language
    ? `<figcaption class="code-header">${title ? `<span class="code-file">${escapeHtml(title)}</span>` : ''}${language ? `<span class="code-lang">${escapeHtml(language)}</span>` : ''}</figcaption>`
    : '';
  const gutter = lineNumbers ? `<span class="code-gutter" aria-hidden="true">${Array.from({ length: count }, (_, line) => line + 1).join('\n')}</span>` : '';
  const marks = [...marked].filter(line => line <= count).map(line => `<span class="code-mark" style="--line: ${line - 1}"></span>`).join('');
  return `<figure class="code-block">${header}<pre>${gutter}<code class="hljs">${marks}${code}</code></pre></figure>`;
};

// Static MDX-style components: attributes are plain strings, never evaluated.
const componentTag = /^<(Cards|Card|Col|Callout|Flow|Lane|Steps|StepItem|Step|Panels|Panel|Split|Stack|SectionLabel|BadgeList|BadgeRow)((?:\s+[a-z]+="[^"<{}]*")*)\s*>$/;
const arrowTag = /^<Arrow((?:\s+[a-z]+="[^"<{}]*")+)\s*\/>$/;
const calloutTypes: Record<string, string> = { note: 'Note', tip: 'Tip', warning: 'Warning' };
const cardTones = new Set(['blue', 'teal', 'green', 'amber', 'red', 'purple', 'dark']);
const splitRatios = new Set(['50-50', '56-44', '58-42', '48-52', '60-40', '40-60']);
md.block.ruler.before('fence', 'flow_arrow', (state, start, _end, silent) => {
  const text = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]).trim();
  const match = arrowTag.exec(text);
  if (!match) return false;
  const attrs = Object.fromEntries([...match[1].matchAll(/([a-z]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
  if (!attrs.from || !attrs.to || !/^[A-Za-z][\w-]*$/.test(attrs.from) || !/^[A-Za-z][\w-]*$/.test(attrs.to)) return false;
  if (silent) return true;
  const token = state.push('flow_arrow', 'span', 0);
  token.meta = { from: attrs.from, to: attrs.to, style: attrs.style === 'dashed' ? 'dashed' : 'solid' };
  token.map = [start, start + 1];
  state.line = start + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.flow_arrow = (tokens, index) => {
  const { from, to, style } = tokens[index].meta as { from: string; to: string; style: string };
  return `<span class="flow-arrow-spec" data-from="${escapeHtml(from)}" data-to="${escapeHtml(to)}" data-style="${escapeHtml(style)}" hidden></span>`;
};
md.block.ruler.before('fence', 'component', (state, start, end, silent) => {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trim();
  const open = componentTag.exec(lineText(start));
  if (!open) return false;
  const name = open[1];
  let depth = 1;
  let next = start;
  while (++next < end) {
    const text = lineText(next);
    if (componentTag.exec(text)?.[1] === name) depth++;
    else if (text === `</${name}>` && --depth === 0) break;
  }
  if (next >= end) return false;
  if (silent) return true;
  const opening = state.push('component_open', 'div', 1);
  opening.info = name;
  opening.meta = Object.fromEntries([...open[2].matchAll(/([a-z]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  opening.map = [start, next + 1];
  const { lineMax, parentType } = state;
  state.lineMax = next;
  state.parentType = 'blockquote';
  state.md.block.tokenize(state, start + 1, next);
  state.lineMax = lineMax;
  state.parentType = parentType;
  const closing = state.push('component_close', 'div', -1);
  closing.info = name;
  closing.meta = opening.meta;
  state.line = next + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.component_open = (tokens, index) => {
  const { info: name, meta } = tokens[index] as { info: string; meta: Record<string, string> };
  if (name === 'Cards') {
    const cols = ['2', '3', '4'].includes(meta.columns) ? ` data-columns="${meta.columns}"` : '';
    return `<div class="component-cards"${cols}>`;
  }
  if (name === 'Card') {
    const toneAttr = cardTones.has(meta.tone) ? ` data-tone="${meta.tone}"` : '';
    const eyebrowHtml = meta.eyebrow ? `<div class="card-eyebrow">${escapeHtml(meta.eyebrow)}</div>` : '';
    const statHtml = meta.stat ? `<div class="card-stat">${escapeHtml(meta.stat)}</div>` : '';
    const badgeTone = meta.badgetone && ['red', 'amber', 'blue', 'green', 'teal', 'purple', 'muted'].includes(meta.badgetone)
      ? meta.badgetone
      : (meta.tone && meta.tone !== 'dark' ? meta.tone : 'blue');
    const badgePill = meta.badge ? `<span class="ui-badge" data-tone="${escapeHtml(badgeTone)}">${escapeHtml(meta.badge)}</span>` : '';
    const titleEl = meta.title ? `<p class="component-title">${escapeHtml(meta.title)}</p>` : '';
    const headerBlock = badgePill && meta.badgerow === 'inline'
      ? `<div class="card-head-inline">${badgePill}${titleEl}</div>`
      : `${badgePill ? `<div class="card-badge-top">${badgePill}</div>` : ''}${titleEl}`;
    const orderedHead = meta.statpos === 'below'
      ? `${eyebrowHtml}${headerBlock}${statHtml}`
      : `${eyebrowHtml}${statHtml}${headerBlock}`;
    const subHtml = meta.subtitle ? `<div class="card-subtitle">${escapeHtml(meta.subtitle)}</div>` : '';
    const colsOpen = ['2', '3', '4'].includes(meta.columns) ? `<div class="card-cols" data-columns="${meta.columns}">` : '';
    return `<section class="component-card"${toneAttr}>${orderedHead}${subHtml}${colsOpen}`;
  }
  if (name === 'Col') {
    const titleHtml = meta.title ? `<p class="card-col-title">${escapeHtml(meta.title)}</p>` : '';
    return `<div class="card-col">${titleHtml}`;
  }
  if (name === 'SectionLabel') return '<div class="section-divider">';
  if (name === 'BadgeList') return '<div class="badge-list">';
  if (name === 'BadgeRow') {
    const tone = ['red', 'amber', 'blue', 'green', 'teal', 'purple', 'muted'].includes(meta.tone) ? meta.tone : 'blue';
    const pill = `<span class="ui-badge badge-row-pill" data-tone="${tone}">${escapeHtml(meta.label || '')}</span>`;
    return `<div class="badge-row">${pill}<div class="badge-row-desc">`;
  }
  if (name === 'Split') {
    const ratio = splitRatios.has(meta.ratio) ? meta.ratio : '50-50';
    return `<div class="slide-split" data-ratio="${ratio}">`;
  }
  if (name === 'Stack') return '<div class="slide-stack">';
  if (name === 'Steps') return '<div class="pillar-steps">';
  if (name === 'StepItem') {
    const toneAttr = cardTones.has(meta.tone) && meta.tone !== 'dark' ? ` data-tone="${meta.tone}"` : ' data-tone="teal"';
    const numHtml = meta.num ? `<span class="pillar-num">${escapeHtml(meta.num)}</span>` : '';
    const titleHtml = meta.title ? `<p class="pillar-title">${escapeHtml(meta.title)}</p>` : '';
    return `<div class="pillar-step"${toneAttr}>${numHtml}<div class="pillar-body">${titleHtml}`;
  }
  if (name === 'Panels') return '<div class="showcase-panels">';
  if (name === 'Panel') {
    const href = meta.href && /^https?:\/\/[^\s"<>{}]+$/i.test(meta.href) ? meta.href : '';
    const linkHtml = href
      ? ` <span class="panel-sep">—</span> <a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(meta.link || href)}</a>`
      : '';
    const headerHtml = meta.title || href
      ? `<header class="panel-header">${meta.title ? `<strong>${escapeHtml(meta.title)}</strong>` : ''}${linkHtml}</header>`
      : '';
    return `<section class="showcase-panel">${headerHtml}<div class="panel-body">`;
  }
  if (name === 'Flow') {
    const layoutAttr = meta.layout === 'rows' ? ' data-layout="rows"' : '';
    const variantAttr = meta.variant === 'plain' ? ' data-variant="plain"' : '';
    const toneAttr = ['blue', 'teal'].includes(meta.tone) ? ` data-tone="${meta.tone}"` : '';
    return `<div class="flow-board"${layoutAttr}${variantAttr}${toneAttr}><div class="flow-lanes">`;
  }
  if (name === 'Lane') {
    const toneAttr = cardTones.has(meta.tone) && meta.tone !== 'dark' ? ` data-tone="${meta.tone}"` : '';
    const titleHtml = meta.title ? `<p class="flow-lane-title">${escapeHtml(meta.title)}</p>` : '';
    const headHtml = meta.subtitle
      ? `<div class="flow-lane-head">${titleHtml}<p class="flow-lane-subtitle">${escapeHtml(meta.subtitle)}</p></div>`
      : titleHtml;
    return `<section class="flow-lane"${toneAttr}>${headHtml}<div class="flow-lane-steps">`;
  }
  if (name === 'Step') {
    const idAttr = meta.id && /^[A-Za-z][\w-]*$/.test(meta.id) ? ` data-step-id="${escapeHtml(meta.id)}"` : '';
    const toneAttr = (meta.tone === 'accent' || (cardTones.has(meta.tone) && meta.tone !== 'dark'))
      ? ` data-tone="${meta.tone}"` : '';
    const numHtml = meta.num ? `<span class="flow-step-num">${escapeHtml(meta.num)}</span>` : '';
    const titleHtml = meta.title ? `<p class="flow-step-title">${escapeHtml(meta.title)}</p>` : '';
    const headHtml = numHtml ? `<div class="flow-step-head">${numHtml}${titleHtml}</div>` : titleHtml;
    const badgeHtml = meta.badge ? `<span class="flow-step-badge">${escapeHtml(meta.badge)}</span>` : '';
    return `<article class="flow-step"${idAttr}${toneAttr}>${headHtml}${badgeHtml}`;
  }
  const type = calloutTypes[meta.type] ? meta.type : 'note';
  return `<aside class="callout" data-type="${type}"><p class="component-title">${escapeHtml(meta.title || calloutTypes[type])}</p>`;
};
md.renderer.rules.component_close = (tokens, index) => {
  const name = tokens[index].info;
  if (name === 'Cards' || name === 'Panels' || name === 'Split' || name === 'Stack' || name === 'Steps' || name === 'Col' || name === 'SectionLabel' || name === 'BadgeList') return '</div>';
  if (name === 'Flow' || name === 'StepItem' || name === 'BadgeRow') return '</div></div>';
  if (name === 'Card') {
    const meta = (tokens[index].meta ?? {}) as Record<string, string>;
    const colsClose = ['2', '3', '4'].includes(meta.columns) ? '</div>' : '';
    const footerHtml = meta.footer ? `<footer class="card-footer">${escapeHtml(meta.footer)}</footer>` : '';
    return `${colsClose}${footerHtml}</section>`;
  }
  if (name === 'Panel') {
    const meta = (tokens[index].meta ?? {}) as Record<string, string>;
    const footerHtml = meta.footer ? `<footer class="panel-footer">${escapeHtml(meta.footer)}</footer>` : '';
    return `</div>${footerHtml}</section>`;
  }
  if (name === 'Lane') return '</div></section>';
  if (name === 'Step') return '</article>';
  return '</aside>';
};

md.inline.ruler.before('escape', 'mark_note', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x3c) return false;
  const match = /^<Mark(?:\s+note="([^"<>{}]{1,200})")?\s*>([^<]{1,500})<\/Mark>/.exec(state.src.slice(state.pos));
  if (!match) return false;
  if (!silent) {
    const token = state.push('mark_note', '', 0);
    token.content = match[2];
    token.meta = { note: match[1] };
  }
  state.pos += match[0].length;
  return true;
});
md.renderer.rules.mark_note = (tokens, index) => {
  const { content, meta } = tokens[index];
  const note = (meta as { note?: string } | null)?.note;
  const marked = `<mark class="highlight">${md.renderInline(content)}</mark>`;
  return note ? `<span class="highlight-group">${marked}<span class="highlight-note">${escapeHtml(note)}</span></span>` : marked;
};
md.inline.ruler.before('escape', 'status_note', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x3c) return false;
  const match = /^<Status(?:\s+tone="(ok|accent|muted)")?\s*>([^<]{1,500})<\/Status>/.exec(state.src.slice(state.pos));
  if (!match) return false;
  if (!silent) {
    const token = state.push('status_note', '', 0);
    token.content = match[2];
    token.meta = { tone: match[1] || 'ok' };
  }
  state.pos += match[0].length;
  return true;
});
md.renderer.rules.status_note = (tokens, index) => {
  const { content, meta } = tokens[index];
  const tone = (meta as { tone?: string } | null)?.tone || 'ok';
  return `<span class="flow-status" data-tone="${escapeHtml(tone)}">${md.renderInline(content)}</span>`;
};
md.inline.ruler.before('escape', 'badge_pill', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x3c) return false;
  const match = /^<Badge(?:\s+tone="(red|amber|blue|green|teal|purple|muted)")?\s*>([^<]{1,200})<\/Badge>/.exec(state.src.slice(state.pos));
  if (!match) return false;
  if (!silent) {
    const token = state.push('badge_pill', '', 0);
    token.content = match[2];
    token.meta = { tone: match[1] || 'blue' };
  }
  state.pos += match[0].length;
  return true;
});
md.renderer.rules.badge_pill = (tokens, index) => {
  const { content, meta } = tokens[index];
  const tone = (meta as { tone?: string } | null)?.tone || 'blue';
  return `<span class="ui-badge" data-tone="${escapeHtml(tone)}">${md.renderInline(content)}</span>`;
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

export function markdown(source: string, assetBase?: string, assetMap?: Record<string, string>): HTMLElement {
  const element = document.createElement('div');
  element.className = 'slide-markdown';
  element.innerHTML = DOMPurify.sanitize(md.render(source, { assetBase, assetMap }), {
    FORBID_TAGS: ['iframe', 'object', 'form', 'script', 'style'],
  });
  if (assetMap) {
    for (const img of element.querySelectorAll<HTMLImageElement>('img.slide-image[data-asset-key]')) {
      const key = img.getAttribute('data-asset-key') || '';
      img.removeAttribute('data-asset-key');
      const dataUrl = assetMap[key];
      if (dataUrl && safeDataImage.test(dataUrl)) img.src = dataUrl;
    }
  }
  for (const img of element.querySelectorAll<HTMLImageElement>('img.slide-image[data-asset-alt]')) {
    const label = img.getAttribute('data-asset-alt') || 'Unlabelled image';
    img.removeAttribute('data-asset-alt');
    img.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'asset-fallback';
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', label);
      fallback.textContent = `Image unavailable: ${label}`;
      img.replaceWith(fallback);
    }, { once: true });
  }
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

let diagramCounter = 0;
let flowCounter = 0;
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

function drawFlowArrows(board: HTMLElement, boardId: number): void {
  const rect = board.getBoundingClientRect();
  let svg = board.querySelector<SVGSVGElement>(':scope > svg.flow-arrows');
  if (!svg) {
    svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('class', 'flow-arrows');
    svg.setAttribute('aria-hidden', 'true');
    board.append(svg);
  }
  svg.replaceChildren();
  if (rect.width < 4 || rect.height < 4) return;
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  const specs = [...board.querySelectorAll<HTMLElement>('.flow-arrow-spec[data-from][data-to]')];
  if (!specs.length) return;
  const defs = document.createElementNS(svgNamespace, 'defs');
  for (const [kind, color] of [['solid', 'var(--flow-arrow, var(--slide-accent))'], ['dashed', 'var(--slide-muted)']] as const) {
    const marker = document.createElementNS(svgNamespace, 'marker');
    marker.setAttribute('id', `flow-head-${kind}-${boardId}`);
    marker.setAttribute('viewBox', '0 0 8 8');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '4');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const tip = document.createElementNS(svgNamespace, 'path');
    tip.setAttribute('d', 'M 0 1 L 7 4 L 0 7 z');
    tip.setAttribute('fill', color);
    marker.append(tip);
    defs.append(marker);
  }
  svg.append(defs);
  for (const spec of specs) {
    const fromId = spec.dataset.from;
    const toId = spec.dataset.to;
    const style = spec.dataset.style === 'dashed' ? 'dashed' : 'solid';
    if (!fromId || !toId) continue;
    const fromEl = board.querySelector<HTMLElement>(`[data-step-id="${CSS.escape(fromId)}"]`);
    const toEl = board.querySelector<HTMLElement>(`[data-step-id="${CSS.escape(toId)}"]`);
    if (!fromEl || !toEl) continue;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    if (!a.width || !b.width) continue;
    const ax = (x: number) => Math.round((x - rect.left) * 10) / 10;
    const ay = (y: number) => Math.round((y - rect.top) * 10) / 10;
    let x1: number, y1: number, x2: number, y2: number;
    if (b.left >= a.right - 4) {
      x1 = ax(a.right); y1 = ay(a.top + a.height / 2);
      x2 = ax(b.left) - 2; y2 = ay(b.top + b.height / 2);
    } else if (a.left >= b.right - 4) {
      x1 = ax(a.left); y1 = ay(a.top + a.height / 2);
      x2 = ax(b.right) + 2; y2 = ay(b.top + b.height / 2);
    } else if (b.top >= a.bottom - 4) {
      x1 = ax(a.left + a.width / 2); y1 = ay(a.bottom);
      x2 = ax(b.left + b.width / 2); y2 = ay(b.top) - 2;
    } else {
      x1 = ax(a.left + a.width / 2); y1 = ay(a.top);
      x2 = ax(b.left + b.width / 2); y2 = ay(b.bottom) + 2;
    }
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', style === 'dashed' ? 'var(--slide-muted)' : 'var(--flow-arrow, var(--slide-accent))');
    path.setAttribute('stroke-width', '1.6');
    if (style === 'dashed') path.setAttribute('stroke-dasharray', '4 3');
    path.setAttribute('marker-end', `url(#flow-head-${style}-${boardId})`);
    svg.append(path);
  }
}

function mountFlows(root: HTMLElement): void {
  for (const board of root.querySelectorAll<HTMLElement>('.flow-board')) {
    if (!board.isConnected) continue;
    const id = ++flowCounter;
    drawFlowArrows(board, id);
    if (document.documentElement.dataset.exportStatic === 'true') continue;
    const observer = new ResizeObserver(() => {
      if (board.isConnected) drawFlowArrows(board, id);
    });
    observer.observe(board);
    mountedCharts.set(board, () => observer.disconnect());
    chartCleanup ??= new MutationObserver(cleanCharts);
    chartCleanup.observe(document.body, { childList: true, subtree: true });
  }
}

// Mermaid measures its viewBox in a detached scratch container; re-measure the live SVG so drawn content is never clipped.
// ponytail: fits once at insertion; diagrams inserted while hidden keep Mermaid's viewBox.
function fitViewBox(svg: SVGSVGElement | null): void {
  try {
    const box = svg?.getBBox();
    if (svg && box && box.width > 0 && box.height > 0) {
      const pad = 8;
      svg.setAttribute('viewBox', `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`);
    }
  } catch { /* Not rendered yet; keep Mermaid's viewBox. */ }
}

const chartAnnotationPalette: Record<string, { fg: string; bg: string; stroke: string }> = {
  red: { fg: '#991b1b', bg: '#fef2f2', stroke: '#dc2626' },
  amber: { fg: '#92400e', bg: '#fffbeb', stroke: '#d97706' },
  green: { fg: '#065f46', bg: '#ecfdf5', stroke: '#059669' },
  blue: { fg: '#1e40af', bg: '#eff6ff', stroke: '#0284c7' },
  teal: { fg: '#0f766e', bg: '#f0fdfa', stroke: '#0d9488' },
};

function drawChartAnnotations(
  svg: SVGSVGElement,
  canvas: HTMLElement,
  instance: { convertToPixel: (finder: { gridIndex?: number; xAxisIndex?: number }, value: number | Array<number | string>) => number | number[] },
  chart: ChartData,
  overlayId: number,
): void {
  svg.replaceChildren();
  if (!chart.annotations?.length) return;
  const w = canvas.clientWidth || 960;
  const h = canvas.clientHeight || 320;
  if (w < 40 || h < 40) return;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const defs = document.createElementNS(svgNamespace, 'defs');
  for (const [tone, pal] of Object.entries(chartAnnotationPalette)) {
    const marker = document.createElementNS(svgNamespace, 'marker');
    marker.setAttribute('id', `chart-head-${tone}-${overlayId}`);
    marker.setAttribute('viewBox', '0 0 8 8');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '4');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const tip = document.createElementNS(svgNamespace, 'path');
    tip.setAttribute('d', 'M 0 1 L 7 4 L 0 7 z');
    tip.setAttribute('fill', pal.stroke);
    marker.append(tip);
    defs.append(marker);
  }
  svg.append(defs);

  const catStep = chart.type !== 'scatter' && chart.labels.length > 1
    ? Math.abs(Number(instance.convertToPixel({ xAxisIndex: 0 }, 1)) - Number(instance.convertToPixel({ xAxisIndex: 0 }, 0))) || 60
    : 60;

  for (const ann of chart.annotations) {
    const tone = ann.tone && chartAnnotationPalette[ann.tone] ? ann.tone : 'blue';
    const pal = chartAnnotationPalette[tone];
    const xLookup = typeof ann.x === 'string' && chart.type !== 'scatter'
      ? (() => { const idx = chart.labels.indexOf(ann.x); return idx >= 0 ? idx : ann.x; })()
      : ann.x;
    const rawPt = instance.convertToPixel({ gridIndex: 0 }, [xLookup, ann.y]);
    if (!Array.isArray(rawPt) || !Number.isFinite(rawPt[0]) || !Number.isFinite(rawPt[1])) continue;
    let barShift = 0;
    if (chart.type === 'bar' && chart.series.length > 1 && ann.seriesIndex !== undefined) {
      barShift = ((ann.seriesIndex - (chart.series.length - 1) / 2) / chart.series.length) * (catStep * 0.68);
    }
    const tx = rawPt[0] + barShift;
    const ty = rawPt[1];
    const lines = ann.text.split('\n').slice(0, 3);
    const fs = Math.max(8.5, Math.min(11, w * 0.019));
    const lh = fs * 1.24;
    const maxChars = Math.max(...lines.map(l => l.length), 4);
    const bw = Math.round(maxChars * fs * 0.56 + 12);
    const bh = Math.round(lines.length * lh + 7);
    const dxPx = (ann.dx ?? 0) * (w / 520);
    const dyPx = (ann.dy ?? -38) * (h / 260);
    const bx = Math.min(w - bw / 2 - 4, Math.max(bw / 2 + 4, tx + dxPx));
    const by = Math.min(h - bh / 2 - 4, Math.max(bh / 2 + 4, ty + dyPx));
    const vx = tx - bx;
    const vy = ty - by;
    const dist = Math.hypot(vx, vy);
    if (dist > 6) {
      const edgeScale = 1 / Math.max(Math.abs(vx) / (bw / 2), Math.abs(vy) / (bh / 2), 1e-6);
      const sx = bx + vx * Math.min(1, edgeScale);
      const sy = by + vy * Math.min(1, edgeScale);
      const ux = vx / dist;
      const uy = vy / dist;
      const ex = tx - ux * 2;
      const ey = ty - uy * 2;
      if (Math.hypot(ex - sx, ey - sy) > 3) {
        const line = document.createElementNS(svgNamespace, 'line');
        line.setAttribute('x1', sx.toFixed(1));
        line.setAttribute('y1', sy.toFixed(1));
        line.setAttribute('x2', ex.toFixed(1));
        line.setAttribute('y2', ey.toFixed(1));
        line.setAttribute('stroke', pal.stroke);
        line.setAttribute('stroke-width', '1.6');
        line.setAttribute('marker-end', `url(#chart-head-${tone}-${overlayId})`);
        svg.append(line);
      }
    }
    const box = document.createElementNS(svgNamespace, 'rect');
    box.setAttribute('x', (bx - bw / 2).toFixed(1));
    box.setAttribute('y', (by - bh / 2).toFixed(1));
    box.setAttribute('width', String(bw));
    box.setAttribute('height', String(bh));
    box.setAttribute('fill', pal.bg);
    box.setAttribute('stroke', pal.stroke);
    box.setAttribute('stroke-width', '1.3');
    svg.append(box);
    const label = document.createElementNS(svgNamespace, 'text');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', pal.fg);
    label.setAttribute('font-size', fs.toFixed(1));
    label.setAttribute('font-weight', '700');
    const firstBaseline = by - ((lines.length - 1) * lh) / 2 + fs * 0.34;
    lines.forEach((txt, idx) => {
      const tspan = document.createElementNS(svgNamespace, 'tspan');
      tspan.setAttribute('x', bx.toFixed(1));
      tspan.setAttribute('y', (firstBaseline + idx * lh).toFixed(1));
      tspan.textContent = txt;
      label.append(tspan);
    });
    svg.append(label);
  }
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
          htmlLabels: false,
          flowchart: { htmlLabels: false },
          maxTextSize: 4000,
        });
        const { svg } = await mermaid.render(`slides-diagram-${++diagramCounter}`, source);
        if (!fence.isConnected) continue;
        fence.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'script'] });
        fitViewBox(fence.querySelector('svg'));
        fence.setAttribute('role', 'img');
        fence.setAttribute('aria-label', `Diagram: ${source.slice(0, 250)}`);
      } catch {
        if (fence.isConnected) textFallback(fence, 'Diagram could not be rendered.', source);
      }
    } else if (kind === 'chart') {
      try {
        const chart = parseChart(source);
        const table = document.createElement('table');
        const accessibleData = document.createElement('div');
        accessibleData.className = 'chart-data';
        accessibleData.append(table);
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
        const annotationSvg = document.createElementNS(svgNamespace, 'svg');
        annotationSvg.setAttribute('class', 'chart-annotations');
        annotationSvg.setAttribute('aria-hidden', 'true');
        fence.replaceChildren(canvas, annotationSvg, accessibleData);
        const staticExport = document.documentElement.dataset.exportStatic === 'true';
        const [echarts, { BarChart, LineChart, PieChart, ScatterChart }, { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent }, { CanvasRenderer, SVGRenderer }] = await Promise.all([
          import('echarts/core'),
          import('echarts/charts'),
          import('echarts/components'),
          import('echarts/renderers'),
        ]);
        echarts.use([BarChart, LineChart, PieChart, ScatterChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, CanvasRenderer, SVGRenderer]);
        if (!fence.isConnected) continue;
        const overlayId = ++diagramCounter;
        const instance = echarts.init(
          canvas,
          undefined,
          staticExport ? { renderer: 'svg', width: canvas.clientWidth || 960, height: canvas.clientHeight || 320 } : { renderer: 'canvas' },
        );
        try {
          const round = chart.type === 'pie' || chart.type === 'donut';
          const suffix = chart.valueSuffix ?? '';
          const markLineData = !round && chart.lines?.length
            ? chart.lines.map(ln => ({
                ...(ln.y !== undefined ? { yAxis: ln.y } : { xAxis: ln.x }),
                name: ln.label ?? '',
                lineStyle: { color: ln.color || '#64748b', type: ln.style || 'dashed', width: 1.5 },
                label: ln.label ? { show: true, formatter: ln.label, fontSize: 10, fontWeight: 700, color: ln.color || '#475569', position: ln.y !== undefined ? 'insideEndTop' : 'end' } : { show: false },
              }))
            : undefined;
          const markAreaData = !round && chart.zones?.length
            ? chart.zones.map(zn => [
                {
                  ...(zn.xMin !== undefined ? { xAxis: zn.xMin } : {}),
                  ...(zn.yMin !== undefined ? { yAxis: zn.yMin } : {}),
                  name: zn.label ?? '',
                  itemStyle: { color: zn.color || '#64748b', opacity: 0.1 },
                  label: zn.label ? { show: true, position: 'inside', fontSize: 10, fontWeight: 600, color: '#475569' } : { show: false },
                },
                {
                  ...(zn.xMax !== undefined ? { xAxis: zn.xMax } : {}),
                  ...(zn.yMax !== undefined ? { yAxis: zn.yMax } : {}),
                },
              ])
            : undefined;
          instance.setOption({
            animation: !staticExport && !matchMedia('(prefers-reduced-motion: reduce)').matches,
            tooltip: { trigger: round ? 'item' : 'axis', renderMode: 'richText' },
            legend: { top: 0, textStyle: { fontSize: 11 } },
            grid: { left: '6%', right: '5%', bottom: chart.x ? '13%' : '8%', top: '20%', containLabel: true },
            xAxis: round ? undefined : {
              type: chart.type === 'scatter' ? 'value' : 'category',
              data: chart.type === 'scatter' ? undefined : chart.labels,
              name: chart.x,
              nameLocation: chart.x ? 'middle' : undefined,
              nameGap: chart.x ? 22 : undefined,
              axisLabel: { fontSize: 10 },
            },
            yAxis: round ? undefined : {
              type: 'value',
              name: chart.y,
              max: chart.yMax,
              axisLabel: { fontSize: 10, formatter: suffix && !chart.y ? `{value}${suffix}` : undefined },
            },
            series: chart.series.map((item, sIdx) => ({
              name: item.name,
              type: round ? 'pie' : chart.type === 'bar' ? 'bar' : chart.type === 'scatter' ? 'scatter' : 'line',
              itemStyle: item.color ? { color: item.color } : undefined,
              lineStyle: !round && chart.type !== 'bar' && chart.type !== 'scatter'
                ? { type: item.style || 'solid', width: 2.2, ...(item.color ? { color: item.color } : {}) }
                : undefined,
              areaStyle: chart.type === 'area' || item.area ? { opacity: 0.16 } : undefined,
              label: chart.showValues && chart.type === 'bar'
                ? { show: true, position: 'top', fontSize: 9.5, fontWeight: 700, formatter: `{c}${suffix}` }
                : undefined,
              center: round ? ['50%', '55%'] : undefined,
              radius: chart.type === 'donut' ? ['36%', '60%'] : chart.type === 'pie' ? '60%' : undefined,
              data: round
                ? item.data.map((value, index) => ({ value, name: chart.labels[index] }))
                : item.pointColors
                  ? item.data.map((value, index) => item.pointColors?.[index]
                    ? { value, itemStyle: { color: item.pointColors[index]! } }
                    : value)
                  : item.data,
              ...(sIdx === 0 && markLineData ? { markLine: { silent: true, symbol: 'none', data: markLineData } } : {}),
              ...(sIdx === 0 && markAreaData ? { markArea: { silent: true, data: markAreaData } } : {}),
            })),
          });
          drawChartAnnotations(annotationSvg, canvas, instance, chart, overlayId);
        } catch (error) {
          instance.dispose();
          throw error;
        }
        const observer = new ResizeObserver(() => {
          if (canvas.isConnected) {
            instance.resize();
            drawChartAnnotations(annotationSvg, canvas, instance, chart, overlayId);
          }
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

export const themePresets: Record<string, Record<string, string>> = {
  signal: { surface: '#ffffff', text: '#1b1f24', accent: '#2563eb', muted: '#5b6470' },
  paper: { surface: '#fbf7ef', text: '#2b2620', accent: '#b4532a', muted: '#7a6f60' },
  midnight: { surface: '#0f172a', text: '#e2e8f0', accent: '#38bdf8', muted: '#94a3b8' },
  forest: { surface: '#f1f6f0', text: '#1d2b1f', accent: '#2f7d4a', muted: '#5d6f60' },
};

function setAppearance(host: HTMLElement, stage: Stage, slide?: Slide): void {
  const slidePreset = slide?.theme ? themePresets[slide.theme] : undefined;
  const preset = slidePreset || themePresets[stage.theme] || themePresets.signal;
  if (slidePreset && slide?.theme) host.dataset.slideTheme = slide.theme;
  else delete host.dataset.slideTheme;
  host.style.backgroundColor = 'var(--slide-surface)';
  host.style.color = 'var(--slide-text)';
  for (const key of ['surface', 'text', 'accent', 'muted'] as const) {
    const value = slidePreset ? undefined : stage.master?.[key];
    host.style.setProperty(`--slide-${key}`, typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : preset[key]);
  }
  for (const key of ['headingFont', 'bodyFont', 'codeFont'] as const) {
    const value = stage.master?.[key];
    const fallback = key === 'codeFont' ? defaultMonoFontStack : defaultSansFontStack;
    host.style.setProperty(`--${key}`, validFontFamily(value)
      ? value === 'system-ui' ? defaultSansFontStack
        : value === 'ui-monospace' ? defaultMonoFontStack
        : `${JSON.stringify(value)}, ${fallback}`
      : fallback);
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
  host.style.setProperty('--heading-align', ['left', 'center', 'right'].includes(String(stage.master?.headingPlacement))
    ? String(stage.master.headingPlacement) : 'left');
  for (const direction of ['Top', 'Right', 'Bottom', 'Left']) {
    for (const kind of ['margin', 'padding'] as const) {
      const value = stage.master?.[`${kind}${direction}`];
      host.style.setProperty(`--slide-${kind}-${direction.toLowerCase()}`,
        `${typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 20 ? value : kind === 'margin' ? 5 : 0}%`);
    }
  }
}

function decorateSlideHeader(container: HTMLElement, slide: Slide): void {
  let heading = container.querySelector<HTMLElement>(':scope > :is(h1, h2, h3):first-child');
  if (slide.hideTitle && heading) {
    heading.remove();
    heading = null;
  }
  if (slide.eyebrow) {
    const eyebrow = document.createElement('div');
    eyebrow.className = 'slide-eyebrow';
    eyebrow.textContent = slide.eyebrow;
    container.prepend(eyebrow);
  }
  if (slide.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'slide-subtitle';
    subtitle.textContent = slide.subtitle;
    const anchor = heading ?? container.querySelector(':scope > .slide-eyebrow');
    if (anchor) anchor.after(subtitle);
    else container.prepend(subtitle);
  }
}

export async function renderStage(host: HTMLElement, stage: Stage, slide: Slide | undefined, step: number): Promise<void> {
  host.replaceChildren();
  setAppearance(host, stage, slide);
  if (!slide) {
    host.textContent = 'Waiting for a slide…';
    return;
  }
  host.dataset.layout = slide.layout;
  if (slide.hideTitle) host.dataset.hideTitle = 'true';
  else delete host.dataset.hideTitle;
  if (slide.eyebrow) host.dataset.hasEyebrow = 'true';
  else delete host.dataset.hasEyebrow;
  if (slide.accentBar) host.dataset.accentBar = slide.accentBar;
  else delete host.dataset.accentBar;
  if (slide.layout !== 'blank') {
    const content = document.createElement('div');
    content.className = 'slide-content';
    if (slide.layout === 'title-image-left' || slide.layout === 'title-image-right') {
      const text = markdown(slide.body, stage.assetBase, stage.assetMap);
      decorateSlideHeader(text, slide);
      text.classList.add('slide-cover-text');
      const image = markdown(slide.slots?.image || '', stage.assetBase, stage.assetMap);
      image.classList.add('slide-cover-image');
      image.setAttribute('aria-label', 'Cover image');
      content.append(text, image);
    } else {
      const body = markdown(slide.body, stage.assetBase, stage.assetMap);
      decorateSlideHeader(body, slide);
      if (slide.layout === 'image-full') body.classList.add('slide-full-image');
      content.append(body);
    }
    const names = slide.layout === 'three-columns' ? ['left', 'center', 'right']
      : slide.layout === 'two-columns' ? ['left', 'right'] : slide.layout === 'picture-text' ? ['image', 'text'] : [];
    if (names.length) {
      const columns = document.createElement('div');
      columns.className = 'slide-columns';
      for (const name of names) {
        const column = markdown(slide.slots?.[name] || '', stage.assetBase, stage.assetMap);
        column.classList.add('slide-column');
        column.setAttribute('aria-label', `${name} column`);
        columns.append(column);
      }
      content.append(columns);
    }
    for (const [index, reveal] of (slide.reveals || []).entries()) {
      if (index >= step) break;
      const element = markdown(reveal, stage.assetBase, stage.assetMap);
      element.classList.add('slide-reveal');
      content.append(element);
    }
    host.append(content);
  }
  const master = stage.master || {};
  const assigned = metadataPositions.map(position => slide.metadata?.[`metadata${position}`] ?? master[`metadata${position}`]);
  for (const position of metadataPositions) {
    const configured = slide.metadata?.[`metadata${position}`] ?? master[`metadata${position}`];
    const kind = configured === undefined
      ? position === 'BottomLeft' && master.footer && !assigned.includes('footer') ? 'footer'
        : position === 'BottomRight' && master.footerNumber === true && !assigned.includes('slideNumber') ? 'slideNumber' : 'none'
      : configured;
    const value = kind === 'slideNumber' ? `${slide.index + 1} / ${stage.total ?? stage.slides.length}`
      : kind === 'deckTitle' ? stage.title
      : kind === 'slideTitle' ? slide.title || slide.body.match(/^#{1,3}\s+(.+)$/m)?.[1] || slide.id
      : kind === 'footer' || kind === 'logo' ? master[kind] : '';
    if (typeof value !== 'string' || !value) continue;
    const element = document.createElement('span');
    element.className = 'slide-meta';
    element.dataset.position = position;
    element.textContent = value;
    host.append(element);
  }
  await renderFences(host);
  mountFlows(host);
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
