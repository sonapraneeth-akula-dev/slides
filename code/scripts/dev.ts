import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function availablePort(): Promise<number> {
  const server = createServer();
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') reject(new Error('Cannot allocate a development API port.'));
      else resolve(address.port);
    });
  });
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

const uiPort = Number(process.env.SLIDES_DEV_PORT ?? 4321);
if (!Number.isInteger(uiPort) || uiPort < 1024 || uiPort > 65535) throw new Error('Invalid development UI port.');
let apiPort = await availablePort();
while (apiPort === uiPort) apiPort = await availablePort();
const env = { ...process.env, SLIDES_DEV_MODE: '1', SLIDES_DEV_API_PORT: String(apiPort) };
const children: ReturnType<typeof spawn>[] = [];
let stopping = false;
let signalStop: () => void;
const stopped = new Promise<void>(resolve => { signalStop = resolve; });
function stop(): void {
  stopping = true;
  for (const child of children) child.kill();
  signalStop();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function waitFor(url: string, child: ReturnType<typeof spawn>, check: (response: Response) => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (stopping) throw new Error('Development servers stopped.');
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Development server exited before becoming ready: ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (await check(response)) return;
    } catch (error) {
      if (!(error instanceof TypeError) && !(error instanceof DOMException)) throw error;
    }
    await Bun.sleep(100);
  }
  throw new Error(`Development server did not become ready: ${url}`);
}

try {
  const api = spawn(process.execPath, ['--watch', '--no-clear-screen', './src/host.ts'], {
    cwd: process.cwd(), env, stdio: 'inherit',
  });
  children.push(api);
  api.on('error', error => console.error('Development API failed:', error));
  await waitFor(`http://127.0.0.1:${apiPort}/api/bootstrap`, api, async response => response.ok && (await response.json()).devMode === true);

  const ui = spawn(process.execPath, ['./node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', String(uiPort)], {
    cwd: process.cwd(), env, stdio: 'inherit',
  });
  children.push(ui);
  ui.on('error', error => console.error('Astro dev server failed:', error));
  const url = `http://127.0.0.1:${uiPort}`;
  await waitFor(`${url}/api/bootstrap`, ui, async response => response.ok && (await response.json()).devMode === true);
  console.log(`Slides development: ${url}`);
  await Promise.race([
    stopped,
    api.exitCode === null ? new Promise<never>((_, reject) => api.once('exit', code => reject(new Error(`Development API exited (${code}).`)))) : Promise.reject(new Error('Development API exited.')),
    ui.exitCode === null ? new Promise<never>((_, reject) => ui.once('exit', code => reject(new Error(`Astro dev server exited (${code}).`)))) : Promise.reject(new Error('Astro dev server exited.')),
  ]);
} finally {
  stop();
  await Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise<void>(resolve => child.once('exit', () => resolve()))));
}
