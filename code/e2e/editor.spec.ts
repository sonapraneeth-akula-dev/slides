import { expect, test } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('author, persist, present and share only read-only public state', async ({ page, context, request }) => {
  const name = 'browser-acceptance.md';
  await page.goto(origin);
  await expect(page.locator('#library-page')).toBeVisible();
  await expect(page.locator('#dev-mode')).toBeHidden();
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#theme option')).toHaveText(['Signal', 'Paper', 'Midnight', 'Forest']);
  await expect(page.locator('.preview-card').first().locator('.layout-type')).toHaveText('Title Content');
  await expect(page.locator('.preview-card').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.preview-card').first().locator('select option')).toHaveText([
    'Title Content', 'Two Columns', 'Three Columns', 'Picture Text', 'Blank'
  ]);
  await page.locator('#editor-actions .export-menu summary').click();
  await expect(page.locator('#editor-actions .export-options')).toBeVisible();
  await expect(page.locator('#editor-actions .export-options button')).toHaveText([
    'Export To PDF (Coming Later)', 'Export To HTML (Coming Later)'
  ]);
  await expect(page.locator('#editor-actions .export-options button:enabled')).toHaveCount(0);
  await page.locator('#editor-actions .export-menu summary').click();
  await expect(page.locator('#save')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.editor-buttons')).toHaveCSS('border-radius', '8px');
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
  await expect(page.locator('#settings-fields select')).toHaveCount(8);
  await expect(page.getByLabel('Slide number in footer')).toHaveCount(0);
  const samples = page.locator('#master-preview .sample-list button');
  const viewer = page.locator('#master-preview .sample-viewer');
  const choose = async (index: number) => {
    await samples.nth(index).click();
    await expect(samples.nth(index)).toHaveAttribute('aria-current', 'true');
  };
  await expect(samples).toHaveCount(17);
  await expect(samples).toHaveText([
    '1. Blank', '2. Title and subtitle', '3. Title, subtitle and image', '4. Heading only',
    '5. Heading and content', '6. Heading and two text columns', '7. Heading and three columns',
    '8. Heading and two images', '9. Heading, image and text', '10. Heading, text and image',
    '11. Image only', '12. Picture with caption', '13. Heading and table', '14. Heading and code',
    '15. Heading and chart', '16. Heading and diagram', '17. Heading and equation'
  ]);
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
  await choose(12);
  await expect(viewer.locator('table')).toHaveCount(1);
  await choose(13);
  await expect(viewer.locator('pre code')).toContainText('const answer = 42');
  await choose(14);
  await expect(viewer.locator('.chart-visual canvas')).toHaveCount(1);
  await choose(15);
  await expect(viewer.locator('.special-fence[data-kind="mermaid"] svg')).toHaveCount(1);
  await choose(16);
  await expect(viewer.locator('.katex')).toHaveCount(1);
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
  await page.getByLabel('Left margin (%)').fill('8');
  await page.getByLabel('Left margin (%)').press('Tab');
  await page.getByLabel('Left padding (%)').fill('3');
  await page.getByLabel('Left padding (%)').press('Tab');
  await page.getByLabel('Code font').fill('Consolas');
  await page.getByLabel('Code font').press('Tab');
  await expect(page.locator('#master-preview .stage').first()).toHaveCSS('--slide-margin-left', '8%');
  await expect(page.locator('#master-preview .slide-content').first()).toHaveCSS('padding-left', /px/);
  await expect(page.locator('#master-preview .stage h1').first()).toHaveCSS('text-align', 'center');
  await choose(13);
  await expect(viewer.locator('pre code')).toHaveCSS('font-family', 'Consolas');
  await choose(1);
  await page.getByLabel('Bottom Right').selectOption('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 17');
  await page.getByLabel('Top Left').selectOption('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="TopLeft"]')).toHaveText('2 / 17');
  await expect(page.locator('#source')).toHaveValue(/    metadata:\n      metadataBottomRight: "slideNumber"/);
  await page.getByLabel('Top Center').selectOption('deckTitle');
  await expect(page.locator('#source')).toHaveValue(/metadataTopCenter: "deckTitle"/);
  await expect(page.locator('#source')).toHaveValue(/      metadataTopLeft: "slideNumber"/);
  await expect(page.locator('#master-preview .slide-meta[data-position="TopCenter"]')).toHaveText('Browser acceptance');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('2 / 17');
  await page.locator('[data-view="source"]').click();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'source');
  await page.locator('#save').click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect(page.locator('#save-status')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('#save')).toBeDisabled();
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toContain('Updated audience paragraph');
  expect(await readFile(join(directory, name), 'utf8')).toContain('theme: "forest"');
  expect(await readFile(join(directory, name), 'utf8')).toContain('headingPlacement: "center"');
  expect(await readFile(join(directory, name), 'utf8')).toContain('marginLeft: 8');
  expect(await readFile(join(directory, name), 'utf8')).toContain('paddingLeft: 3');
  expect(await readFile(join(directory, name), 'utf8')).toContain('    metadata:\n');

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
  await page.getByLabel('Left margin (%)').fill('8');
  await page.getByLabel('Left margin (%)').press('Tab');
  await page.getByLabel('Right margin (%)').fill('12');
  await page.getByLabel('Right margin (%)').press('Tab');
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
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toContain('marginLeft: 8');
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
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('5 / 17');
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
  await expect.poll(async () => readFile(join(directory, 'Legacy-settings.md'), 'utf8')).toContain('master: {}');
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
  const original = await readFile(join(directory, name), 'utf8');
  await page.locator('#source').fill(original + '\nDraft reverted');
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#source').fill(original);
  await expect(page.locator('#save')).toBeDisabled();
  const disk = original.replace('Edit this slide in Markdown.', 'External update');
  await writeFile(join(directory, name), disk);
  await page.locator('#source').fill(original.replace('Edit this slide in Markdown.', 'Unsaved browser draft'));
  await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#save').click();
  await expect(page.locator('#conflict-dialog')).toBeVisible();
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#draft-text')).toHaveValue(/Unsaved browser draft/);
  expect(await readFile(join(directory, name), 'utf8')).toBe(disk);
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

  const original = await readFile(join(directory, 'Preview-editing.md'), 'utf8');
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
  await expect.poll(async () => readFile(join(directory, 'Preview-editing.md'), 'utf8')).toContain('Updated tests');
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
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toBe(original);
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
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toBe(await source.inputValue());
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
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toBe(updated);
  await expect(page.locator('#save')).toBeDisabled();
});
