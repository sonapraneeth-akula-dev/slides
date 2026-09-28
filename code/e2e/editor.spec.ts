import { expect, test } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directory: string;
let server: ChildProcessWithoutNullStreams;
let origin: string;

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'slides-browser-'));
  server = spawn('bun', ['./build/host.js'], {
    cwd: process.cwd(),
    env: { ...process.env, SLIDES_LIBRARY: directory },
  });
  origin = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Owner host did not start')), 15_000);
    let output = '';
    const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
    server.once('error', fail);
    server.once('exit', code => fail(new Error(`Owner host exited (${code}): ${output}`)));
    server.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const address = /Local Slides: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
      if (address) { clearTimeout(timeout); resolve(address); }
    });
    server.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  });
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise<void>(resolve => server.once('exit', () => resolve()));
    server.kill();
    await stopped;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('home aligns its entry actions and header at desktop and phone widths', async ({ page }) => {
  await page.goto(origin);
  await expect(page.locator('#library-page')).toBeVisible();
  await expect(page.locator('#page-title')).toBeHidden();
  await expect(page.locator('#library-page')).not.toContainText('Present locally');
  for (const width of [2000, 1000, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const brand = document.querySelector('#home')!.getBoundingClientRect();
      const intro = document.querySelector('.library-intro')!.getBoundingClientRect();
      const start = document.querySelector('.library-start')!.getBoundingClientRect();
      return { brandX: brand.left, introX: intro.left, introBottom: intro.bottom,
        startX: start.left, startY: start.top, scrollWidth: document.documentElement.scrollWidth };
    });
    expect(Math.abs(layout.brandX - layout.introX)).toBeLessThanOrEqual(5);
    expect(layout.scrollWidth).toBeLessThanOrEqual(width);
    if (width > 960) expect(layout.startX).toBeGreaterThan(layout.introX + 300);
    else expect(layout.startY).toBeGreaterThanOrEqual(layout.introBottom);
    await expect(page.locator('#create')).toBeVisible();
    await expect(page.locator('#open')).toBeVisible();
    await expect(page.locator('#open-demo')).toBeVisible();
  }
});

test('author, persist, present and share only read-only public state', async ({ page, context, request }) => {
  const name = 'browser-acceptance.md';
  await page.goto(origin);
  await page.evaluate(() => Object.defineProperty(window, 'queryLocalFonts', {
    configurable: true,
    value: async () => [{ family: 'Consolas' }, { family: 'Aptos Display' }, { family: 'Consolas' }],
  }));
  await expect(page.locator('#library-page')).toBeVisible();
  await expect(page.locator('#page-title')).toBeHidden();
  await expect(page.locator('#dev-mode')).toBeHidden();
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#theme option')).toHaveText(['Signal', 'Paper', 'Midnight', 'Forest']);
  await expect(page.locator('.preview-card').first().locator('.layout-type')).toHaveText('Title Content');
  await expect(page.locator('.preview-card').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.preview-card').first().locator('.preview-heading select option')).toHaveText([
    'Title Content', 'Two Columns', 'Three Columns', 'Picture Text', 'Blank',
    'Title Image Left', 'Title Image Right', 'Image Full'
  ]);
  await page.locator('#editor-actions .export-menu summary').click();
  await expect(page.locator('#editor-actions .export-options')).toBeVisible();
  await expect(page.locator('#editor-actions .export-options button')).toHaveText([
    'Export To PDF (Coming Later)', 'Export To HTML (Coming Later)'
  ]);
  await expect(page.locator('#editor-actions .export-options button:enabled')).toHaveCount(0);
  await page.locator('#editor-actions .export-menu summary').click();
  await expect(page.locator('#save')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('#editor-actions .editor-buttons')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('#page-title')).toHaveText('browser-acceptance');
  await expect(page.locator('.outline-actions')).toBeVisible();
  const outline = await page.locator('#outline').boundingBox();
  const actions = await page.locator('.outline-actions').boundingBox();
  expect(outline && actions && actions.y + actions.height).toBeGreaterThanOrEqual((outline?.y ?? 0) + (outline?.height ?? 0) - 20);
  await page.locator('#edit-title').click();
  await page.locator('#title-input').fill('Browser acceptance');
  await page.locator('#title-input').press('Enter');
  await expect(page.locator('#source')).toHaveValue(/title: "Browser acceptance"/);
  await expect(page.locator('#save')).toBeEnabled();
  const source = `---
slides:
  formatVersion: 1
  title: Browser acceptance
  master:
    theme: signal
---
::slide{id="welcome"}
# Browser acceptance

Original paragraph

**Bold text** and $x^2$.

\`\`\`typescript
const answer = 42;
\`\`\`

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`chart
{"type":"bar","labels":["A","B"],"series":[{"name":"Count","data":[1,2]}]}
\`\`\`

:::notes
PRIVATE SPEAKER NOTES
:::

:::reveal{step="1"}
Revealed text
:::

::slide{id="second" parent="welcome"}
# Second slide

Audience sees this.
`;
  await page.locator('#source').fill(source);
  await expect(page.locator('.preview-card')).toHaveCount(2);
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');
  await expect(page.locator('#page-title')).toHaveText('Browser acceptance');
  await expect(page.locator('.preview-card').first().locator('code')).toContainText('answer');
  await expect(page.locator('.preview-card').first().locator('.katex')).toHaveCount(1);
  await expect(page.locator('.preview-card').first().locator('.special-fence[data-kind="mermaid"] svg')).toHaveCount(1);
  await expect(page.locator('.preview-card').first().locator('.chart-visual canvas')).toHaveCount(1);
  await page.locator('[data-view="preview"]').click();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'preview');
  await page.locator('[data-view="split"]').click();
  const paragraph = page.locator('.preview-card').nth(1).locator('[contenteditable="plaintext-only"]');
  await expect(paragraph).toHaveText('Audience sees this.');
  await paragraph.fill('Updated audience paragraph');
  await paragraph.press('Tab');
  await expect(page.locator('#source')).toHaveValue(/Updated audience paragraph/);
  await expect(page.locator('#source')).toHaveValue(/\*\*Bold text\*\*/);

  await page.locator('.preview-card').first().getByLabel('Layout for slide 1').selectOption('two-columns');
  await expect(page.locator('#source')).toHaveValue(/layout="two-columns"/);
  await expect(page.locator('.preview-card').first().locator('.layout-type')).toHaveText('Two Columns');
  await page.locator('#settings-button').click();
  await expect(page.locator('#master-pane')).toBeVisible();
  await expect(page.locator('#settings-fields legend')).toHaveText([
    'Theme', 'Heading', 'Body', 'Code', 'Placements', 'Margins', 'Padding'
  ]);
  await expect(page.locator('#settings-fields select')).toHaveCount(22);
  await expect(page.getByLabel('Slide number in footer')).toHaveCount(0);
  const samples = page.locator('#master-preview .sample-list button');
  const viewer = page.locator('#master-preview .sample-viewer');
  const choose = async (index: number) => {
    await samples.nth(index).click();
    await expect(samples.nth(index)).toHaveAttribute('aria-current', 'true');
  };
  await expect(samples).toHaveCount(21);
  await expect(samples).toHaveText([
    '1. Blank', '2. Title and subtitle', '3. Title, subtitle and image', '4. Heading only',
    '5. Heading and content', '6. Heading and two text columns', '7. Heading and three columns',
    '8. Heading and two images', '9. Heading, image and text', '10. Heading, text and image',
    '11. Image only', '12. Picture with caption', '13. Heading and table', '14. Heading and code',
    '15. Heading and chart', '16. Line chart with two series', '17. Donut chart',
    '18. Heading and diagram', '19. Heading and equation',
    '20. Title with image on the left', '21. Title with image on the right'
  ]);
  await expect(page.locator('#master-preview .slide-group')).toHaveCount(9);
  await page.locator('#master-preview .slide-group').nth(1).locator('summary').click();
  await expect(page.locator('#master-preview .slide-group').nth(1)).not.toHaveAttribute('open');
  await page.locator('#master-preview .slide-group').nth(1).locator('summary').click();
  await expect(samples.nth(4)).toHaveAttribute('aria-current', 'true');
  await expect(viewer.locator('li')).toHaveCount(3);
  await expect(viewer.locator('.layout-type')).toHaveText('Title Content');
  await expect(page.locator('#master-pane')).toHaveCSS('padding-left', '12px');
  await expect(viewer).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await choose(0);
  await expect(viewer.locator('.stage')).toHaveAttribute('data-layout', 'blank');
  await expect(viewer.locator('.slide-content')).toHaveCount(0);
  await choose(1);
  await expect(viewer.locator('.slide-content')).toContainText('A short subtitle');
  await choose(2);
  await expect(viewer.locator('img.slide-image')).toHaveCount(1);
  await expect.poll(() => viewer.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await choose(5);
  await expect(viewer.locator('.slide-column')).toHaveCount(2);
  await choose(6);
  await expect(viewer.locator('.slide-column')).toHaveCount(3);
  await choose(7);
  await expect(viewer.locator('img.slide-image')).toHaveCount(2);
  await choose(8);
  await expect(viewer.locator('.slide-column')).toHaveCount(2);
  await choose(10);
  await expect(viewer.locator('img.slide-image')).toHaveCount(1);
  await expect(viewer.locator('.stage')).toHaveAttribute('data-layout', 'image-full');
  const imageCoverage = await viewer.locator('.stage').evaluate(stage => {
    const surface = stage.getBoundingClientRect();
    const image = stage.querySelector('img')!.getBoundingClientRect();
    return { height: image.height / surface.height, width: image.width / surface.width };
  });
  expect(imageCoverage.height).toBeGreaterThan(.95);
  expect(imageCoverage.width).toBeGreaterThan(.95);
  await choose(12);
  await expect(viewer.locator('table')).toHaveCount(1);
  await choose(13);
  await expect(viewer.locator('pre code')).toContainText('const answer = 42');
  await choose(14);
  await expect(viewer.locator('.chart-visual canvas')).toHaveCount(1);
  await choose(15);
  await expect(viewer.locator('.chart-visual canvas')).toHaveCount(1);
  await choose(16);
  await expect(viewer.locator('.chart-visual canvas')).toHaveCount(1);
  await choose(17);
  await expect(viewer.locator('.special-fence[data-kind="mermaid"] svg')).toHaveCount(1);
  const diagramCoverage = await viewer.locator('.stage').evaluate(stage => {
    const surface = stage.getBoundingClientRect();
    const svg = stage.querySelector('.special-fence svg')!;
    const diagram = svg.getBoundingClientRect();
    const nodes = [...svg.querySelectorAll('.node')].map(node => node.getBoundingClientRect());
    return {
      height: diagram.height, nodeCount: nodes.length,
      nodeHeight: Math.max(0, ...nodes.map(node => node.height)),
      labels: [...svg.querySelectorAll('text')].map(label => label.textContent?.trim()).filter(Boolean),
      inFrame: diagram.top >= surface.top && diagram.bottom <= surface.bottom &&
        diagram.left >= surface.left && diagram.right <= surface.right
    };
  });
  expect(diagramCoverage.height).toBeGreaterThan(120);
  expect(diagramCoverage.nodeCount).toBeGreaterThanOrEqual(4);
  expect(diagramCoverage.nodeHeight).toBeGreaterThan(10);
  expect(diagramCoverage.labels).toEqual(expect.arrayContaining(['Idea', 'Draft', 'Review', 'Present']));
  expect(diagramCoverage.inFrame).toBe(true);
  await choose(18);
  await expect(viewer.locator('.katex')).toHaveCount(1);
  for (const [index, direction] of [[19, 'left'], [20, 'right']] as const) {
    await choose(index);
    await expect(viewer.locator('.stage')).toHaveAttribute('data-layout', `title-image-${direction}`);
    const placement = await viewer.locator('.stage').evaluate(stage => {
      const surface = stage.getBoundingClientRect();
      const image = stage.querySelector('.slide-cover-image')!.getBoundingClientRect();
      return { height: image.height / surface.height, left: image.left - surface.left, right: surface.right - image.right };
    });
    expect(placement.height).toBeGreaterThan(.95);
    expect(placement[direction]).toBeLessThan(5);
  }
  await expect(page.locator('#source')).not.toHaveValue(/master-sample/);
  await expect(page.getByLabel('Top Left').locator('option')).toHaveText([
    'None', 'Slide Number / Total', 'Presentation Title', 'Slide Title', 'Footer Text', 'Logo Text'
  ]);
  await page.locator('#settings-fields select').first().selectOption('forest');
  await expect(page.locator('#source')).toHaveValue(/theme: "forest"/);
  await expect(page.locator('#master-preview .stage').first()).toHaveCSS('background-color', 'rgb(241, 246, 240)');
  await page.getByLabel('Surface', { exact: true }).fill('#e6e8ff');
  await expect(page.locator('#master-preview .stage').first()).toHaveCSS('background-color', 'rgb(230, 232, 255)');
  await page.getByLabel('Heading placement').selectOption('center');
  await expect(page.getByLabel('Heading font')).toHaveValue('');
  await expect(page.getByLabel('Heading size')).toHaveValue('80');
  await page.getByRole('button', { name: 'Browse installed fonts' }).click();
  await expect(page.locator('.font-picker [role="status"]')).toHaveText('2 installed font families available.');
  await expect(page.getByLabel('Heading font').locator('option')).toHaveText([
    'System font (default)', 'Aptos Display', 'Consolas'
  ]);
  await page.getByLabel('Heading font').selectOption('Aptos Display');
  await expect(page.locator('#source')).toHaveValue(/headingFont: "Aptos Display"/);
  await expect(viewer.locator('.stage h1').first()).toHaveCSS('font-family', /Aptos Display/);
  await page.getByLabel('Left margin (%)').selectOption('8');
  await page.getByLabel('Left padding (%)').selectOption('3');
  await page.getByLabel('Code font').selectOption('Consolas');
  await expect(page.locator('#master-preview .stage').first()).toHaveCSS('--slide-margin-left', '8%');
  await expect(page.locator('#master-preview .slide-content').first()).toHaveCSS('padding-left', /px/);
  await expect(page.locator('#master-preview .stage h1').first()).toHaveCSS('text-align', 'center');
  await choose(13);
  await expect(viewer.locator('pre code')).toHaveCSS('font-family', /Consolas/);
  await choose(1);
  await page.getByLabel('Bottom Right').selectOption('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 21');
  await page.getByLabel('Top Left').selectOption('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="TopLeft"]')).toHaveText('2 / 21');
  await expect(page.locator('#source')).toHaveValue(/    metadata:\n      metadataBottomRight: "slideNumber"/);
  await page.getByLabel('Top Center').selectOption('deckTitle');
  await expect(page.locator('#source')).toHaveValue(/metadataTopCenter: "deckTitle"/);
  await expect(page.locator('#source')).toHaveValue(/      metadataTopLeft: "slideNumber"/);
  await expect(page.locator('#master-preview .slide-meta[data-position="TopCenter"]')).toHaveText('Browser acceptance');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 21');
  await page.locator('[data-view="source"]').click();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'source');
  await page.locator('#save').click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect(page.locator('#save-status')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('#save')).toBeDisabled();
  await expect.poll(async () => readFile(join(directory, 'presentations', name), 'utf8')).toContain('Updated audience paragraph');
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toContain('theme: "forest"');
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toContain('headingPlacement: "center"');
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toContain('marginLeft: 8');
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toContain('paddingLeft: 3');
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toContain('    metadata:\n');

  await expect(page.locator('#present')).toBeEnabled();
  await page.locator('#present').click();
  await expect(page.locator('#presentation-page')).toBeVisible();
  await expect(page.locator('#speaker-notes')).toContainText('PRIVATE SPEAKER NOTES');
  await expect(page.locator('#stage .slide-meta[data-position="BottomRight"]')).toHaveText('1 / 2');
  await expect(page.locator('#stage h1')).toHaveCSS('text-align', 'center');
  await expect(page.locator('#stage')).toHaveCSS('--slide-margin-left', '8%');
  await expect(page.locator('#stage .slide-content')).toHaveCSS('padding-left', /px/);
  await expect(page.locator('#stage')).toHaveCSS('background-color', 'rgb(230, 232, 255)');
  await expect(page.locator('#jump option')).toHaveText(['1. Browser Acceptance', '2. Second Slide']);
  await page.locator('.presenter-export summary').click();
  await expect(page.locator('.presenter-export .export-options button')).toHaveCount(2);
  await expect(page.locator('.presenter-export .export-options button:enabled')).toHaveCount(0);
  await page.locator('.presenter-export summary').click();
  await expect(page.getByRole('button', { name: 'Save annotations (coming later)' })).toBeDisabled();
  const popupPromise = context.waitForEvent('page');
  await page.locator('#local-audience').click();
  const audience = await popupPromise;
  await audience.waitForLoadState('domcontentloaded');
  await expect(audience.locator('#audience-stage')).toContainText('Original paragraph');
  await expect(audience.locator('#audience-stage .slide-meta[data-position="BottomRight"]')).toHaveText('1 / 2');
  await expect(audience.locator('#audience-stage h1')).toHaveCSS('text-align', 'center');
  await expect(audience.locator('#audience-stage')).toHaveCSS('--slide-margin-left', '8%');
  await expect(audience.locator('#audience-stage .slide-content')).toHaveCSS('padding-left', /px/);
  await expect(audience.locator('#audience-stage')).toHaveCSS('background-color', 'rgb(230, 232, 255)');
  await expect(audience.locator('body')).not.toContainText('PRIVATE SPEAKER NOTES');
  await expect(audience.locator('.audience-page')).toBeVisible();

  const audienceUrl = new URL(audience.url());
  const sessionId = audienceUrl.searchParams.get('session');
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
  const key = decodeURIComponent(audienceUrl.hash.slice(1));
  const publicResponse = await request.get(`${origin}/api/public/${sessionId}`, {
    headers: { 'X-Slides-Public': key },
  });
  expect(publicResponse.status()).toBe(200);
  const publicText = await publicResponse.text();
  expect(publicText).not.toContain('PRIVATE SPEAKER NOTES');
  expect(publicText).not.toContain(directory);
  expect(publicText).not.toContain(source);
  expect((await request.get(`${origin}/api/public/${sessionId}`)).status()).toBe(403);
  expect((await request.get(`${origin}/api/library`)).status()).toBe(403);

  await page.locator('#next').click();
  await expect(page.locator('#reveal-progress')).toHaveText('Reveal 1 / 1');
  await expect(audience.locator('#audience-stage')).toContainText('Revealed text');
  await page.locator('#next').click();
  await expect(page.locator('#slide-progress')).toHaveText('Slide 2 / 2');
  await expect(audience.locator('#audience-stage .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 2');
  await expect(audience.locator('#audience-stage')).toContainText('Updated audience paragraph');
  await page.locator('#previous').click();
  await expect(page.locator('#slide-progress')).toHaveText('Slide 1 / 2');
  await page.locator('#blackout').click();
  await expect(audience.locator('#audience-mode')).toHaveAttribute('data-mode', 'blackout');
  await page.locator('#blackout').click();
  await page.locator('#end').click();
  await expect(page.locator('#end-dialog')).toBeVisible();
  await page.locator('#confirm-end').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(audience.locator('#audience-status')).toContainText('Presentation ended or unavailable.');
  expect((await request.get(`${origin}/api/public/${sessionId}`, {
    headers: { 'X-Slides-Public': key },
  })).status()).toBe(404);
  await page.reload();
  await page.locator('.deck-card').filter({ hasText: name }).getByRole('button', { name: 'Edit deck' }).click();
  await page.locator('#settings-button').click();
  await expect(page.getByLabel('Bottom Right')).toHaveValue('slideNumber');
  await expect(page.getByLabel('Top Center')).toHaveValue('deckTitle');
  await expect(page.locator('#master-preview .slide-meta[data-position="TopCenter"]')).toHaveText('Browser acceptance');
});

test('sections, full-height images, table styling, and slide metadata persist into the audience view', async ({ page, context }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('section-overrides.md');
  await page.locator('#create').click();
  await page.locator('#source').fill(`---
slides:
  title: Section overrides
  master:
    metadata:
      metadataBottomRight: slideNumber
---
::slide{id="cover" section="Overview" layout="title-image-right"}
# Section cover
:::slot{name="image"}
![Landscape](assets/sample-landscape.svg)
:::

::slide{id="photo" section="Overview" layout="image-full"}
![Landscape](assets/sample-landscape.svg)

::slide{id="data" section="Details"}
# Data and diagram
| Type | Value |
| --- | --- |
| A | 3 |
| B | 5 |
\`\`\`mermaid
flowchart TD
  A --> B
  B --> C
\`\`\`
`);
  await expect(page.locator('.preview-card')).toHaveCount(3);
  await expect(page.locator('#outline .slide-group > summary')).toHaveText(['Overview · 2 slides', 'Details · 1 slide']);
  await expect(page.locator('#preview .slide-group > summary')).toHaveText(['Overview · 2 slides', 'Details · 1 slide']);
  await page.locator('#outline .slide-group').first().locator('summary').click();
  await expect(page.locator('#outline .outline-item[data-slide-id="cover"]')).toBeHidden();
  await page.locator('#outline .slide-group').first().locator('summary').click();
  await page.locator('#preview .slide-group').first().locator(':scope > summary').click();
  await expect(page.locator('.preview-card[data-slide-id="cover"]')).toBeHidden();
  await page.locator('#preview .slide-group').first().locator(':scope > summary').click();

  const cover = page.locator('.preview-card[data-slide-id="cover"]');
  await cover.locator('.slide-options summary').click();
  await cover.getByLabel('Slide 1 bottom-right metadata override').selectOption('none');
  await expect(page.locator('#source')).toHaveValue(/::slide\{id="cover" section="Overview" layout="title-image-right" metadataBottomRight="none"\}/);
  await expect(cover.locator('.slide-meta[data-position="BottomRight"]')).toHaveCount(0);
  await cover.getByLabel('Slide 1 top-left metadata override').selectOption('slideTitle');
  await expect(cover.locator('.slide-meta[data-position="TopLeft"]')).toHaveText('Section cover');
  const photo = page.locator('.preview-card[data-slide-id="photo"]');
  await photo.locator('.slide-options summary').click();
  await photo.getByLabel('Section for slide 2').fill('Details');
  await photo.getByLabel('Section for slide 2').press('Tab');
  await expect(page.locator('#outline .slide-group > summary')).toHaveText(['Overview · 1 slide', 'Details · 2 slides']);
  await expect(page.locator('#source')).toHaveValue(/::slide\{id="photo" layout="image-full" section="Details"\}/);
  await page.locator('#preview .slide-group').nth(1).locator(':scope > summary').click();
  await cover.getByLabel('Slide 1 top-center metadata override').selectOption('deckTitle');
  await page.locator('#preview .slide-group').nth(1).locator(':scope > summary').click();
  const table = page.locator('.preview-card[data-slide-id="data"] table');
  await expect(table.locator('thead th').first()).toHaveCSS('font-weight', '800');
  const rows = await table.locator('tbody tr').evaluateAll(elements => elements.map(row => getComputedStyle(row).backgroundColor));
  expect(rows[0]).not.toBe(rows[1]);
  await expect(page.locator('.preview-card[data-slide-id="data"] .special-fence svg')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled({ timeout: 15_000 });
  await page.locator('#present').click();
  await expect(page.locator('#stage .slide-meta[data-position="BottomRight"]')).toHaveCount(0);
  await expect(page.locator('#stage .slide-meta[data-position="TopLeft"]')).toHaveText('Section cover');
  const popupPromise = context.waitForEvent('page');
  await page.locator('#local-audience').click();
  const audience = await popupPromise;
  await expect(audience.locator('#audience-stage .slide-meta[data-position="BottomRight"]')).toHaveCount(0);
  await expect(audience.locator('#audience-stage .slide-meta[data-position="TopLeft"]')).toHaveText('Section cover');
  await page.locator('#next').click();
  await expect(audience.locator('#audience-stage')).toHaveAttribute('data-layout', 'image-full');
  await expect(audience.locator('#audience-stage .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 3');
  await expect(audience.locator('#audience-stage img.slide-image')).toBeVisible();
});

test('end recovers from an expired owner token and an already-stopped presentation', async ({ page, request }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('end-token-recovery.md');
  await page.locator('#create').click();
  await page.locator('#present').click();
  await expect(page.locator('#presentation-page')).toBeVisible();

  let expireNextEnd = true;
  let endRequests = 0;
  await page.route('**/api/sessions/*', async route => {
    if (route.request().method() !== 'DELETE') { await route.continue(); return; }
    endRequests++;
    if (expireNextEnd) {
      expireNextEnd = false;
      await route.continue({ headers: { ...route.request().headers(), 'x-slides-token': 'expired-token' } });
    } else await route.continue();
  });

  await page.locator('#end').click();
  await page.locator('#confirm-end').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#end-dialog')).toBeHidden();
  expect(endRequests).toBe(2);
  await expect(page.locator('#toast')).toBeHidden();

  const started = page.waitForResponse(response =>
    response.url().endsWith('/api/sessions') && response.request().method() === 'POST');
  await page.locator('#present').click();
  const { sessionId } = await (await started).json() as { sessionId: string };
  await expect(page.locator('#presentation-page')).toBeVisible();
  const bootstrap = await request.get(`${origin}/api/bootstrap`);
  const { token } = await bootstrap.json() as { token: string };
  const stopped = await request.delete(`${origin}/api/sessions/${sessionId}`, {
    headers: { 'X-Slides-Token': token, 'Content-Type': 'application/json' },
    data: { discardMarks: true },
  });
  expect(stopped.status()).toBe(200);

  expireNextEnd = true;
  await page.locator('#end').click();
  await page.locator('#confirm-end').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#end-dialog')).toBeHidden();
  await expect(page.locator('#toast')).toHaveText('Presentation is no longer active. Returned to the editor.');
  expect(endRequests).toBe(4);
});

test('one feature tour action opens the latest edition without overwriting edits', async ({ page }) => {
  await page.goto(origin);
  await expect(page.locator('.library-demo button')).toHaveCount(1);
  await expect(page.locator('#open-demo')).toHaveText('Explore latest feature tour');
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('.preview-card')).toHaveCount(16);
  await expect(page.locator('#source')).toHaveValue(/# Bundled feature tour: [a-f0-9]{64}/);
  await expect(page.locator('.preview-card[data-slide-id="welcome"] .slide-cover-image img')).toBeVisible();
  await expect(page.locator('.preview-card[data-slide-id="diagram"] .special-fence svg')).toBeVisible();
  await expect.poll(async () => readFile(join(directory, 'feature-tours', 'Slides-Feature-Tour.md'), 'utf8')).toContain('Slides feature tour');
  await page.locator('#home').click();
  await expect(page.locator('#library-page')).toBeVisible();
  await expect(page.locator('#tour-list .deck-card')).toHaveCount(1);
  await expect(page.locator('#deck-list .deck-card h3').filter({ hasText: /Slides-Feature-Tour/ })).toHaveCount(0);
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  const original = join(directory, 'feature-tours', 'Slides-Feature-Tour.md');
  const edited = (await page.locator('#source').inputValue()).replace('# A reveal and private notes', '# My personalized tour');
  await page.locator('#source').fill(edited);
  await expect.poll(async () => readFile(original, 'utf8')).toContain('# My personalized tour');
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await page.locator('#home').click();
  await expect(page.locator('#library-page')).toBeVisible();
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#source')).toHaveValue(/# My personalized tour/);
  await expect(page.locator('.preview-card')).toHaveCount(16);
  await page.locator('#home').click();
  await expect(page.locator('#library-page')).toBeVisible();
  const olderText = (await readFile(original, 'utf8')).replace(
    /(# Bundled feature tour: )[a-f0-9]{64}/, `$1${'0'.repeat(64)}`);
  await writeFile(original, olderText);
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('.preview-card')).toHaveCount(16);
  await expect(page.locator('#source-file')).toContainText('Slides-Feature-Tour-2.md');
  await expect(page.locator('#source')).toHaveValue(/# A reveal and private notes/);
  await expect(page.locator('#source')).toHaveValue(/Mermaid renders this left-to-right flow from idea to presentation/);
  expect((await page.locator('#source').inputValue()).match(/^:::notes$/gm)).toHaveLength(16);
  expect(await readFile(original, 'utf8')).toBe(olderText);
  await page.locator('#home').click();
  await expect(page.locator('#library-page')).toBeVisible();
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#source-file')).toContainText('Slides-Feature-Tour-2.md');
  await page.locator('#home').click();
  await expect(page.locator('#library-page')).toBeVisible();
  const newest = join(directory, 'feature-tours', 'Slides-Feature-Tour-2.md');
  await writeFile(newest, (await readFile(newest, 'utf8')).replace(/^  # Bundled feature tour: [a-f0-9]{64}\r?\n/m, ''));
  await page.locator('#open-demo').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#source-file')).toContainText('Slides-Feature-Tour-2.md');
  await expect(page.locator('#tour-list .deck-card h3').filter({
    hasText: /^Slides-Feature-Tour(?:-2)?\.md$/,
  })).toHaveCount(2);
  await expect(page.locator('#tour-list .deck-card h3').filter({
    hasText: /^Slides-Feature-Tour-3\.md$/,
  })).toHaveCount(0);
  expect(await readFile(original, 'utf8')).toBe(olderText);
});

test('Mermaid stays centered and unclipped in draft preview and public stages', async ({ page, context }) => {
  await page.setViewportSize({ width: 2000, height: 1250 });
  await page.goto(origin);
  await page.locator('#open-demo').click();
  await page.locator('button[data-view="preview"]').click();
  const stage = page.locator('.preview-card[data-slide-id="diagram"] .preview-stage');
  await expect(stage.locator('.special-fence svg')).toBeVisible();
  for (const [width, height, zoom] of [[2000, 1250, 1], [2000, 1250, 1.25], [1600, 1110, 1.5], [1280, 720, 1]] as const) {
    await page.setViewportSize({ width, height });
    await page.evaluate(value => { document.documentElement.style.zoom = String(value); }, zoom);
    const geometry = await stage.evaluate(element => {
      const svg = element.querySelector('.special-fence svg')!;
      const slide = element.getBoundingClientRect();
      const bounds = svg.getBoundingClientRect();
      const nodes = [...svg.querySelectorAll('.node, .nodeLabel')].map(node => node.getBoundingClientRect());
      const footer = element.querySelector('.slide-meta[data-position="BottomLeft"]')?.getBoundingClientRect();
      const groupLeft = Math.min(...nodes.map(node => node.left));
      const groupRight = Math.max(...nodes.map(node => node.right));
      return {
        nodes: nodes.length,
        svgWidth: bounds.width,
        stageWidth: slide.width,
        groupWidth: groupRight - groupLeft,
        centered: Math.abs((groupLeft + groupRight) / 2 - (slide.left + slide.right) / 2) < slide.width * .12,
        contained: nodes.every(node =>
          node.left >= bounds.left - 1 && node.right <= bounds.right + 1 &&
          node.top >= bounds.top - 1 && node.bottom <= bounds.bottom + 1 &&
          node.left >= slide.left && node.right <= slide.right &&
          node.top >= slide.top && node.bottom <= (footer?.top ?? slide.bottom) - 8),
        overflow: element.scrollHeight > element.clientHeight + 1,
      };
    });
    expect(geometry.nodes).toBeGreaterThanOrEqual(4);
    expect(geometry.svgWidth).toBeGreaterThan(geometry.stageWidth * .7);
    expect(geometry.groupWidth).toBeGreaterThan(geometry.stageWidth * .55);
    expect(geometry.centered).toBe(true);
    expect(geometry.contained).toBe(true);
    expect(geometry.overflow).toBe(false);
  }
  await stage.evaluate(element => { element.style.setProperty('--slide-margin-bottom', '0%'); });
  const footerClearance = await stage.evaluate(element => {
    const nodes = [...element.querySelectorAll('.special-fence svg .node, .special-fence svg .nodeLabel')];
    const footerTop = element.querySelector('.slide-meta[data-position="BottomLeft"]')!.getBoundingClientRect().top;
    return { nodeBottom: Math.max(...nodes.map(node => node.getBoundingClientRect().bottom)),
      footerTop, overflow: element.scrollHeight > element.clientHeight + 1 };
  });
  expect(footerClearance.nodeBottom).toBeLessThan(footerClearance.footerTop - 8);
  expect(footerClearance.overflow).toBe(false);
  await page.locator('#present').click();
  await page.locator('#jump').selectOption('diagram');
  const audienceOpened = context.waitForEvent('page');
  await page.locator('#local-audience').click();
  const audience = await audienceOpened;
  for (const surface of [page.locator('#stage'), audience.locator('#audience-stage')]) {
    await expect(surface.locator('.special-fence svg')).toBeVisible();
    const bounds = await surface.evaluate(element => {
      const area = element.getBoundingClientRect();
      const svg = element.querySelector('.special-fence svg')!.getBoundingClientRect();
      const nodes = [...element.querySelectorAll('.special-fence svg .node, .special-fence svg .nodeLabel')]
        .map(node => node.getBoundingClientRect());
      return { nodes: nodes.length, centered: Math.abs((
        Math.min(...nodes.map(node => node.left)) + Math.max(...nodes.map(node => node.right))) / 2 -
        (area.left + area.right) / 2) < area.width * .12,
      contained: nodes.every(node =>
        node.left >= svg.left - 1 && node.right <= svg.right + 1 &&
        node.top >= svg.top - 1 && node.bottom <= svg.bottom + 1) };
    });
    expect(bounds.nodes).toBeGreaterThanOrEqual(4);
    expect(bounds.centered).toBe(true);
    expect(bounds.contained).toBe(true);
  }
});

test('Mermaid refits its viewBox to the live diagram in LR and TD flows', async ({ page }) => {
  // Simulate Mermaid's scratch-container measurement disagreeing with the live render (fonts, extensions, timing).
  await page.addInitScript(() => {
    const measure = SVGGraphicsElement.prototype.getBBox;
    SVGGraphicsElement.prototype.getBBox = function (this: SVGGraphicsElement) {
      const box = measure.call(this);
      return this instanceof SVGSVGElement && !this.closest('.special-fence')
        ? new DOMRect(box.x + 90, box.y + 20, box.width * .8, box.height * .8) : box;
    };
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(origin);
  await page.locator('#open-demo').click();
  const source = page.locator('#source');
  await expect(source).toHaveValue(/```mermaid/);
  const contained = (surface: import('@playwright/test').Locator) => surface.evaluate(element => {
    const svg = element.querySelector('.special-fence[data-kind="mermaid"] svg')!;
    const box = svg.getBoundingClientRect();
    const nodes = [...svg.querySelectorAll('.node')].map(node => node.getBoundingClientRect());
    return nodes.length === 4 && nodes.every(node => node.left >= box.left - 1 && node.right <= box.right + 1 &&
      node.top >= box.top - 1 && node.bottom <= box.bottom + 1);
  });
  for (const direction of ['LR', 'TD']) {
    await source.fill((await source.inputValue()).replace(/flowchart (LR|TD)/, `flowchart ${direction}`));
    await expect(page.locator('#save-status')).toHaveText('Saved');
    const preview = page.locator('.preview-card[data-slide-id="diagram"] .preview-stage');
    await expect(preview.locator('.special-fence svg')).toBeVisible();
    await preview.scrollIntoViewIfNeeded();
    expect(await contained(preview), `${direction} preview`).toBe(true);
    await page.locator('#present').click();
    await page.locator('#jump').selectOption('diagram');
    await expect(page.locator('#stage .special-fence svg')).toBeVisible();
    expect(await contained(page.locator('#stage')), `${direction} presenter`).toBe(true);
    await page.locator('#end').click();
    await page.locator('#confirm-end').click();
    await expect(page.locator('#editor-page')).toBeVisible();
  }
});

test('presenter fits charts and Mermaid, shows private notes, and groups legible controls', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(origin);
  await page.locator('#open-demo').click();
  await expect(page.locator('.preview-card')).toHaveCount(16);
  await expect(page.locator('#present')).toBeEnabled();
  await page.locator('#present').click();
  await page.locator('#jump').selectOption('diagram');
  await expect(page.locator('#stage .special-fence svg')).toBeVisible();
  await expect(page.locator('#speaker-notes')).toContainText('Mermaid renders this left-to-right flow');
  await expect(page.locator('#stage')).not.toContainText('Mermaid renders this left-to-right flow');
  const diagram = await page.locator('#stage').evaluate(stage => {
    const svg = stage.querySelector('.special-fence svg')!;
    const bounds = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return { stage: bounds(stage), svg: bounds(svg), heading: bounds(stage.querySelector('h1')!),
      nodes: [...svg.querySelectorAll('.node')].map(bounds),
      labels: [...svg.querySelectorAll('text')].map(bounds),
      scrollHeight: stage.scrollHeight, clientHeight: stage.clientHeight };
  });
  expect(diagram.svg.width).toBeGreaterThan(diagram.stage.width * .6);
  expect(diagram.svg.y - (diagram.heading.y + diagram.heading.height)).toBeLessThan(50);
  expect(diagram.nodes).toHaveLength(4);
  expect(diagram.labels).toHaveLength(4);
  for (const box of [...diagram.nodes, ...diagram.labels]) {
    expect(box.x).toBeGreaterThanOrEqual(diagram.svg.x);
    expect(box.y).toBeGreaterThanOrEqual(diagram.svg.y);
    expect(box.x + box.width).toBeLessThanOrEqual(diagram.svg.x + diagram.svg.width);
    expect(box.y + box.height).toBeLessThanOrEqual(diagram.svg.y + diagram.svg.height);
    expect(box.x + box.width).toBeLessThanOrEqual(diagram.stage.x + diagram.stage.width);
  }
  expect(diagram.scrollHeight).toBeLessThanOrEqual(diagram.clientHeight + 1);
  for (const { width, height } of [{ width: 1600, height: 880 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize({ width, height });
    const diagramBounds = await page.locator('#stage').evaluate(stage => {
      const svg = stage.querySelector('.special-fence svg')!.getBoundingClientRect();
      const lastNode = stage.querySelector('.special-fence svg .node:last-of-type')!.getBoundingClientRect();
      const footer = stage.querySelector('.slide-meta[data-position="BottomLeft"]')!.getBoundingClientRect();
      return { svgBottom: svg.bottom, nodeBottom: lastNode.bottom, footerTop: footer.top,
        scrollHeight: stage.scrollHeight, clientHeight: stage.clientHeight };
    });
    expect(diagramBounds.nodeBottom).toBeLessThan(diagramBounds.footerTop - 8);
    expect(diagramBounds.svgBottom).toBeLessThan(diagramBounds.footerTop - 8);
    expect(diagramBounds.scrollHeight).toBeLessThanOrEqual(diagramBounds.clientHeight + 1);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('#jump').selectOption('bar-chart');
  await expect(page.locator('#stage .chart-visual canvas')).toBeVisible();
  await expect(page.locator('#speaker-notes')).toContainText('Its data table remains available');
  await expect(page.locator('#stage')).not.toContainText('Its data table remains available');
  const chart = await page.locator('#stage').evaluate(stage => ({
    headingTop: stage.querySelector('h1')!.getBoundingClientRect().top - stage.getBoundingClientRect().top,
    tableClip: getComputedStyle(stage.querySelector('.chart-data')!).clipPath,
    tableWidth: stage.querySelector('.chart-data')!.getBoundingClientRect().width,
    scrollHeight: stage.scrollHeight, clientHeight: stage.clientHeight,
  }));
  expect(chart.headingTop).toBeLessThan(100);
  expect(chart.tableClip).toBe('inset(50%)');
  expect(chart.tableWidth).toBe(1);
  expect(chart.scrollHeight).toBeLessThanOrEqual(chart.clientHeight + 1);
  await expect(page.locator('#stage .chart-data caption')).toHaveText('bar chart data');
  await expect(page.locator('#stage .chart-data tbody tr')).toHaveCount(3);

  const tools = page.locator('#presentation-tools');
  await expect(tools.locator('button').first()).toHaveCSS('color', 'rgb(27, 37, 52)');
  await expect(tools.locator('button').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await tools.locator('[data-tool="pen"]').click();
  await expect(tools.locator('[data-tool="pen"]')).toHaveCSS('color', 'rgb(23, 62, 135)');
  await tools.locator('#undo').evaluate((button: HTMLButtonElement) => { button.disabled = true; });
  await expect(tools.locator('#undo')).toHaveCSS('color', 'rgb(66, 82, 107)');
  await expect(tools.locator('#undo')).toHaveCSS('opacity', '1');
  for (const width of [1920, 960, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const group of ['.navigation', '.tree-nav']) {
      const row = page.locator(`#presenter-side ${group}`);
      const groupBox = await row.boundingBox();
      expect(groupBox).not.toBeNull();
      expect(groupBox!.x).toBeGreaterThanOrEqual(0);
      expect(groupBox!.x + groupBox!.width).toBeLessThanOrEqual(width);
      await expect(row).toHaveCSS('border-radius', '8px');
      const buttons = await row.locator('button').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, scrollWidth: element.scrollWidth, width: element.clientWidth };
      }));
      for (let index = 1; index < buttons.length; index++) {
        expect(Math.abs(buttons[index].left - buttons[index - 1].right)).toBeLessThan(1);
        expect(Math.abs(buttons[index].top - buttons[0].top)).toBeLessThan(1);
      }
      for (const button of buttons) expect(button.scrollWidth).toBeLessThanOrEqual(button.width);
    }
  }
  await expect(page.locator('.tree-nav [data-nav="parent"]')).toHaveCSS('white-space', 'nowrap');
  await expect(page.locator('#presenter-side .navigation svg, #presenter-side .tree-nav svg')).toHaveCount(6);
  await expect(page.locator('#presenter-side')).not.toContainText(/[←→↑↓]/);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const actions = page.locator('#presenter-actions .editor-buttons');
  await expect(actions).toHaveCSS('border-radius', '8px');
  const headerButtons = await actions.locator('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()));
  expect(headerButtons).toHaveLength(3);
  for (let index = 1; index < headerButtons.length; index++) {
    expect(Math.abs(headerButtons[index].left - headerButtons[index - 1].right)).toBeLessThan(1);
  }
});

test('CRLF decks can present untouched and retain line endings after edits', async ({ page }) => {
  const path = join(directory, 'presentations', 'CRLF.md');
  await mkdir(join(directory, 'presentations'), { recursive: true });
  await writeFile(path, '---\r\nslides:\r\n  formatVersion: 1\r\n  title: CRLF\r\n---\r\n::slide{id="first"}\r\n# Before\r\n');
  await page.goto(origin);
  await page.locator('#deck-path').fill(path);
  await page.locator('#open').click();
  await expect(page.locator('#source')).toHaveValue(/# Before/);
  await expect(page.locator('#present')).toBeEnabled();
  await expect(page.locator('#save')).toBeDisabled();
  await page.locator('#present').click();
  await expect(page.locator('#stage h1')).toHaveText('Before');
  await page.locator('#end').click();
  await page.locator('#confirm-end').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await page.locator('#source').fill((await page.locator('#source').inputValue()).replace('# Before', '# After'));
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#save')).toBeDisabled({ timeout: 15_000 });
  expect(await readFile(path, 'utf8')).toContain('\r\n# After\r\n');
  await page.locator('#present').click();
  await expect(page.locator('#stage h1')).toHaveText('After');
});

test('editor actions form one contiguous toolbar on desktop and narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin);
  await page.locator('#deck-name').fill('Toolbar layout');
  await page.locator('#create').click();
  const toolbar = page.getByRole('toolbar', { name: 'Editor actions' });
  await expect(toolbar.locator(':scope > *')).toHaveCount(5);
  await expect(toolbar.locator(':scope > label #theme')).toBeVisible();
  await expect(toolbar).toHaveCSS('border-radius', '8px');
  const positions = await toolbar.locator(':scope > *').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  for (let index = 1; index < positions.length; index++) {
    expect(positions[index].left - positions[index - 1].right).toBeLessThan(1);
    expect(Math.abs(positions[index].top - positions[0].top)).toBeLessThan(1);
    expect(Math.abs(positions[index].bottom - positions[0].bottom)).toBeLessThan(1);
  }
  await page.locator('#theme').selectOption('forest');
  await expect(page.locator('#theme')).toHaveValue('forest');
  await page.locator('button[data-view="source"]').click();
  await expect(page.locator('button[data-view="source"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('button[data-view="split"]').click();
  for (const width of [960, 700, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await toolbar.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  }
  await page.locator('#editor-actions .export-menu summary').click();
  await expect(page.locator('#editor-actions .export-options')).toBeVisible();
  const menu = await page.locator('#editor-actions .export-options').boundingBox();
  expect(menu).not.toBeNull();
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(390);
});

test('font permission errors leave saved fonts and fractional settings intact', async ({ page }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('Existing typography');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await page.locator('#source').fill((await page.locator('#source').inputValue()).replace(
    '    theme: signal', '    theme: signal\n    headingFont: Noto Sans\n    paddingTop: 3.5'));
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');
  await page.evaluate(() => Object.defineProperty(window, 'queryLocalFonts', {
    configurable: true,
    value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
  }));
  await page.locator('#settings-button').click();
  await expect(page.getByLabel('Heading font')).toHaveValue('Noto Sans');
  await expect(page.getByLabel('Top padding (%)')).toHaveValue('3.5');
  await expect(page.getByLabel('Top padding (%)').locator('option:checked')).toHaveText('3.5 (saved value)');
  await page.getByRole('button', { name: 'Browse installed fonts' }).click();
  await expect(page.locator('.font-picker [role="status"]')).toContainText('Permission denied');
  await expect(page.getByLabel('Heading font')).toHaveValue('Noto Sans');
  await page.getByLabel('Body size').selectOption('36');
  await expect(page.locator('#source')).toHaveValue(/bodySize: 36/);
  await page.getByLabel('Heading font').selectOption('');
  await expect(page.locator('#source')).not.toHaveValue(/headingFont:/);
  await expect(page.getByLabel('Top padding (%)')).toHaveValue('3.5');
});

test('master settings announces the active view and matches editor control typography', async ({ page }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('Settings navigation');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('button[data-view="split"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#editor-panes')).not.toHaveAttribute('aria-pressed');
  await expect(page.locator('.outline-item[aria-current="true"]')).toHaveCount(1);

  await page.locator('#settings-button').click();
  await expect(page.locator('#master-pane')).toBeVisible();
  await expect(page.locator('#editor-panes')).toBeHidden();
  await expect(page.locator('#settings-button')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#settings-button')).toHaveCSS('background-color', 'rgb(233, 240, 254)');
  await expect(page.locator('.outline-item[aria-current="true"]')).toHaveCount(0);
  await expect(page.locator('button[data-view][aria-pressed="true"]')).toHaveCount(0);
  for (const selector of [
    '.topbar #theme', '.topbar [data-view="split"]', '.topbar .export-menu summary',
    '#settings-button', '.outline-item', '.outline-actions .add-slide',
    '#settings-fields label', '#settings-fields input', '#reset-master'
  ]) await expect(page.locator(selector).first()).toHaveCSS('font-size', '13px');

  await page.locator('.outline-item').first().click();
  await expect(page.locator('#master-pane')).toBeHidden();
  await expect(page.locator('button[data-view="split"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#settings-button')).toHaveAttribute('aria-current', 'false');
  await expect(page.locator('.outline-item[aria-current="true"]')).toHaveCount(1);

  await page.locator('#settings-button').click();
  await page.locator('[data-view="source"]').click();
  await expect(page.locator('#master-pane')).toBeHidden();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'source');
  await expect(page.locator('button[data-view="source"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#settings-button').click();
  await page.getByRole('button', { name: 'Add slide', exact: true }).click();
  await expect(page.locator('#master-pane')).toBeHidden();
  await expect(page.locator('.outline-item[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('#source')).toHaveValue(/::slide\{id="slide-[\da-f]{8}"\}/);
});

test('metadata stays aligned with slide margins in settings, editor and presenter', async ({ page }) => {
  const name = 'aligned-metadata.md';
  await page.goto(origin);
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await page.locator('#settings-button').click();
  await page.getByLabel('Left margin (%)').selectOption('8');
  await page.getByLabel('Right margin (%)').selectOption('12');
  await page.getByLabel('Footer text', { exact: true }).fill('Footer alignment');
  await page.getByLabel('Footer text', { exact: true }).press('Tab');
  await page.getByLabel('Bottom Left').selectOption('footer');
  await page.getByLabel('Bottom Right').selectOption('slideNumber');

  const aligned = async (selector: string) => {
    const stage = page.locator(selector).first();
    await expect(stage.locator('.slide-meta[data-position="BottomLeft"]')).toHaveText('Footer alignment');
    await expect(stage.locator('.slide-meta[data-position="BottomRight"]')).toBeVisible();
    const offset = await stage.evaluate(element => {
      const stageRect = element.getBoundingClientRect();
      const heading = element.querySelector('h1')!.getBoundingClientRect();
      const left = element.querySelector('.slide-meta[data-position="BottomLeft"]')!.getBoundingClientRect();
      const right = element.querySelector('.slide-meta[data-position="BottomRight"]')!.getBoundingClientRect();
      return {
        left: Math.abs(heading.left - left.left),
        right: Math.abs(stageRect.right - right.right - parseFloat(getComputedStyle(element).paddingRight))
      };
    });
    expect(offset.left).toBeLessThan(2);
    expect(offset.right).toBeLessThan(2);
  };
  await aligned('#master-preview .stage');
  await page.locator('button[data-view="split"]').click();
  await aligned('#preview .preview-stage');
  await expect.poll(async () => readFile(join(directory, 'presentations', name), 'utf8')).toContain('marginLeft: 8');
  await expect(page.locator('#save')).toBeDisabled();
  await page.locator('#present').click();
  await aligned('#stage');
});

test('legacy slide-number setting can be overridden and reset without invalid source', async ({ page }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('Legacy settings');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await page.locator('#source').fill(`---
slides:
  title: Legacy settings
  master:
    theme: midnight
    footerNumber: true
    background: solid
    backdrop: off
---
::slide{id="first"}
# First
`);
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');
  await page.locator('#settings-button').click();
  await expect(page.getByLabel('Slide number in footer')).toHaveCount(0);
  await expect(page.getByLabel('Bottom Right')).toHaveValue('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('5 / 21');
  await page.getByLabel('Bottom Right').selectOption('none');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveCount(0);
  await expect(page.locator('#source')).toHaveValue(/    metadata:\n      metadataBottomRight: "none"/);
  await expect(page.locator('#source')).toHaveValue(/footerNumber: true/);
  page.once('dialog', dialog => { void dialog.accept(); });
  await page.locator('#reset-master').click();
  await expect(page.locator('#source')).toHaveValue(/master: \{\}/);
  await expect(page.locator('#source')).not.toHaveValue(/footerNumber:|metadata:|metadataBottomRight:|background:|backdrop:/);
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');
  await expect(page.getByLabel('Bottom Right')).toHaveValue('none');
  await expect.poll(async () => readFile(join(directory, 'presentations', 'Legacy-settings.md'), 'utf8')).toContain('master: {}');
});

test('sample image renders in the editor and audience without allowing arbitrary image paths', async ({ page, context }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('Images');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await page.locator('#source').fill(`::slide{id="first"}
# Example

![Landscape](assets/sample-landscape.svg)

![Not available](assets/private.png)`);
  const preview = page.locator('#preview .preview-card').first();
  await expect(preview.locator('img.slide-image')).toHaveCount(1);
  await expect.poll(() => preview.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(preview.locator('.asset-fallback')).toContainText('Not available');
  await expect(preview.locator('.layout-type')).toHaveText('Title Content');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toBeDisabled();
  await page.locator('#present').click();
  await expect(page.locator('#stage img.slide-image')).toHaveCount(1);
  const audiencePromise = context.waitForEvent('page');
  await page.locator('#local-audience').click();
  const audience = await audiencePromise;
  await expect(audience.locator('#audience-stage img.slide-image')).toHaveCount(1);
  await expect.poll(() => audience.locator('#audience-stage img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(audience.locator('#audience-stage .asset-fallback')).toContainText('Not available');
});

test('external edit opens conflict dialog without overwriting either version', async ({ page }) => {
  const name = 'conflict.md';
  await page.goto(origin);
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  const original = await readFile(join(directory, 'presentations', name), 'utf8');
  await page.locator('#source').fill(original + '\nDraft reverted');
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#source').fill(original);
  await expect(page.locator('#save')).toBeDisabled();
  const disk = original.replace('Edit this slide in Markdown.', 'External update');
  await writeFile(join(directory, 'presentations', name), disk);
  await page.locator('#source').fill(original.replace('Edit this slide in Markdown.', 'Unsaved browser draft'));
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#save').click();
  await expect(page.locator('#conflict-dialog')).toBeVisible();
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#draft-text')).toHaveValue(/Unsaved browser draft/);
  expect(await readFile(join(directory, 'presentations', name), 'utf8')).toBe(disk);
  await page.locator('#use-disk').click();
  await expect(page.locator('#source')).toHaveValue(disk);
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#conflict-dialog')).toBeHidden();
});

test('title pencil, slide buttons and multiple plain preview paragraphs work together', async ({ page }) => {
  await page.goto(origin);
  await page.locator('#deck-name').fill('Preview editing');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();

  const title = page.locator('#page-title');
  const pencil = page.locator('#edit-title');
  const titleBox = await title.boundingBox();
  const pencilBox = await pencil.boundingBox();
  expect(titleBox && pencilBox && pencilBox.x >= titleBox.x + titleBox.width).toBeTruthy();
  await expect(pencil.locator('svg path')).toHaveAttribute('d', /M4 20.*12-12/);
  await pencil.click();
  await expect(pencil).toBeHidden();
  await page.locator('#title-input').press('Escape');
  await expect(pencil).toBeVisible();

  const add = page.getByRole('button', { name: 'Add slide', exact: true });
  const child = page.getByRole('button', { name: 'Add child slide', exact: true });
  for (const button of [add, child]) {
    await expect(button).toBeVisible();
    await expect(button.locator('.add-slide-icon svg path')).toHaveAttribute('d', 'M12 6v12M6 12h12');
    const offset = await button.locator('.add-slide-icon svg').evaluate(icon => {
      const circle = icon.parentElement!.getBoundingClientRect();
      const mark = icon.getBoundingClientRect();
      return [(mark.left + mark.right - circle.left - circle.right) / 2,
        (mark.top + mark.bottom - circle.top - circle.bottom) / 2];
    });
    expect(offset.every(value => Math.abs(value) <= 0.5)).toBeTruthy();
    expect(await button.locator('.add-slide-icon').evaluate(icon => getComputedStyle(icon).backgroundColor)).toBe('rgb(35, 84, 173)');
  }

  const original = await readFile(join(directory, 'presentations', 'Preview-editing.md'), 'utf8');
  await page.locator('#source').fill(original.replace('Edit this slide in Markdown.', 'Edit this slide in Markdown.\n\nTests'));
  const paragraphs = page.locator('.preview-card').first().locator('.stage > .slide-content > .slide-markdown > p[contenteditable="plaintext-only"]');
  await expect(paragraphs).toHaveCount(0);
  await expect(paragraphs).toHaveCount(2);
  await paragraphs.nth(1).fill('Updated tests');
  await paragraphs.nth(1).press('Tab');
  await expect(page.locator('#source')).toHaveValue(/Edit this slide in Markdown\.\n\nUpdated tests/);
  await expect(paragraphs).toHaveCount(2);
  await paragraphs.first().fill('Updated intro');
  await page.waitForTimeout(350);
  await paragraphs.first().press('Tab');
  await expect(page.locator('#source')).toHaveValue(/Updated intro\n\nUpdated tests/);
  await child.click();
  await expect(page.locator('#source')).toHaveValue(/::slide\{id="slide-[\da-f]{8}" parent="welcome"\}/);
  await add.click();
  await expect(page.locator('.preview-card')).toHaveCount(3);
  await expect.poll(async () => readFile(join(directory, 'presentations', 'Preview-editing.md'), 'utf8')).toContain('Updated tests');
  await expect(page.locator('#save')).toBeDisabled();
});

test('renaming a slide ID updates all source references and autosaves the deck', async ({ page }) => {
  const name = 'rename-ids.md';
  await page.goto(origin);
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  const original = `---
slides:
  layouts:
    welcome: two-columns
---
::slide{id="welcome"}
# Welcome

welcome is mentioned in prose.

\`\`\`text
::slide{id="example" parent="welcome"}
\`\`\`

::slide{id="child" parent="welcome"}
# Child

::slide{id="grandchild" parent="child"}
# Grandchild
`;
  const source = page.locator('#source');
  await source.fill(original);
  await expect(page.locator('.preview-card')).toHaveCount(3);
  await expect.poll(async () => readFile(join(directory, 'presentations', name), 'utf8')).toBe(original);
  await expect(page.locator('#save')).toBeDisabled();

  await source.fill(original.replace('id="welcome"', 'id="opening"'));
  await expect(source).toHaveValue(/layouts:\n    opening: two-columns/);
  await expect(source).toHaveValue(/::slide\{id="child" parent="opening"\}/);
  await expect(source).toHaveValue(/welcome is mentioned in prose\./);
  await expect(source).toHaveValue(/::slide\{id="example" parent="welcome"\}/);
  await expect(page.locator('.outline-item[aria-current="true"]')).toContainText('Welcome');
  await expect(page.locator('.preview-card.selected')).toHaveAttribute('data-slide-id', 'opening');

  const renamed = await source.inputValue();
  await source.fill(renamed.replace('id="opening"', 'id=""'));
  await source.fill(renamed.replace('id="opening"', 'id="start"'));
  await expect(source).toHaveValue(/layouts:\n    start: two-columns/);
  await expect(source).toHaveValue(/::slide\{id="child" parent="start"\}/);
  await expect.poll(async () => readFile(join(directory, 'presentations', name), 'utf8')).toBe(await source.inputValue());
  await expect(page.locator('#save')).toBeDisabled();

  await page.reload();
  await page.locator('.deck-card').filter({ hasText: name }).getByRole('button', { name: 'Edit deck' }).click();
  await expect(page.locator('.preview-card.selected')).toHaveAttribute('data-slide-id', 'start');
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');
});

test('add slide actions align source with the highlighted hierarchy, including displaced children', async ({ page }) => {
  const name = 'child-placement.md';
  await page.goto(origin);
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  const source = page.locator('#source');
  await source.fill(`::slide{id="root"}
# Root

::slide{id="child" parent="root"}
# Child

::slide{id="leaf" parent="child"}
# Leaf

::slide{id="middle" parent="root"}
# Middle

::slide{id="late" parent="child"}
# Late child

::slide{id="last"}
# Last
`);
  await expect(page.locator('.preview-card')).toHaveCount(6);
  const addChild = page.getByRole('button', { name: 'Add child slide', exact: true });
  await page.getByRole('button', { name: '2. Child', exact: true }).click();
  await addChild.click();
  let updated = await source.inputValue();
  const insertedId = /::slide\{id="(slide-[\da-f]{8})" parent="child"\}/.exec(updated)?.[1];
  expect(insertedId).toBeDefined();
  expect([...updated.matchAll(/^::slide\{id="([^"]+)"/gm)].map(match => match[1]))
    .toEqual(['root', 'child', 'leaf', 'late', insertedId, 'middle', 'last']);
  expect(await source.evaluate(element => (element as HTMLTextAreaElement).selectionStart))
    .toBe(updated.indexOf(`::slide{id="${insertedId}" parent="child"}`));
  await expect(page.locator('.preview-card.selected')).toHaveAttribute('data-slide-id', insertedId!);

  await expect(page.locator('.preview-card')).toHaveCount(7);
  await page.locator('.outline-item').filter({ hasText: 'Middle' }).click();
  await addChild.click();
  updated = await source.inputValue();
  expect(updated).toMatch(/::slide\{id="middle" parent="root"\}[\s\S]*::slide\{id="slide-[\da-f]{8}" parent="middle"\}[\s\S]*::slide\{id="last"\}/);
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');

  await page.getByRole('button', { name: 'Add slide', exact: true }).click();
  updated = await source.inputValue();
  expect(updated).toMatch(/::slide\{id="slide-[\da-f]{8}" parent="middle"\}[\s\S]*::slide\{id="slide-[\da-f]{8}"\}\s+## New slide\s+::slide\{id="last"\}/);
  await expect.poll(async () => readFile(join(directory, 'presentations', name), 'utf8')).toBe(updated);
  await expect(page.locator('#save')).toBeDisabled();
});
