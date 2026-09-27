import { expect, test } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directory: string;
let server: ChildProcessWithoutNullStreams;
let origin: string;

async function availablePort(): Promise<number> {
  const listener = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') reject(new Error('No UI port available'));
      else resolve(address.port);
    });
  });
  await new Promise<void>(resolve => listener.close(() => resolve()));
  return port;
}

test.beforeAll(async () => {
  test.setTimeout(60_000);
  directory = await mkdtemp(join(tmpdir(), 'slides-dev-browser-'));
  const port = await availablePort();
  server = spawn('bun', ['run', 'dev'], {
    cwd: process.cwd(),
    env: { ...process.env, SLIDES_LIBRARY: directory, SLIDES_DEV_PORT: String(port) },
  });
  origin = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Development server did not start: ${output}`)), 55_000);
    let output = '';
    const fail = (error: Error) => { clearTimeout(timeout); reject(error); };
    server.once('error', fail);
    server.once('exit', code => fail(new Error(`Development server exited (${code}): ${output}`)));
    server.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const url = /Slides development: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
      if (url) { clearTimeout(timeout); resolve(url); }
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

test('integrated dev mode serves live UI and API, creates a deck from its title', async ({ page, request }) => {
  await page.goto(origin);
  await expect(page.locator('#dev-mode')).toBeVisible();
  await expect(page.locator('#dev-mode')).toHaveCSS('background-color', 'rgb(169, 37, 53)');
  expect(await page.locator('script[src*="/@vite/client"]').count()).toBeGreaterThan(0);
  expect((await request.get(`${origin}/api/bootstrap`, { headers: { Origin: 'http://untrusted.test' } })).status()).toBe(403);
  await page.locator('#deck-name').fill('example.txt');
  await page.locator('#create').click();
  await expect(page.locator('#toast')).toContainText('must end in .md or .mdx');
  await page.locator('#deck-name').fill('Test Presentation');
  await page.locator('#create').click();
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#source-file')).toContainText('Test-Presentation.md');
  await expect(page.locator('#page-title')).toHaveText('Test Presentation');
  await expect(page.locator('.editor-buttons > button, .view-buttons > button')).toHaveCount(5);
  expect(await page.locator('.editor-buttons > button svg, .view-buttons > button svg').count()).toBe(5);
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('#source')).toHaveValue(/title: "Test Presentation"/);
  const file = join(directory, 'Test-Presentation.md');
  await expect.poll(async () => readFile(file, 'utf8')).toContain('title: "Test Presentation"');
  await page.locator('#source').fill('::slide{id="welcome"}\n# Updated in development\n');
  await expect.poll(async () => readFile(file, 'utf8')).toContain('Updated in development');
  await expect(page.locator('#save-status')).toHaveText('Saved');
});
