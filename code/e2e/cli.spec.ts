import { expect, test } from '@playwright/test';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workspace: string;
let emptyRunCwd: string;
let binaryPath: string;
let server: ChildProcessWithoutNullStreams | undefined;

test.beforeAll(async () => {
  test.setTimeout(90_000);
  workspace = await mkdtemp(join(tmpdir(), 'slides-cli-e2e-'));
  emptyRunCwd = join(workspace, 'empty-cwd');
  await mkdir(emptyRunCwd, { recursive: true });
  binaryPath = join(process.cwd(), 'build', process.platform === 'win32' ? 'slides.exe' : 'slides');
  const built = spawnSync('bun', ['./scripts/build-binary.ts'], { cwd: process.cwd(), stdio: 'inherit' });
  expect(built.status).toBe(0);
  expect(existsSync(binaryPath)).toBe(true);
});

test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const stopped = new Promise<void>(resolve => server!.once('exit', () => resolve()));
    server.kill();
    await stopped;
  }
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

test('standalone binary opens Unicode/space deck in draft editor with one-use ticket and runs outside repo', async ({ page, context, request }) => {
  const missingRun = spawnSync(binaryPath, [join(workspace, 'missing.mdx'), '--no-open'], {
    cwd: emptyRunCwd,
    env: { ...process.env, SLIDES_LIBRARY: join(workspace, 'lib') },
    encoding: 'utf8',
  });
  expect(missingRun.status).toBe(2);
  expect(missingRun.stderr).toContain('not found');

  const deckDir = join(workspace, 'My Talks — 2026');
  await mkdir(deckDir, { recursive: true });
  const deckFile = join(deckDir, 'Quarterly Review — naïve.mdx');
  await writeFile(
    deckFile,
    `---
slides:
  formatVersion: 1
  title: "Quarterly Review — naïve"
---
::slide{id="intro"}
# Standalone Launch

![Sample](assets/sample-landscape.svg)
`,
    'utf8',
  );

  const lintRun = spawnSync(binaryPath, ['lint', deckFile], {
    cwd: emptyRunCwd,
    env: { ...process.env, SLIDES_LIBRARY: join(workspace, 'lib') },
    encoding: 'utf8',
  });
  expect(lintRun.status).toBe(0);
  expect(lintRun.stdout).toContain('OK');

  server = spawn(binaryPath, [deckFile, '--no-open'], {
    cwd: emptyRunCwd,
    env: { ...process.env, SLIDES_LIBRARY: join(workspace, 'lib') },
  });

  const { baseOrigin, launchUrl } = await new Promise<{ baseOrigin: string; launchUrl: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Binary did not report launch URL: ${out}`)), 20_000);
    let out = '';
    server!.once('error', err => { clearTimeout(timer); reject(err); });
    server!.once('exit', code => { clearTimeout(timer); reject(new Error(`Binary exited (${code}): ${out}`)); });
    server!.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      const base = /Local Slides: (http:\/\/127\.0\.0\.1:\d+)/.exec(out)?.[1];
      const launch = /Launch URL: (http:\/\/127\.0\.0\.1:\d+\/#ticket=[A-Za-z0-9_-]+)/.exec(out)?.[1];
      if (base && launch) {
        clearTimeout(timer);
        resolve({ baseOrigin: base, launchUrl: launch });
      }
    });
    server!.stderr.on('data', (chunk: Buffer) => { out += chunk.toString(); });
  });

  expect((await request.get(`${baseOrigin}/api/bootstrap`)).status()).toBe(403);

  await page.goto(launchUrl);
  await expect(page.locator('#editor-page')).toBeVisible();
  await expect(page.locator('#presentation-page')).toBeHidden();
  expect(page.url()).toBe(`${baseOrigin}/`);
  await expect(page.locator('#page-title')).toHaveText('Quarterly Review — naïve');
  await expect(page.locator('#preview .preview-card h1')).toHaveText('Standalone Launch');
  await expect.poll(() =>
    page.locator('#preview img.slide-image').evaluate(img => (img as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('#library-page')).toBeVisible();

  const intruderContext = await context.browser()!.newContext();
  try {
    const intruder = await intruderContext.newPage();
    await intruder.goto(launchUrl);
    await expect(intruder.locator('#save-status')).toContainText('Bootstrap failed (403)');
  } finally {
    await intruderContext.close();
  }
});
