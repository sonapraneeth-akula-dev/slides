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
  await page.locator('#deck-name').fill(name);
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
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
  await page.locator('#theme').selectOption('forest');
  await expect(page.locator('#source')).toHaveValue(/theme: "forest"/);
  await page.locator('[data-view="source"]').click();
  await expect(page.locator('#editor-panes')).toHaveAttribute('data-view', 'source');
  await page.locator('#save').click();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect.poll(async () => readFile(join(directory, name), 'utf8')).toContain('Updated audience paragraph');
  expect(await readFile(join(directory, name), 'utf8')).toContain('theme: "forest"');

  await expect(page.locator('#present')).toBeEnabled();
  await page.locator('#present').click();
  await expect(page.locator('#presentation-page')).toBeVisible();
  await expect(page.locator('#speaker-notes')).toContainText('PRIVATE SPEAKER NOTES');
  await expect(page.getByRole('button', { name: 'Export (coming later)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save annotations (coming later)' })).toBeDisabled();
  const popupPromise = context.waitForEvent('page');
  await page.locator('#local-audience').click();
  const audience = await popupPromise;
  await audience.waitForLoadState('domcontentloaded');
  await expect(audience.locator('#audience-stage')).toContainText('Original paragraph');
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
  const original = await readFile(join(directory, name), 'utf8');
  const disk = original.replace('Edit this slide in Markdown.', 'External update');
  await writeFile(join(directory, name), disk);
  await page.locator('#source').fill(original.replace('Edit this slide in Markdown.', 'Unsaved browser draft'));
  await page.locator('#save').click();
  await expect(page.locator('#conflict-dialog')).toBeVisible();
  await expect(page.locator('#draft-text')).toHaveValue(/Unsaved browser draft/);
  expect(await readFile(join(directory, name), 'utf8')).toBe(disk);
  await page.locator('#use-disk').click();
  await expect(page.locator('#source')).toHaveValue(disk);
  await expect(page.locator('#conflict-dialog')).toBeHidden();
});
