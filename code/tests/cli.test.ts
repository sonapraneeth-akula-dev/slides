import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCliArgs, runCli } from '../src/cli';
import { privateRouter } from '../src/host';

describe('CLI parser, launch error codes, and one-use capability bootstrap', () => {
  test('parses serve, lint, help, and invalid flag combinations', () => {
    expect(parseCliArgs([])).toMatchObject({ mode: 'serve', deckPath: undefined, port: 0 });
    expect(parseCliArgs(['talk.mdx', '--no-open', '--port', '4500'])).toMatchObject({
      mode: 'serve', deckPath: 'talk.mdx', openBrowser: false, port: 4500,
    });
    expect(parseCliArgs(['lint', '--json', 'a.mdx'])).toEqual({
      mode: 'lint', lintArgs: ['--json', 'a.mdx'], port: 0, openBrowser: false,
    });
    expect(parseCliArgs(['--help']).mode).toBe('help');
    expect(parseCliArgs(['--port', '80']).mode).toBe('error');
    expect(parseCliArgs(['a.mdx', 'b.mdx']).mode).toBe('error');
    expect(parseCliArgs(['--unknown']).mode).toBe('error');
  });

  test('returns exit code 2 on missing/unsupported paths and 3 on symlinks', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-cli-unit-'));
    try {
      const txt = join(workspace, 'notes.txt');
      const realDir = join(workspace, 'real');
      const symDir = join(workspace, 'sym');
      await writeFile(txt, 'hello');
      await mkdir(realDir);
      await writeFile(join(realDir, 'deck.mdx'), '::slide{id="one"}\n# Title\n');
      await symlink(realDir, symDir, process.platform === 'win32' ? 'junction' : 'dir');
      const quiet = { stdout: () => {}, stderr: () => {} };

      expect((await runCli([join(workspace, 'nope.mdx'), '--no-open'], quiet)).exitCode).toBe(2);
      expect((await runCli([txt, '--no-open'], quiet)).exitCode).toBe(2);
      expect((await runCli([realDir, '--no-open'], quiet)).exitCode).toBe(2);
      expect((await runCli([join(symDir, 'deck.mdx'), '--no-open'], quiet)).exitCode).toBe(3);
      expect((await runCli(['--help'], quiet)).exitCode).toBe(0);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test('enforces single-use ticket exchange and expiry when requireTicket is enabled', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-ticket-'));
    const prevLib = process.env.SLIDES_LIBRARY;
    process.env.SLIDES_LIBRARY = workspace;
    try {
      const route = privateRouter(12355, {
        requireTicket: true,
        launchTicket: 'one-time-secret',
        ticketExpiresAt: Date.now() + 30_000,
        initialDeckId: 'demo-id',
      });
      const headers = { host: '127.0.0.1:12355' };

      expect((await route(new Request('http://127.0.0.1:12355/api/bootstrap', { headers }))).status).toBe(403);
      expect((await route(new Request('http://127.0.0.1:12355/api/bootstrap', {
        headers: { ...headers, 'X-Slides-Ticket': 'wrong-ticket' },
      }))).status).toBe(403);

      const first = await route(new Request('http://127.0.0.1:12355/api/bootstrap', {
        headers: { ...headers, 'X-Slides-Ticket': 'one-time-secret' },
      }));
      expect(first.status).toBe(200);
      const payload = await first.json() as { token: string; initialDeckId?: string };
      expect(typeof payload.token).toBe('string');
      expect(payload.initialDeckId).toBe('demo-id');

      const replay = await route(new Request('http://127.0.0.1:12355/api/bootstrap', {
        headers: { ...headers, 'X-Slides-Ticket': 'one-time-secret' },
      }));
      expect(replay.status).toBe(403);

      const reload = await route(new Request('http://127.0.0.1:12355/api/bootstrap', {
        headers: { ...headers, 'X-Slides-Token': payload.token },
      }));
      expect(reload.status).toBe(200);
      expect((await reload.json() as { initialDeckId?: string }).initialDeckId).toBeUndefined();

      const expiredRoute = privateRouter(12356, {
        requireTicket: true,
        launchTicket: 'expired-secret',
        ticketExpiresAt: Date.now() - 1,
      });
      expect((await expiredRoute(new Request('http://127.0.0.1:12356/api/bootstrap', {
        headers: { host: '127.0.0.1:12356', 'X-Slides-Ticket': 'expired-secret' },
      }))).status).toBe(403);
    } finally {
      if (prevLib === undefined) delete process.env.SLIDES_LIBRARY;
      else process.env.SLIDES_LIBRARY = prevLib;
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
