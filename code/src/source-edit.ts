export type MasterValue = string | number | boolean;

const themes = ['signal', 'paper', 'midnight', 'forest'] as const;
export const themeNames = themes;
export const layouts = ['title-content', 'two-columns', 'three-columns', 'picture-text', 'blank'] as const;

function frontMatter(source: string): { start: number; end: number; value: string } {
  const normalized = source.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) {
    return { start: 0, end: 0, value: 'slides:\n  formatVersion: 1' };
  }
  return { start: 4, end: 4 + match[1].length, value: match[1] };
}

function splitInline(value: string): string[] {
  const pieces: string[] = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) escaped = false;
    else if (char === '\\' && quoted) escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      pieces.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  pieces.push(value.slice(start).trim());
  return pieces.filter(Boolean);
}

function changeMapping(source: string, mapping: 'master' | 'layouts', key: string, value?: MasterValue): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n/g, '\n');
  const front = frontMatter(source);
  const lines = front.value.split('\n');
  let index = lines.findIndex(line => new RegExp(`^  ${mapping}:`).test(line));
  const formatted = typeof value === 'string' ? JSON.stringify(value) : String(value);
  if (index < 0) {
    if (value === undefined) return source;
    const slides = lines.findIndex(line => /^slides:\s*$/.test(line));
    if (slides < 0) throw new Error('Cannot change settings: expected a slides: front matter section.');
    lines.splice(slides + 1, 0, `  ${mapping}: { ${key}: ${formatted} }`);
  } else {
    const inline = /^  [\w-]+:\s*\{(.*)\}\s*$/.exec(lines[index]);
    if (inline) {
      const entries = splitInline(inline[1]).filter(entry => entry.split(':', 1)[0].trim() !== key);
      if (value !== undefined) entries.push(`${key}: ${formatted}`);
      lines[index] = `  ${mapping}: { ${entries.join(', ')} }`;
    } else if (/^  [\w-]+:\s*$/.test(lines[index])) {
      let end = index + 1;
      while (end < lines.length && (lines[end].startsWith('    ') || !lines[end].trim())) end++;
      const existing = lines.slice(index + 1, end);
      const position = existing.findIndex(line => new RegExp(`^    ${key}:`).test(line));
      if (position >= 0) existing.splice(position, 1);
      if (value !== undefined) existing.push(`    ${key}: ${formatted}`);
      lines.splice(index + 1, end - index - 1, ...existing);
    } else {
      throw new Error(`Cannot change ${mapping}: unsupported front matter shape.`);
    }
  }
  const body = normalized.slice(front.end);
  const result = front.end === 0
    ? `---\n${lines.join('\n').trimEnd()}\n---\n\n${normalized}`
    : `${normalized.slice(0, front.start)}${lines.join('\n')}${body}`;
  return result.replace(/\n/g, newline);
}

export function setTheme(source: string, theme: string): string {
  if (!themes.includes(theme as typeof themes[number])) throw new Error(`Unknown theme: ${theme}`);
  return changeMapping(source, 'master', 'theme', theme);
}

export function clearTheme(source: string): string {
  return changeMapping(source, 'master', 'theme');
}

export function setMaster(source: string, field: string, value?: MasterValue): string {
  if (!/^(surface|text|accent|muted|headingFont|bodyFont|codeFont|headingSize|bodySize|codeSize|background|backdrop|logo|footer|footerNumber|metadata(Top|Bottom)(Left|Center|Right))$/.test(field)) {
    throw new Error(`Unknown master field: ${field}`);
  }
  return changeMapping(source, 'master', field, value);
}

export function setDeckTitle(source: string, title: string): string {
  if (!title.trim() || title.length > 120 || /[\r\n]/.test(title)) throw new Error('Enter a title of 1–120 characters on one line.');
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n/g, '\n');
  const front = frontMatter(source);
  const lines = front.value.split('\n');
  const slides = lines.findIndex(line => /^slides:\s*$/.test(line));
  if (slides < 0) throw new Error('Cannot change title: expected a slides: front matter section.');
  const index = lines.findIndex(line => /^  title:/.test(line));
  if (index >= 0) lines[index] = `  title: ${JSON.stringify(title.trim())}`;
  else lines.splice(slides + 1, 0, `  title: ${JSON.stringify(title.trim())}`);
  const result = front.end === 0
    ? `---\n${lines.join('\n')}\n---\n\n${normalized}`
    : `${normalized.slice(0, front.start)}${lines.join('\n')}${normalized.slice(front.end)}`;
  return result.replace(/\n/g, newline);
}
export function setLayout(source: string, slideId: string, layout: string): string {
  if (!layouts.includes(layout as typeof layouts[number])) throw new Error(`Unknown layout: ${layout}`);
  if (!/^[\w.-]+$/.test(slideId)) throw new Error('Invalid slide ID.');
  const escaped = slideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const slide = new RegExp(`(^::slide\\{id="${escaped}"[^\\n}]*)(\\})`, 'm');
  if (!slide.test(source)) throw new Error(`Slide ${slideId} was not found in source.`);
  return source.replace(slide, (_match, prefix: string, suffix: string) =>
    `${prefix.replace(/\s+layout="[^"]*"/, '')} layout="${layout}"${suffix}`);
}

export function addSlide(source: string, parent?: string): string {
  if (parent && !/^[\w.-]+$/.test(parent)) throw new Error('Invalid parent slide ID.');
  const id = `slide-${crypto.randomUUID().slice(0, 8)}`;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return `${source.trimEnd()}${newline}${newline}::slide{id="${id}"${parent ? ` parent="${parent}"` : ''}}${newline}${newline}## New slide${newline}${newline}`;
}

export interface EditableLine { start: number; end: number; text: string; display: string }

export function editableLines(source: string, slideId: string, body: string): EditableLine[] {
  if (!/^[\w.-]+$/.test(slideId)) return [];
  const baseline: string[] = [];
  const editable: EditableLine[] = [];
  let active = false;
  let found = false;
  let container = false;
  let fence = '';
  for (const match of source.matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, '');
    const trimmed = line.trim();
    const marker = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    const inFence = !!fence || !!marker;
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = '';
    }
    if (!inFence && /^::slide\{/.test(trimmed)) {
      if (active) break;
      active = /\bid="([^"]+)"/.exec(trimmed)?.[1] === slideId;
      found ||= active;
      continue;
    }
    if (!active) continue;
    if (!inFence && trimmed === ':::') { container = false; continue; }
    if (!inFence && trimmed.startsWith(':::')) { container = true; continue; }
    if (container) continue;
    baseline.push(line);
    if (inFence || !trimmed || /^\s*(?:#|>|[-*+]|\d+\.|::|!|\|)/.test(line) ||
        /(^|[^\\])(?:\\\\)*[`*_![\]<>$~]/.test(line) ||
        /\\(?![\\`*_{}\[\]()#+.!|>~:$-])/.test(line)) continue;
    editable.push({
      text: line,
      start: match.index!,
      end: match.index! + line.length,
      display: line.replace(/\\([\\`*_{}\[\]()#+.!|>~:$-])/g, '$1'),
    });
  }
  return found && baseline.join('\n').trim() === body.trim() ? editable : [];
}

export function replacePlainLine(source: string, line: EditableLine, replacement: string): string {
  if (source.slice(line.start, line.end) !== line.text || /[\r\n]/.test(replacement)) {
    throw new Error('Preview edit is stale or contains a newline.');
  }
  const escaped = replacement.replace(/([\\`*_{}\[\]()#+.!|>~:$-])/g, '\\$1');
  return source.slice(0, line.start) + escaped + source.slice(line.end);
}
