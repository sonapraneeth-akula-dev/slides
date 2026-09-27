import YAML from 'yaml';

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
  let quoted = '';
  let escaped = false;
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) escaped = false;
    else if (char === '\\' && quoted === '"') escaped = true;
    else if (quoted) { if (char === quoted) quoted = ''; }
    else if (char === '"' || char === "'") quoted = char;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
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
      if (!existing.some(line => line.trim())) lines[index] = `  ${mapping}: {}`;
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

function changeMetadata(source: string, key: string, value?: MasterValue): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const normalized = source.replace(/\r\n/g, '\n');
  const front = frontMatter(source);
  const lines = front.value.split('\n');
  const master = lines.findIndex(line => /^  master:/.test(line));
  const formatted = typeof value === 'string' ? JSON.stringify(value) : String(value);
  if (master < 0) {
    if (value === undefined) return source;
    const slides = lines.findIndex(line => /^slides:\s*$/.test(line));
    if (slides < 0) throw new Error('Cannot change settings: expected a slides: front matter section.');
    lines.splice(slides + 1, 0, `  master:\n    metadata:\n      ${key}: ${formatted}`);
  } else {
    const inlineMaster = /^  master:\s*\{(.*)\}\s*$/.exec(lines[master]);
    if (inlineMaster) {
      const entries = splitInline(inlineMaster[1]);
      const index = entries.findIndex(entry => /^metadata\s*:/.test(entry));
      if (index < 0) {
        if (value === undefined) return source;
        entries.push(`metadata: { ${key}: ${formatted} }`);
      } else {
        const nested = /^metadata:\s*\{(.*)\}\s*$/.exec(entries[index]);
        if (!nested) throw new Error('Cannot change metadata: expected a mapping.');
        const fields = splitInline(nested[1]).filter(entry => entry.split(':', 1)[0].trim() !== key);
        if (value !== undefined) fields.push(`${key}: ${formatted}`);
        if (fields.length) entries[index] = `metadata: { ${fields.join(', ')} }`;
        else entries.splice(index, 1);
      }
      lines[master] = `  master: { ${entries.join(', ')} }`;
    } else if (/^  master:\s*$/.test(lines[master])) {
      let end = master + 1;
      while (end < lines.length && (lines[end].startsWith('    ') || !lines[end].trim())) end++;
      const index = lines.findIndex((line, position) => position > master && position < end && /^    metadata:/.test(line));
      if (index < 0) {
        if (value === undefined) return source;
        lines.splice(end, 0, `    metadata:\n      ${key}: ${formatted}`);
      } else {
        const inline = /^    metadata:\s*\{(.*)\}\s*$/.exec(lines[index]);
        if (inline) {
          const fields = splitInline(inline[1]).filter(entry => entry.split(':', 1)[0].trim() !== key);
          if (value !== undefined) fields.push(`${key}: ${formatted}`);
          if (fields.length) lines[index] = `    metadata: { ${fields.join(', ')} }`;
          else lines.splice(index, 1);
        } else if (/^    metadata:\s*$/.test(lines[index])) {
          let nestedEnd = index + 1;
          while (nestedEnd < end && (lines[nestedEnd].startsWith('      ') || !lines[nestedEnd].trim())) nestedEnd++;
          const fields = lines.slice(index + 1, nestedEnd);
          const position = fields.findIndex(line => new RegExp(`^      ${key}:`).test(line));
          if (position >= 0) fields.splice(position, 1);
          if (value !== undefined) fields.push(`      ${key}: ${formatted}`);
          if (!fields.some(line => line.trim())) lines.splice(index, nestedEnd - index);
          else lines.splice(index + 1, nestedEnd - index - 1, ...fields);
        } else throw new Error('Cannot change metadata: expected a mapping.');
      }
    } else if (/^  master:\s*\{\s*\}\s*$/.test(lines[master])) {
      if (value === undefined) return source;
      lines[master] = `  master:\n    metadata:\n      ${key}: ${formatted}`;
    } else throw new Error('Cannot change master: unsupported front matter shape.');
  }
  const result = front.end === 0
    ? `---\n${lines.join('\n').trimEnd()}\n---\n\n${normalized}`
    : `${normalized.slice(0, front.start)}${lines.join('\n')}${normalized.slice(front.end)}`;
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
  if (!/^(surface|text|accent|muted|headingFont|headingPlacement|bodyFont|codeFont|headingSize|bodySize|codeSize|background|backdrop|logo|footer|footerNumber|(margin|padding)(Top|Right|Bottom|Left)|metadata(Top|Bottom)(Left|Center|Right))$/.test(field)) {
    throw new Error(`Unknown master field: ${field}`);
  }
  if (field.startsWith('metadata')) {
    const updated = changeMetadata(source, field, value);
    return changeMapping(updated, 'master', field);
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

export function insertSlide(source: string, parent?: string, after?: string): { text: string; id: string; start: number } {
  if (parent && !/^[\w.-]+$/.test(parent)) throw new Error('Invalid parent slide ID.');
  if (after && !/^[\w.-]+$/.test(after)) throw new Error('Invalid selected slide ID.');
  let id = `slide-${crypto.randomUUID().slice(0, 8)}`;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  let content = `::slide{id="${id}"${parent ? ` parent="${parent}"` : ''}}${newline}${newline}## New slide${newline}${newline}`;
  if (!parent && !after) {
    const prefix = `${source.trimEnd()}${newline}${newline}`;
    return { text: prefix + content, id, start: prefix.length };
  }
  const slides = sourceSlides(source);
  if (!slides || new Set(slides.map(slide => slide.id.value)).size !== slides.length) {
    throw new Error('Fix slide directives before adding a slide.');
  }
  while (slides.some(slide => slide.id.value === id)) id = `slide-${crypto.randomUUID().slice(0, 8)}`;
  content = `::slide{id="${id}"${parent ? ` parent="${parent}"` : ''}}${newline}${newline}## New slide${newline}${newline}`;
  const anchor = parent || after!;
  const byId = new Map(slides.map(slide => [slide.id.value, slide]));
  if (!byId.has(anchor)) throw new Error(`Slide ${anchor} was not found in source.`);
  const children = new Map<string, SlideIds[]>();
  const roots: SlideIds[] = [];
  for (const slide of slides) {
    const ancestor = slide.parent?.value;
    if (!ancestor) roots.push(slide);
    else {
      if (!byId.has(ancestor)) throw new Error(`Unknown parent slide: ${ancestor}`);
      const siblings = children.get(ancestor) || [];
      siblings.push(slide);
      children.set(ancestor, siblings);
    }
  }
  const ordered: SlideIds[] = [];
  const seen = new Set<string>();
  function visit(slide: SlideIds): void {
    if (seen.has(slide.id.value)) throw new Error('Fix slide hierarchy before adding a slide.');
    seen.add(slide.id.value);
    ordered.push(slide);
    for (const child of children.get(slide.id.value) || []) visit(child);
  }
  for (const root of roots) visit(root);
  if (ordered.length !== slides.length) throw new Error('Fix slide hierarchy before adding a slide.');
  const alreadyOrdered = ordered.every((slide, index) => slide === slides[index]);
  const blocks = alreadyOrdered ? null : new Map(slides.map((slide, index) =>
    [slide, source.slice(slide.start, slides[index + 1]?.start ?? source.length)]));
  const arranged = blocks ? source.slice(0, slides[0].start) + ordered.map(slide => blocks.get(slide)!).join('') : source;
  const arrangedSlides = arranged === source ? slides : sourceSlides(arranged)!;
  const arrangedById = new Map(arrangedSlides.map(slide => [slide.id.value, slide]));
  let target = anchor;
  if (!parent) {
    const visited = new Set<string>();
    while (arrangedById.get(target)?.parent?.value) {
      if (visited.has(target)) throw new Error('Fix slide hierarchy before adding a slide.');
      visited.add(target);
      target = arrangedById.get(target)!.parent!.value;
    }
  }
  const index = arrangedSlides.findIndex(slide => slide.id.value === target);
  const next = arrangedSlides.slice(index + 1).find(slide => {
    let ancestor = slide.parent?.value;
    const seen = new Set<string>();
    while (ancestor && !seen.has(ancestor)) {
      if (ancestor === target) return false;
      seen.add(ancestor);
      ancestor = arrangedById.get(ancestor)?.parent?.value;
    }
    return true;
  });
  if (!next) {
    const prefix = `${arranged.trimEnd()}${newline}${newline}`;
    return { text: prefix + content, id, start: prefix.length };
  }
  const before = arranged.slice(0, next.start);
  const separator = before.endsWith(newline + newline) ? '' : before.endsWith(newline) ? newline : newline + newline;
  return { text: `${before}${separator}${content}${arranged.slice(next.start)}`, id, start: before.length + separator.length };
}

export function addSlide(source: string, parent?: string, after?: string): string {
  return insertSlide(source, parent, after).text;
}

type IdSpan = { value: string; start: number; end: number };
type SlideIds = { id: IdSpan; parent?: IdSpan; directive: string; start: number };
type IdReplacement = { start: number; end: number; value: string };

function sourceSlides(source: string): SlideIds[] | null {
  const result: SlideIds[] = [];
  let fence = '';
  let frontMatter = source.startsWith('---\n') || source.startsWith('---\r\n');
  let firstLine = true;
  for (const match of source.matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, '');
    const trimmed = line.trim();
    if (frontMatter) {
      if (firstLine) { firstLine = false; continue; }
      if (trimmed === '---') frontMatter = false;
      continue;
    }
    firstLine = false;
    const marker = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = '';
    }
    if (fence || marker || !trimmed.startsWith('::slide{')) continue;
    const directive = /^::slide\{(.*)\}$/.exec(trimmed);
    if (!directive) return null;
    const attributes = new Map<string, IdSpan>();
    let rest = directive[1];
    let offset = match.index! + line.indexOf('::slide{') + '::slide{'.length;
    while (rest.trim()) {
      const spaces = /^\s*/.exec(rest)![0].length;
      rest = rest.slice(spaces);
      offset += spaces;
      const attribute = /^([a-zA-Z][\w-]*)="([^"]*)"(?:\s+|$)/.exec(rest);
      if (!attribute || attributes.has(attribute[1]) || !['id', 'parent', 'layout'].includes(attribute[1])) return null;
      const start = offset + attribute[1].length + 2;
      attributes.set(attribute[1], { value: attribute[2], start, end: start + attribute[2].length });
      offset += attribute[0].length;
      rest = rest.slice(attribute[0].length);
    }
    const id = attributes.get('id');
    if (!id || !/^[A-Za-z][\w-]*$/.test(id.value)) return null;
    result.push({ id, parent: attributes.get('parent'), directive: trimmed, start: match.index! });
  }
  return frontMatter ? null : result;
}

export function hasUniqueSlideIds(source: string): boolean {
  const slides = sourceSlides(source);
  return !!slides?.length && new Set(slides.map(slide => slide.id.value)).size === slides.length;
}

export function propagateSlideIdChange(previous: string, current: string):
  { text: string; oldId: string; newId: string; replacements: IdReplacement[] } | null {
  const oldSlides = sourceSlides(previous);
  const newSlides = sourceSlides(current);
  if (!oldSlides?.length || !newSlides || oldSlides.length !== newSlides.length ||
      new Set(oldSlides.map(slide => slide.id.value)).size !== oldSlides.length ||
      new Set(newSlides.map(slide => slide.id.value)).size !== newSlides.length) return null;
  const renamed = oldSlides.flatMap((slide, index) => slide.id.value === newSlides[index].id.value ? [] : [index]);
  if (renamed.length !== 1) return null;
  const index = renamed[0];
  const oldId = oldSlides[index].id.value;
  const newId = newSlides[index].id.value;
  if (oldSlides[index].directive.replace(`id="${oldId}"`, 'id=""') !==
      newSlides[index].directive.replace(`id="${newId}"`, 'id=""')) return null;
  const replacements: IdReplacement[] = newSlides
    .filter(slide => slide.parent?.value === oldId)
    .map(slide => ({ start: slide.parent!.start, end: slide.parent!.end, value: newId }));

  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(current);
  if (front) {
    const document = YAML.parseDocument(front[1], { uniqueKeys: true });
    if (document.errors.length) throw new Error('Fix YAML frontmatter before renaming a slide ID.');
    const layouts = document.getIn(['slides', 'layouts'], true);
    if (YAML.isMap(layouts)) {
      const key = layouts.items.find(pair => YAML.isScalar(pair.key) && pair.key.value === oldId)?.key;
      if (YAML.isScalar(key) && key.range) {
        if (layouts.items.some(pair => YAML.isScalar(pair.key) && pair.key.value === newId)) {
          throw new Error(`Cannot rename slide ID: slides.layouts already has a key for ${newId}.`);
        }
        const start = front.index! + front[0].indexOf(front[1]) + key.range[0];
        const original = current.slice(start, front.index! + front[0].indexOf(front[1]) + key.range[1]);
        const value = original.startsWith('"') ? JSON.stringify(newId)
          : original.startsWith("'") ? `'${newId}'` : newId;
        replacements.push({ start, end: start + original.length, value });
      }
    }
  }
  let text = current;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, replacement.start) + replacement.value + text.slice(replacement.end);
  }
  return { text, oldId, newId, replacements };
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
