import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function availablePort(exclude: number): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const port = 20000 + Math.floor(Math.random() * 20000);
    if (port === exclude) continue;
    const probe = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        probe.once('error', reject);
        probe.listen(port, '127.0.0.1', resolve);
      });
      return port;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
    } finally {
      if (probe.listening) await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    }
  }
  throw new Error('No available development API port.');
}

const uiPort = Number(process.env.SLIDES_DEV_PORT ?? 4321);
if (!Number.isInteger(uiPort) || uiPort < 1024 || uiPort > 65535) throw new Error('Invalid development UI port.');
const requestedApiPort = await availablePort(uiPort);
const env = { ...process.env, SLIDES_DEV_MODE: '1', SLIDES_DEV_API_PORT: String(requestedApiPort) };
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
  const api = spawn(process.execPath, ['--hot', '--no-clear-screen', './src/host.ts'], {
    cwd: process.cwd(), env, stdio: ['inherit', 'pipe', 'inherit'],
  });
  children.push(api);
  const apiPort = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Development API did not report a port.')), 15_000);
    let output = '';
    let boundPort = 0;
    api.stdout?.on('data', (chunk: Buffer) => {
      const value = chunk.toString();
      process.stdout.write(value);
      output += value;
      let newline: number;
      while ((newline = output.indexOf('\n')) >= 0) {
        const line = output.slice(0, newline).trim();
        output = output.slice(newline + 1);
        const match = /^Local Slides: http:\/\/127\.0\.0\.1:(\d+)$/.exec(line);
        if (!match) continue;
        const port = Number(match[1]);
        if (!boundPort) {
          if (port !== requestedApiPort) {
            clearTimeout(timeout);
            reject(new Error(`Development API bound port ${port}, not requested port ${requestedApiPort}.`));
            return;
          }
          boundPort = port;
          clearTimeout(timeout);
          resolve(port);
        } else if (port !== boundPort) {
          console.error(`Development API port changed from ${boundPort} to ${port}; restart bun run dev.`);
          process.exitCode = 1;
          stop();
        }
      }
    });
    api.once('error', error => { clearTimeout(timeout); reject(error); });
    api.once('exit', code => { clearTimeout(timeout); reject(new Error(`Development API exited (${code}).`)); });
  });
  await waitFor(`http://127.0.0.1:${apiPort}/api/bootstrap`, api, async response => response.ok && (await response.json()).devMode === true);

  const ui = spawn(process.execPath, ['./node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', String(uiPort)], {
    cwd: process.cwd(), env: { ...env, SLIDES_DEV_API_PORT: String(apiPort) }, stdio: 'inherit',
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
