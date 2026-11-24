import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Deck as SourceDeck } from './deck';
import { referencedAssets } from './deck';
import type { ExportDocumentData, ExportFrame } from './export-player';
import { LibraryError, openDeck } from './library';
import { renderDeck } from './presentation-model';
import type { Stroke } from './render';
import { getEmbeddedBundle } from './runtime-assets';
import { ensureSampleImage, readDeckAsset } from './sample-image';
import { sampleImageReference } from './sample-image-reference';
import type { Talk } from './session';

export type ExportFormat = 'html' | 'pdf';
export type RevealExportMode = 'final' | 'steps';

export interface ExportOptions {
  format: ExportFormat;
  revealMode?: RevealExportMode;
  includeMarks?: boolean;
}

const exportLayoutCss = `
@page { size: 1280px 720px; margin: 0; }
body.export-body { margin: 0; background: #0b111c; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
.export-toolbar { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 16px; background: #0f172a; border-bottom: 1px solid #1e293b; }
.export-toolbar strong { margin-right: auto; font-size: 14px; color: #f8fafc; }
.export-toolbar span { font-size: 13px; color: #cbd5e1; font-variant-numeric: tabular-nums; }
.export-toolbar button { padding: 5px 10px; border: 1px solid #334155; border-radius: 0; background: #1e293b; color: #f8fafc; cursor: pointer; font: inherit; font-size: 13px; }
.export-toolbar button:hover:not(:disabled) { background: #334155; }
.export-toolbar button:disabled { opacity: 0.45; cursor: default; }
.export-deck { display: grid; gap: 24px; padding: 24px; max-width: 1328px; margin: 0 auto; }
body.export-body[data-mode="single"] .export-deck { padding: 16px; min-height: calc(100dvh - 52px); place-items: center; }
body.export-body[data-mode="single"] .export-slide:not([data-active="true"]) { display: none; }
.export-slide { width: min(100%, 1280px); margin: 0 auto; }
.export-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; container-type: inline-size; overflow: hidden; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35); }
.export-frame .stage { width: 100%; height: 100%; font-size: clamp(12px, 1.8cqw, 24px); overflow: hidden; }
.export-frame .chart-visual { height: min(34cqw, 340px); width: 100%; }
.export-frame .special-fence[data-kind="mermaid"] { display: grid; place-items: center; min-height: min(32cqw, 300px); }
.export-frame .special-fence[data-kind="mermaid"] svg { max-width: 100%; max-height: min(38cqw, 340px); height: auto; }
@media print {
  html, body.export-body { background: #fff; margin: 0; padding: 0; }
  .export-toolbar { display: none !important; }
  .export-deck { display: block; padding: 0; max-width: none; margin: 0; }
  body.export-body[data-mode="single"] .export-slide:not([data-active="true"]) { display: block; }
  .export-slide { width: 1280px; height: 720px; page-break-after: always; break-after: page; margin: 0; overflow: hidden; }
  .export-slide:last-child { page-break-after: auto; break-after: auto; }
  .export-frame { width: 1280px; height: 720px; box-shadow: none; }
  .export-frame .stage { font-size: 22px; }
}
`;

const viewerControlScript = `(() => {
  const slides = [...document.querySelectorAll('.export-slide')];
  const prev = document.getElementById('export-prev');
  const next = document.getElementById('export-next');
  const modeBtn = document.getElementById('export-mode');
  const counter = document.getElementById('export-counter');
  if (!slides.length || !prev || !next || !modeBtn || !counter) return;
  let index = 0;
  let single = true;
  const update = () => {
    document.body.dataset.mode = single ? 'single' : 'continuous';
    slides.forEach((el, idx) => el.setAttribute('data-active', String(idx === index)));
    counter.textContent = single ? (index + 1) + ' / ' + slides.length : slides.length + (slides.length === 1 ? ' slide' : ' slides');
    prev.disabled = !single || index <= 0;
    next.disabled = !single || index >= slides.length - 1;
    modeBtn.textContent = single ? 'Continuous view' : 'Slide view';
  };
  prev.addEventListener('click', () => { if (index > 0) { index--; update(); } });
  next.addEventListener('click', () => { if (index < slides.length - 1) { index++; update(); } });
  modeBtn.addEventListener('click', () => { single = !single; update(); });
  document.addEventListener('keydown', ev => {
    if (!single || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') {
      if (index < slides.length - 1) { ev.preventDefault(); index++; update(); }
    } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp' || ev.key === 'Backspace') {
      if (index > 0) { ev.preventDefault(); index--; update(); }
    } else if (ev.key === 'Home') { ev.preventDefault(); index = 0; update(); }
    else if (ev.key === 'End') { ev.preventDefault(); index = slides.length - 1; update(); }
  });
  update();
})();`;

let cachedCss: string | undefined;
let cachedPlayerJs: string | undefined;

async function loadExportCss(): Promise<string> {
  if (cachedCss) return cachedCss;
  const prebuilt = join(process.cwd(), 'build', 'export.css');
  if (existsSync(prebuilt)) {
    cachedCss = `${await readFile(prebuilt, 'utf8')}\n${exportLayoutCss}`;
    return cachedCss;
  }
  const embedded = getEmbeddedBundle();
  if (embedded?.exportCss) {
    cachedCss = `${embedded.exportCss}\n${exportLayoutCss}`;
    return cachedCss;
  }
  const [appCss, hljsCss, katexRawCss] = await Promise.all([
    readFile(join(process.cwd(), 'src', 'styles.css'), 'utf8'),
    readFile(join(process.cwd(), 'node_modules', 'highlight.js', 'styles', 'github.css'), 'utf8'),
    readFile(join(process.cwd(), 'node_modules', 'katex', 'dist', 'katex.min.css'), 'utf8'),
  ]);
  cachedCss = `${katexRawCss.replace(/@font-face\{[^}]*\}/g, '')}\n${hljsCss}\n${appCss}\n${exportLayoutCss}`;
  return cachedCss;
}

async function loadExportPlayerJs(): Promise<string> {
  if (cachedPlayerJs) return cachedPlayerJs;
  const prebuilt = join(process.cwd(), 'build', 'export-player.js');
  if (existsSync(prebuilt)) {
    cachedPlayerJs = await readFile(prebuilt, 'utf8');
    return cachedPlayerJs;
  }
  const embedded = getEmbeddedBundle();
  if (embedded?.exportPlayerJs) {
    cachedPlayerJs = embedded.exportPlayerJs;
    return cachedPlayerJs;
  }
  const built = await Bun.build({
    entrypoints: [join(process.cwd(), 'src', 'export-player.ts')],
    target: 'browser',
    minify: true,
  });
  const jsOut = built.outputs.find(out => out.path.endsWith('.js'));
  if (!built.success || !jsOut) throw new LibraryError(500, 'Export renderer bundle could not be built');
  cachedPlayerJs = await jsOut.text();
  return cachedPlayerJs;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function usesSampleImage(deck: SourceDeck): boolean {
  return deck.slides.some(slide => slide.items.some(item => item.text.includes(sampleImageReference)));
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

export function exportFilename(title: string, format: ExportFormat, annotated = false): string {
  const slug = title.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'presentation';
  return `${slug}${annotated ? '-annotated' : ''}.${format}`;
}

function buildFrames(sourceDeck: SourceDeck, assetMap: Record<string, string>, strokes: Stroke[], revealMode: RevealExportMode): ExportDocumentData {
  const rendered = renderDeck(sourceDeck);
  const stage = {
    title: rendered.title,
    theme: rendered.theme,
    master: rendered.master,
    slides: rendered.slides,
    total: rendered.slides.length,
    assetMap,
  };
  const frames: ExportFrame[] = [];
  for (const slide of rendered.slides) {
    const steps = revealMode === 'steps'
      ? Array.from({ length: slide.reveals.length + 1 }, (_, step) => step)
      : [slide.reveals.length];
    for (const step of steps) {
      frames.push({
        slide,
        step,
        strokes: strokes.filter(stroke => stroke.slideId === slide.id && (stroke.step ?? 0) <= step),
      });
    }
  }
  return { stage, frames };
}

function bootstrapRenderHtml(title: string, css: string, playerJs: string, data: ExportDocumentData, includeToolbar = false): string {
  const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');
  const safeJs = playerJs.replace(/<\/script/gi, '<\\/script');
  const toolbar = includeToolbar
    ? `<header class="export-toolbar"><strong>${escapeHtml(title)}</strong><span id="export-counter"></span><button type="button" id="export-prev">Previous</button><button type="button" id="export-next">Next</button><button type="button" id="export-mode">Continuous view</button></header>`
    : '';
  const controls = includeToolbar ? `<script>${viewerControlScript}</script>` : '';
  return `<!doctype html>
<html lang="en" data-export-static="true">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <title>${escapeHtml(title)}</title>
  <style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body class="export-body">
  ${toolbar}
  <main id="export-deck" class="export-deck"></main>
  <script id="slides-export-payload" type="application/json">${safeJson}</script>
  <script type="module">${safeJs}</script>
  ${controls}
</body>
</html>`;
}

function wrapStaticHtml(title: string, css: string, renderedInnerHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <title>${escapeHtml(title)}</title>
  <style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body class="export-body">
  <header class="export-toolbar">
    <strong>${escapeHtml(title)}</strong>
    <span id="export-counter"></span>
    <button type="button" id="export-prev">Previous</button>
    <button type="button" id="export-next">Next</button>
    <button type="button" id="export-mode">Continuous view</button>
  </header>
  <main id="export-deck" class="export-deck">${renderedInnerHtml}</main>
  <script>${viewerControlScript}</script>
</body>
</html>`;
}

const systemBrowserPaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

async function resolveChromiumExecutable(): Promise<{ chromium?: typeof import('playwright-core').chromium; executablePath: string } | null> {
  const override = process.env.SLIDES_CHROMIUM_PATH;
  if (override !== undefined) {
    if (!override || override === 'none' || !existsSync(override)) return null;
    try {
      const { chromium } = await import('playwright-core');
      return { chromium, executablePath: override };
    } catch {
      return { executablePath: override };
    }
  }
  let pwMod: typeof import('playwright-core') | undefined;
  try { pwMod = await import('playwright-core'); } catch { /* standalone binary without node_modules */ }
  const candidates = [
    pwMod ? (() => { try { return pwMod.chromium.executablePath(); } catch { return ''; } })() : '',
    ...systemBrowserPaths,
  ];
  const executablePath = candidates.find(candidate => candidate && existsSync(candidate));
  return executablePath ? { chromium: pwMod?.chromium, executablePath } : null;
}

async function printPdfViaBrowserCli(executablePath: string, html: string): Promise<Uint8Array<ArrayBuffer>> {
  const dir = await mkdtemp(join(tmpdir(), 'slides-pdf-'));
  const htmlPath = join(dir, 'deck.html');
  const pdfPath = join(dir, 'deck.pdf');
  const profileDir = join(dir, 'profile');
  try {
    await writeFile(htmlPath, html, 'utf8');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executablePath, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--no-pdf-header-footer', '--virtual-time-budget=4000',
        `--user-data-dir=${profileDir}`, `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ], { stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); reject(new Error('Browser PDF export timed out')); }, 25_000);
      child.once('error', err => { clearTimeout(timer); reject(err); });
      child.once('exit', code => {
        clearTimeout(timer);
        if (code === 0 && existsSync(pdfPath)) resolve();
        else reject(new Error(`Browser PDF export exited with code ${code}`));
      });
    });
    return new Uint8Array(await readFile(pdfPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function renderArtifact(data: ExportDocumentData, format: ExportFormat, annotated: boolean): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; filename: string }> {
  const [css, playerJs, browserInfo] = await Promise.all([
    loadExportCss(),
    loadExportPlayerJs(),
    resolveChromiumExecutable(),
  ]);
  const filename = exportFilename(data.stage.title, format, annotated);
  if (!browserInfo) {
    if (format === 'pdf') {
      throw new LibraryError(503, 'Chromium browser not found; install Microsoft Edge, Google Chrome, or Playwright Chromium to export PDF');
    }
    const fallbackHtml = bootstrapRenderHtml(data.stage.title, css, playerJs, data, true);
    return { bytes: new Uint8Array(Buffer.from(fallbackHtml, 'utf8')), mime: 'text/html; charset=utf-8', filename };
  }
  if (!browserInfo.chromium) {
    if (format === 'html') {
      const fallbackHtml = bootstrapRenderHtml(data.stage.title, css, playerJs, data, true);
      return { bytes: new Uint8Array(Buffer.from(fallbackHtml, 'utf8')), mime: 'text/html; charset=utf-8', filename };
    }
    const pdfBytes = await printPdfViaBrowserCli(browserInfo.executablePath, bootstrapRenderHtml(data.stage.title, css, playerJs, data, false));
    return { bytes: pdfBytes, mime: 'application/pdf', filename };
  }
  const browser = await browserInfo.chromium.launch({ executablePath: browserInfo.executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(bootstrapRenderHtml(data.stage.title, css, playerJs, data, false), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => document.documentElement.dataset.exportReady === 'true' || Boolean(document.documentElement.dataset.exportError),
      undefined,
      { timeout: 25_000 },
    );
    const renderError = await page.evaluate(() => document.documentElement.dataset.exportError);
    if (renderError) throw new LibraryError(500, `Export rendering failed: ${renderError}`);
    if (format === 'pdf') {
      const pdfBuffer = await page.pdf({
        width: '1280px',
        height: '720px',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return { bytes: new Uint8Array(pdfBuffer), mime: 'application/pdf', filename };
    }
    const staticInnerHtml = await page.locator('#export-deck').innerHTML();
    const html = wrapStaticHtml(data.stage.title, css, staticInnerHtml);
    return { bytes: new Uint8Array(Buffer.from(html, 'utf8')), mime: 'text/html; charset=utf-8', filename };
  } finally {
    await browser.close();
  }
}

export async function exportDeckArtifact(deckId: string, options: ExportOptions) {
  const opened = await openDeck(deckId);
  if (!opened.deck) throw new LibraryError(422, 'Fix source diagnostics before exporting', opened.diagnostics);
  const assetMap: Record<string, string> = {};
  if (usesSampleImage(opened.deck)) {
    const sampleBytes = await ensureSampleImage();
    assetMap[sampleImageReference] = toDataUrl(sampleBytes, 'image/svg+xml');
  }
  for (const rel of referencedAssets(opened.deck)) {
    const asset = await readDeckAsset(deckId, rel);
    if (asset) assetMap[rel] = toDataUrl(asset.bytes, asset.mime);
  }
  const data = buildFrames(opened.deck, assetMap, [], options.revealMode === 'steps' ? 'steps' : 'final');
  return renderArtifact(data, options.format, false);
}

export async function exportTalkArtifact(talk: Talk, options: ExportOptions) {
  const assetMap: Record<string, string> = {};
  if (usesSampleImage(talk.deck)) {
    const sampleBytes = await ensureSampleImage();
    assetMap[sampleImageReference] = toDataUrl(sampleBytes, 'image/svg+xml');
  }
  for (const [rel, asset] of talk.assets.entries()) {
    assetMap[rel] = toDataUrl(asset.bytes, asset.mime);
  }
  const includeMarks = options.includeMarks !== false;
  const strokes: Stroke[] = includeMarks
    ? talk.marks.map(mark => ({
      slideId: mark.slideId,
      step: mark.step,
      tool: mark.tool === 'highlight' ? 'highlighter' : 'pen',
      color: mark.color,
      width: mark.width,
      points: mark.points,
    }))
    : [];
  const data = buildFrames(talk.deck, assetMap, strokes, options.revealMode === 'steps' ? 'steps' : 'final');
  return renderArtifact(data, options.format, includeMarks && strokes.length > 0);
}
