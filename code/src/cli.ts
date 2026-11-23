import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { startHost } from './host';
import { grantDeck, hasSymlink, libraryRoot, listDecks } from './library';
import { runLintCli } from './lint';
import { hasUiAssets } from './runtime-assets';
import { ensureSampleImage } from './sample-image';

export interface ParsedCliArgs {
  mode: 'help' | 'lint' | 'serve' | 'error';
  error?: string;
  lintArgs?: string[];
  deckPath?: string;
  port: number;
  openBrowser: boolean;
}

export function parseCliArgs(rawArgs: string[]): ParsedCliArgs {
  if (rawArgs[0] === 'lint') {
    return { mode: 'lint', lintArgs: rawArgs.slice(1), port: 0, openBrowser: false };
  }
  let port = 0;
  let openBrowser = process.env.SLIDES_NO_OPEN !== '1';
  const positionals: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--help' || arg === '-h') {
      return { mode: 'help', port: 0, openBrowser: false };
    }
    if (arg === '--no-open') {
      openBrowser = false;
      continue;
    }
    if (arg === '--port') {
      const next = Number(rawArgs[++i]);
      if (!Number.isInteger(next) || next < 0 || next > 65535) {
        return { mode: 'error', error: 'Invalid --port value (expected 0 or 1024-65535).', port: 0, openBrowser: false };
      }
      if (next !== 0 && next < 1024) {
        return { mode: 'error', error: 'Invalid --port value (expected 0 or 1024-65535).', port: 0, openBrowser: false };
      }
      port = next;
      continue;
    }
    if (arg.startsWith('-')) {
      return { mode: 'error', error: `Unknown option: ${arg}`, port: 0, openBrowser: false };
    }
    positionals.push(arg);
  }
  if (positionals.length > 1) {
    return { mode: 'error', error: 'Expected at most one deck path. Use "slides lint <files...>" to lint multiple files.', port: 0, openBrowser: false };
  }
  return { mode: 'serve', deckPath: positionals[0], port, openBrowser };
}

function openDefaultBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch { /* headless host */ }
}

export async function runCli(
  rawArgs: string[],
  io: { stdout: (line: string) => void; stderr: (line: string) => void } = {
    stdout: line => console.log(line),
    stderr: line => console.error(line),
  },
): Promise<{ exitCode?: number; stop?: () => void }> {
  const parsed = parseCliArgs(rawArgs);
  if (parsed.mode === 'help') {
    io.stdout([
      'Usage:',
      '  slides [deck.mdx|deck.md] [--port <port>] [--no-open]',
      '  slides lint [--json] <deck.mdx|deck.md> [...]',
    ].join('\n'));
    return { exitCode: 0 };
  }
  if (parsed.mode === 'error') {
    io.stderr(parsed.error ?? 'Invalid arguments.');
    return { exitCode: 2 };
  }
  if (parsed.mode === 'lint') {
    return { exitCode: await runLintCli(parsed.lintArgs ?? [], io) };
  }

  let initialDeckId: string | undefined;
  if (parsed.deckPath !== undefined) {
    const resolved = resolve(parsed.deckPath);
    const ext = extname(resolved).toLowerCase();
    if (ext !== '.md' && ext !== '.mdx') {
      io.stderr(`Unsupported file "${parsed.deckPath}": expected a .md or .mdx presentation file.`);
      return { exitCode: 2 };
    }
    let symlink: boolean;
    try {
      symlink = await hasSymlink(resolved);
    } catch (error) {
      const missing = error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code));
      io.stderr(missing ? `Deck file not found: ${parsed.deckPath}` : `Cannot access deck file: ${parsed.deckPath}`);
      return { exitCode: 2 };
    }
    if (symlink) {
      io.stderr(`Refusing to open symlinked path: ${parsed.deckPath}`);
      return { exitCode: 3 };
    }
    try {
      const info = await stat(resolved);
      if (!info.isFile()) {
        io.stderr(`Path is not a regular file: ${parsed.deckPath}`);
        return { exitCode: 2 };
      }
      const handle = await open(resolved, 'r');
      await handle.close();
    } catch {
      io.stderr(`Cannot read deck file: ${parsed.deckPath}`);
      return { exitCode: 2 };
    }
    const granted = await grantDeck(resolved);
    initialDeckId = granted.id;
  }

  if (!(await hasUiAssets())) {
    io.stderr('Static UI assets are missing; run "bun run build" before starting Slides.');
    return { exitCode: 2 };
  }

  await listDecks();
  await ensureSampleImage(libraryRoot);
  const launchTicket = randomBytes(32).toString('base64url');
  const ticketExpiresAt = Date.now() + 60_000;
  const server = startHost(parsed.port, {
    requireTicket: true,
    launchTicket,
    ticketExpiresAt,
    initialDeckId,
  });
  const launchUrl = `http://127.0.0.1:${server.port}/#ticket=${launchTicket}`;
  io.stdout(`Local Slides: http://127.0.0.1:${server.port}`);
  io.stdout(`Launch URL: ${launchUrl}`);
  if (parsed.openBrowser) openDefaultBrowser(launchUrl);
  return { stop: () => server.stop(true) };
}

if (import.meta.main) {
  const result = await runCli(process.argv.slice(2));
  if (result.exitCode !== undefined) process.exit(result.exitCode);
  const shutdown = () => {
    result.stop?.();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
