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
  if (!/^(surface|text|accent|muted|headingFont|bodyFont|codeFont|headingSize|bodySize|codeSize|background|backdrop|logo|footer|footerNumber)$/.test(field)) {
    throw new Error(`Unknown master field: ${field}`);
  }
  return changeMapping(source, 'master', field, value);
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

export function editableLine(source: string, slideId: string, body: string): EditableLine | null {
  if (!/^[\w.-]+$/.test(slideId)) return null;
  const escaped = slideId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^::slide\\{id="${escaped}"[^\\n]*\\}\\r?\\n`, 'm').exec(source);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = source.indexOf('\n::slide{', start);
  const block = source.slice(start, end < 0 ? source.length : end);
  if (block.includes(':::') || block.includes('```')) return null;
  const lines = [...block.matchAll(/(?:^|\n)([^\r\n]+)/g)]
    .map(hit => ({
      text: hit[1],
      start: start + hit.index! + (hit[0].startsWith('\n') ? 1 : 0),
      display: hit[1].replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g, '$1'),
    }))
    .filter(line => line.text.trim() &&
      !/^\s*(?:#|>|-|\*|\d+\.|::|!|\|)/.test(line.text) &&
      !/(^|[^\\])(?:\\\\)*[`*_![\]<>]/.test(line.text) &&
      !/\\(?![\\`*_{}\[\]()#+.!|>~-])/.test(line.text));
  const plain = body.trim().split(/\r?\n/).filter(line => line.trim() && !/^#/.test(line));
  if (lines.length !== 1 || plain.length !== 1 || lines[0].display !== plain[0]) return null;
  return { ...lines[0], end: lines[0].start + lines[0].text.length };
}

export function replacePlainLine(source: string, line: EditableLine, replacement: string): string {
  if (source.slice(line.start, line.end) !== line.text || /[\r\n]/.test(replacement)) {
    throw new Error('Preview edit is stale or contains a newline.');
  }
  const escaped = replacement.replace(/([\\`*_{}\[\]()#+.!|>~-])/g, '\\$1');
  return source.slice(0, line.start) + escaped + source.slice(line.end);
}
