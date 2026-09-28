import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';

test('an occupied requested UI port fails before starting the API', async () => {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('No test port available');
    const child = spawn(process.execPath, ['./scripts/dev.ts'], {
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, SLIDES_DEV_PORT: String(address.port) },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    expect(code).toBe(1);
    expect(stderr).toContain(`Development UI port ${address.port} is already in use.`);
    expect(stdout).not.toContain('Local Slides:');
  } finally {
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  }
});
