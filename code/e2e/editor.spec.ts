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
  await expect(page.locator('#save')).toHaveCSS('border-radius', '8px');
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
  await page.locator('#settings-button').click();
  await expect(page.locator('#master-pane')).toBeVisible();
  await expect(page.locator('#settings-fields select')).toHaveCount(6);
  await expect(page.getByLabel('Top Left').locator('option')).toHaveText([
    'None', 'Slide Number / Total', 'Presentation Title', 'Slide Title', 'Footer Text', 'Logo Text'
  ]);
  await page.locator('#theme').selectOption('forest');
  await expect(page.locator('#source')).toHaveValue(/theme: "forest"/);
  await page.getByLabel('Slide number in footer').check();
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('1 / 2');
  await page.getByLabel('Top Left').selectOption('slideNumber');
  await expect(page.locator('#master-preview .slide-meta[data-position="TopLeft"]')).toHaveText('1 / 2');
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveCount(0);
  await page.getByLabel('Bottom Right').selectOption('slideNumber');
  await expect(page.locator('#source')).toHaveValue(/metadataBottomRight: "slideNumber"/);
  await page.getByLabel('Top Center').selectOption('deckTitle');
  await expect(page.locator('#source')).toHaveValue(/metadataTopCenter: "deckTitle"/);
  await expect(page.locator('#master-preview .slide-meta[data-position="BottomRight"]')).toHaveText('1 / 2');
  await page.locator('[data-view="source"]').click();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'source');
  await page.locator('#save').click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect(page.locator('#save')).toBeDisabled();
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toContain('Updated audience paragraph');
  expect(await readFile(join(directory, name), 'utf8')).toContain('theme: "forest"');

  await expect(page.locator('#present')).toBeEnabled();
  await page.locator('#present').click();
  await expect(page.locator('#presentation-page')).toBeVisible();
  await expect(page.locator('#speaker-notes')).toContainText('PRIVATE SPEAKER NOTES');
  await expect(page.locator('#stage .slide-meta[data-position="BottomRight"]')).toHaveText('1 / 2');
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
  const paragraphs = page.locator('.preview-card').first().locator('.stage > .slide-markdown > p[contenteditable="plaintext-only"]');
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

test('add child slide inserts under the highlighted source subtree, not at the end', async ({ page }) => {
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

::slide{id="middle"}
# Middle

::slide{id="last"}
# Last
`);
  await expect(page.locator('.preview-card')).toHaveCount(5);
  const addChild = page.getByRole('button', { name: 'Add child slide', exact: true });
  await page.locator('.outline-item').filter({ hasText: 'Root' }).click();
  await addChild.click();
  let updated = await source.inputValue();
  expect(updated).toMatch(/::slide\{id="leaf" parent="child"\}[\s\S]*::slide\{id="slide-[\da-f]{8}" parent="root"\}[\s\S]*::slide\{id="middle"\}/);

  await expect(page.locator('.preview-card')).toHaveCount(6);
  await page.locator('.outline-item').filter({ hasText: 'Middle' }).click();
  await addChild.click();
  updated = await source.inputValue();
  expect(updated).toMatch(/::slide\{id="middle"\}[\s\S]*::slide\{id="slide-[\da-f]{8}" parent="middle"\}[\s\S]*::slide\{id="last"\}/);
  await expect(page.locator('#diagnostics')).toHaveText('No diagnostics');

  await page.getByRole('button', { name: 'Add slide', exact: true }).click();
  updated = await source.inputValue();
  expect(updated).toMatch(/::slide\{id="last"\}[\s\S]*::slide\{id="slide-[\da-f]{8}"\}\s+## New slide\s*$/);
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toBe(updated);
  await expect(page.locator('#save')).toBeDisabled();
});
