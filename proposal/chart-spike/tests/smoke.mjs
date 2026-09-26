import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { chromium } from 'playwright-core';

const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

test('six chart types, offline hydration, selection and static PDF', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const plain = await readFile(path.join(root, 'plain/index.html'), 'utf8');
  assert.equal((html.match(/data-chart="/g) || []).length, 6, 'SSR must show six charts without JS');
  assert.ok((html.match(/<svg/g) || []).length >= 6, 'SSR must provide static SVG charts');
  assert.match(html, /Beta, East/, 'CSV quoted field survives');
  assert.doesNotMatch(plain, /<script|astro-island|_astro\//i, 'plain page must ship no JS');
  assert.doesNotMatch(html, /<img src=x onerror/, 'hostile data must not inject markup');
  assert.match(html, /&lt;img src=x onerror/, 'hostile data remains readable escaped text');
  const dense = await readFile(path.join(root, 'dense/index.html'), 'utf8');
  assert.equal((dense.match(/data-chart="/g) || []).length, 6);
  assert.match(dense, /Point 999/, '1000-point chart renders without a client-only fallback');
  assert.match(html, /fill="#1d4ed8"/, 'base palette is present in exported SVG');
  assert.match(dense, /fill="#0f766e"/, 'alternate master palette changes exported SVG');

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`,
      url.pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
      response.writeHead(403).end(); return;
    }
    try {
      const target = (await stat(file)).isDirectory() ? path.join(file, 'index.html') : file;
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
      createReadStream(target).pipe(response);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browsers = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = browsers.find(existsSync);
  assert.ok(executablePath, 'install Chrome or Edge to check browser behavior');
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === `http://127.0.0.1:${port}`) return route.continue();
      errors.push(`Unexpected external request: ${route.request().url()}`);
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    try {
      await page.locator('astro-island:not([ssr])').waitFor({ timeout: 10000 });
    } catch (error) {
      console.error('Hydration diagnostics:', errors);
      throw error;
    }
    await page.locator('[data-chart="bar"] svg').waitFor();
    const bar = page.locator('[data-chart="bar"] [data-testid^="bar.item.value."]').first();
    await bar.hover();
    await page.waitForFunction(() => document.querySelector('[data-testid="bar-status"]')?.textContent?.includes('Hovered: bar: Alpha 12'));
    assert.match(await page.getByTestId('bar-status').textContent(), /Hovered: bar: Alpha 12/);
    await bar.click();
    await page.waitForFunction(() => document.querySelector('[data-testid="bar-status"]')?.textContent?.includes('Selected: bar: Alpha 12'));
    assert.match(await page.getByTestId('bar-status').textContent(), /Selected: bar: Alpha 12/);
    for (const [kind, selector, value] of [
      ['line', '[data-testid="line.point.values.1"] circle', 'Beta, East 20'],
      ['area', '[data-testid="line.point.values.1"] circle', 'Beta, East 20'],
      ['scatter', 'svg circle', 'Alpha 12'],
      ['pie', '[data-testid="arc.Docs"]', 'Docs 38'],
      ['donut', '[data-testid="arc.Docs"]', 'Docs 38'],
    ]) {
      const target = page.locator(`[data-chart="${kind}"] ${selector}`).first();
      if (kind === 'line' || kind === 'area' || kind === 'scatter') {
        await target.scrollIntoViewIfNeeded();
        const bounds = await target.boundingBox();
        assert.ok(bounds);
        await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      } else if (kind === 'donut') {
        await target.scrollIntoViewIfNeeded();
        const bounds = await page.locator('[data-chart="donut"] svg').boundingBox();
        assert.ok(bounds);
        await page.mouse.click(bounds.x + 317, bounds.y + 48);
      } else {
        await target.click();
      }
      try {
        await page.waitForFunction(([k, v]) => document.querySelector(`[data-testid="${k}-status"]`)?.textContent?.includes(`Selected: ${k}: ${v}`), [kind, value], { timeout: 4000 });
      } catch (error) {
        console.error(kind, await page.getByTestId(`${kind}-status`).textContent(), errors);
        throw error;
      }
      assert.match(await page.getByTestId(`${kind}-status`).textContent(),
        new RegExp(`Selected: ${kind}: ${value}`));
    }
    await page.locator('[data-chart="donut"] details summary').click();
    await page.getByRole('button', { name: 'Select donut Docs: 38' }).click();
    assert.match(await page.getByTestId('donut-status').textContent(), /Selected: donut: Docs 38/);
    assert.equal(await page.locator('[data-chart="donut"] svg').count(), 1);
    const denseStart = performance.now();
    await page.goto(`http://127.0.0.1:${port}/dense/`);
    await page.locator('astro-island:not([ssr])').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('[data-chart="scatter"] svg circle').count(), 1000);
    console.log(`Dense navigation + hydration: ${Math.round(performance.now() - denseStart)} ms on this host`);
    assert.deepEqual(errors, [], 'hydration and offline requests must be clean');
    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await staticContext.newPage();
    await staticPage.goto(`http://127.0.0.1:${port}/`);
    assert.equal(await staticPage.locator('figure svg').count(), 6, 'PDF gets SVG even without JS');
    const pdf = await staticPage.pdf({ printBackground: true });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    assert.ok(pdf.length > 5000);
    await staticPage.goto(`http://127.0.0.1:${port}/dense/`);
    assert.equal(await staticPage.locator('figure svg').count(), 6);
    await staticContext.close();
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
