import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { compileDeck, type Compilation } from './deck';
import { parseChart, safeMermaid } from './fence-validation';
import { hasSymlink, libraryRoot } from './library';
import { parseAssetReference, sampleImageReference } from './sample-image-reference';

export interface LintDiagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
  slideId?: string;
  permissionBlocked?: boolean;
  sourceSpan: { start: number; end: number };
}

export interface LintResult {
  compilation: Compilation;
  diagnostics: LintDiagnostic[];
}

function spanForLine(lines: string[], rawLine: number, column = 1): { start: number; end: number } {
  const safeLine = Math.min(Math.max(rawLine, 1), Math.max(1, lines.length));
  const start = lines.slice(0, safeLine - 1).reduce((total, text) => total + text.length + 1, 0) + Math.max(0, column - 1);
  return { start, end: start + (lines[safeLine - 1]?.length ?? 0) };
}

function slideRanges(lines: string[]): Array<{ id: string; startLine: number; endLine: number }> {
  const ranges: Array<{ id: string; startLine: number; endLine: number }> = [];
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (trimmed.startsWith(fence[0].repeat(fence.length))) fence = undefined;
      continue;
    }
    if (fence || !trimmed.startsWith('::slide{')) continue;
    const id = /\bid="([A-Za-z][\w-]*)"/.exec(trimmed)?.[1];
    if (!id) continue;
    if (ranges.length) ranges[ranges.length - 1].endLine = i;
    ranges.push({ id, startLine: i + 1, endLine: lines.length });
  }
  return ranges;
}

export async function lintDeck(
  source: string,
  options?: {
    filenameTitle?: string;
    checkAsset?: (relPath: string) => Promise<'ok' | 'missing' | 'symlink'>;
  },
): Promise<LintResult> {
  const compilation = compileDeck(source, options?.filenameTitle);
  const lines = source.split(/\r?\n/);
  const ranges = slideRanges(lines);
  const ownerSlide = (line: number) => ranges.find(range => line >= range.startLine && line <= range.endLine)?.id;

  const diagnostics: LintDiagnostic[] = compilation.diagnostics.map(diag => ({
    line: diag.line,
    column: diag.column,
    severity: 'error',
    code: 'SYNTAX_ERROR',
    message: diag.message,
    slideId: ownerSlide(diag.line),
    sourceSpan: spanForLine(lines, diag.line, diag.column),
  }));

  if (!compilation.deck) return { compilation, diagnostics };

  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const slide of compilation.deck.slides) {
    const directiveLine = ranges.find(range => range.id === slide.id)?.startLine ?? slide.items[0]?.line ?? 1;
    const firstNonEmpty = slide.items.findIndex(item => item.text.trim().length > 0);
    const visibleItems = slide.hideTitle
      ? slide.items.filter((item, idx) => !(idx === firstNonEmpty && !item.slot && item.step === 0 && /^#{1,3}\s+/.test(item.text.trim())))
      : slide.items;
    const hasContent = visibleItems.some(item => item.text.trim().length > 0);
    if (slide.layout !== 'blank' && !hasContent) {
      diagnostics.push({
        line: directiveLine,
        column: 1,
        severity: 'warning',
        code: 'EMPTY_SLIDE',
        message: `Slide "${slide.id}" has no visible content`,
        slideId: slide.id,
        sourceSpan: spanForLine(lines, directiveLine),
      });
      continue;
    }

    let fenceMarker: string | undefined;
    let fenceLang = '';
    let fenceStartLine = directiveLine;
    let fenceBody: string[] = [];
    let proseLines = 0;
    let proseChars = 0;

    for (const item of slide.items) {
      const trimmed = item.text.trim();
      const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);
      if (fenceMatch) {
        if (!fenceMarker) {
          fenceMarker = fenceMatch[1];
          fenceLang = /^[^\s{]*/.exec(fenceMatch[2].trim())?.[0].toLowerCase() ?? '';
          fenceStartLine = item.line;
          fenceBody = [];
        } else if (trimmed.startsWith(fenceMarker[0].repeat(fenceMarker.length))) {
          const content = fenceBody.join('\n');
          if (fenceLang === 'chart') {
            try { parseChart(content); }
            catch (error) {
              diagnostics.push({
                line: fenceStartLine,
                column: 1,
                severity: 'error',
                code: 'CHART_INVALID',
                message: error instanceof Error ? error.message : 'Invalid chart block',
                slideId: slide.id,
                sourceSpan: spanForLine(lines, fenceStartLine),
              });
            }
          } else if (fenceLang === 'mermaid' && !safeMermaid(content)) {
            diagnostics.push({
              line: fenceStartLine,
              column: 1,
              severity: 'error',
              code: 'MERMAID_INVALID',
              message: 'Mermaid diagram is outside the supported safe grammar',
              slideId: slide.id,
              sourceSpan: spanForLine(lines, fenceStartLine),
            });
          }
          fenceMarker = undefined;
          fenceLang = '';
          fenceBody = [];
        }
        continue;
      }
      if (fenceMarker) {
        fenceBody.push(item.text);
        continue;
      }
      if (trimmed) {
        proseLines++;
        proseChars += trimmed.length;
      }
      const strippedCode = item.text.replace(/`+[^`]*`+/g, match => ' '.repeat(match.length));
      for (const match of strippedCode.matchAll(imagePattern)) {
        const alt = match[1].trim();
        const src = match[2];
        const col = (match.index ?? 0) + 1;
        if (!alt) {
          diagnostics.push({
            line: item.line,
            column: col,
            severity: 'warning',
            code: 'IMAGE_ALT_MISSING',
            message: `Image "${src}" is missing descriptive alt text`,
            slideId: slide.id,
            sourceSpan: spanForLine(lines, item.line, col),
          });
        }
        if (src === sampleImageReference) continue;
        const rel = parseAssetReference(src);
        if (!rel) {
          diagnostics.push({
            line: item.line,
            column: col,
            severity: 'warning',
            code: 'ASSET_DISALLOWED',
            message: `Disallowed or external image path "${src}" (use relative assets/<name>)`,
            slideId: slide.id,
            permissionBlocked: true,
            sourceSpan: spanForLine(lines, item.line, col),
          });
          continue;
        }
        if (options?.checkAsset) {
          const state = await options.checkAsset(rel);
          if (state === 'symlink') {
            diagnostics.push({
              line: item.line,
              column: col,
              severity: 'warning',
              code: 'ASSET_SYMLINK',
              message: `Image asset "assets/${rel}" is a symlink and will not be served`,
              slideId: slide.id,
              permissionBlocked: true,
              sourceSpan: spanForLine(lines, item.line, col),
            });
          } else if (state === 'missing') {
            diagnostics.push({
              line: item.line,
              column: col,
              severity: 'warning',
              code: 'ASSET_MISSING',
              message: `Image asset "assets/${rel}" was not found`,
              slideId: slide.id,
              sourceSpan: spanForLine(lines, item.line, col),
            });
          }
        }
      }
    }

    if (proseLines > 18 || proseChars > 1200) {
      diagnostics.push({
        line: directiveLine,
        column: 1,
        severity: 'warning',
        code: 'SLIDE_DENSE',
        message: `Slide "${slide.id}" is dense (${proseLines} lines, ${proseChars} chars); consider splitting or using reveals`,
        slideId: slide.id,
        sourceSpan: spanForLine(lines, directiveLine),
      });
    }
  }

  const hasErrors = diagnostics.some(diag => diag.severity === 'error');
  return {
    compilation: hasErrors ? { deck: null, diagnostics: compilation.diagnostics } : compilation,
    diagnostics,
  };
}

export async function checkAssetAtDirectory(deckDir: string, relPath: string, root = libraryRoot): Promise<'ok' | 'missing' | 'symlink'> {
  for (const candidate of [join(deckDir, 'assets', ...relPath.split('/')), join(root, 'assets', ...relPath.split('/'))]) {
    let info;
    try { info = await stat(candidate); }
    catch (error) {
      if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) continue;
      throw error;
    }
    if (await hasSymlink(candidate)) return 'symlink';
    if (info.isFile() && info.size <= 10_000_000) return 'ok';
  }
  return 'missing';
}

export async function runLintCli(
  rawArgs: string[],
  io: { stdout: (line: string) => void; stderr: (line: string) => void } = {
    stdout: line => console.log(line),
    stderr: line => console.error(line),
  },
): Promise<number> {
  const jsonMode = rawArgs.includes('--json');
  const targets = rawArgs.filter(arg => arg !== '--json' && !arg.startsWith('-'));
  if (!targets.length) {
    io.stderr('Usage: slides lint [--json] <deck.mdx|deck.md> [...]');
    return 2;
  }

  let hasIoFailure = false;
  let hasPermissionBlock = false;
  let hasContentError = false;
  const reports: Array<{ file: string; status: string; diagnostics: LintDiagnostic[] }> = [];

  for (const target of targets) {
    const resolved = resolve(target);
    const ext = extname(resolved).toLowerCase();
    if (ext !== '.md' && ext !== '.mdx') {
      hasIoFailure = true;
      io.stderr(`${target}: Unsupported file extension (expected .md or .mdx)`);
      reports.push({ file: target, status: 'io-error', diagnostics: [] });
      continue;
    }
    let symlink: boolean;
    try {
      symlink = await hasSymlink(resolved);
    } catch (error) {
      hasIoFailure = true;
      io.stderr(`${target}: ${error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 'File not found' : 'Cannot access file'}`);
      reports.push({ file: target, status: 'io-error', diagnostics: [] });
      continue;
    }
    if (symlink) {
      hasPermissionBlock = true;
      io.stderr(`${target}: Permission blocked (symlink paths are not allowed)`);
      reports.push({ file: target, status: 'permission-blocked', diagnostics: [] });
      continue;
    }
    let fileStat;
    let source: string;
    try {
      fileStat = await stat(resolved);
      if (!fileStat.isFile()) {
        hasIoFailure = true;
        io.stderr(`${target}: Not a regular file`);
        reports.push({ file: target, status: 'io-error', diagnostics: [] });
        continue;
      }
      source = await readFile(resolved, 'utf8');
    } catch {
      hasIoFailure = true;
      io.stderr(`${target}: Cannot read file`);
      reports.push({ file: target, status: 'io-error', diagnostics: [] });
      continue;
    }

    const title = basename(resolved).replace(/\.(md|mdx)$/i, '');
    const deckDir = dirname(resolved);
    const { diagnostics } = await lintDeck(source, {
      filenameTitle: title,
      checkAsset: rel => checkAssetAtDirectory(deckDir, rel),
    });

    if (diagnostics.some(diag => diag.permissionBlocked)) hasPermissionBlock = true;
    if (diagnostics.some(diag => diag.severity === 'error')) hasContentError = true;

    reports.push({ file: target, status: diagnostics.length ? 'diagnostics' : 'ok', diagnostics });
    if (!jsonMode) {
      if (!diagnostics.length) {
        io.stdout(`${target}: OK`);
      } else {
        for (const diag of diagnostics) {
          const loc = `${target}:${diag.line}:${diag.column}`;
          const slideSuffix = diag.slideId ? ` [slide=${diag.slideId}]` : '';
          const writer = diag.severity === 'error' || diag.permissionBlocked ? io.stderr : io.stdout;
          writer(`${loc}: ${diag.severity.toUpperCase()} ${diag.code}${slideSuffix}: ${diag.message}`);
        }
      }
    }
  }

  if (jsonMode) io.stdout(JSON.stringify(reports, null, 2));
  if (hasIoFailure) return 2;
  if (hasPermissionBlock) return 3;
  if (hasContentError) return 1;
  return 0;
}
