import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintDeck, runLintCli } from '../src/lint';

describe('deck lint engine and CLI', () => {
  test('passes bundled feature tour with zero diagnostics', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const exit = await runLintCli([join(process.cwd(), 'public', 'feature-tour.mdx')], {
      stdout: line => out.push(line),
      stderr: line => err.push(line),
    });
    expect(exit).toBe(0);
    expect(err).toEqual([]);
    expect(out[0]).toContain('OK');
  });

  test('reports empty slide, missing alt text, missing asset, and density warnings while exiting 0', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'slides-lint-warn-'));
    try {
      const denseBody = Array.from({ length: 20 }, (_, idx) => `- Bullet point ${idx + 1}`).join('\n');
      const deckPath = join(workspace, 'warnings.mdx');
      await writeFile(deckPath, `::slide{id="empty"}

::slide{id="blank-ok" layout="blank"}

::slide{id="images"}
# Images
![](assets/missing.png)

::slide{id="dense"}
# Dense
${denseBody}
`);
      const out: string[] = [];
      const err: string[] = [];
      const exit = await runLintCli(['--json', deckPath], {
        stdout: line => out.push(line),
        stderr: line => err.push(line),
      });
      expect(exit).toBe(0);
      expect(err).toEqual([]);
      const parsed = JSON.parse(out.join('\n')) as Array<{ diagnostics: Array<{ code: string; slideId?: string }> }>;
      const codes = parsed[0].diagnostics.map(diag => diag.code);
      expect(codes).toContain('EMPTY_SLIDE');
      expect(codes).toContain('IMAGE_ALT_MISSING');
      expect(codes).toContain('ASSET_MISSING');
      expect(codes).toContain('SLIDE_DENSE');
      expect(parsed[0].diagnostics.some(diag => diag.slideId === 'blank-ok')).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  test('reports malformed chart and Mermaid blocks as errors and enforces exit code precedence 2 > 3 > 1 > 0', async () => {
    const invalidFences = await lintDeck(`::slide{id="broken"}
# Broken fences
\`\`\`chart
{"type":"unknown","labels":[],"series":[]}
\`\`\`
\`\`\`mermaid
flowchart TD
  A --> B
  click A "https://evil.test"
\`\`\`
`);
    expect(invalidFences.compilation.deck).toBeNull();
    expect(invalidFences.diagnostics.map(diag => diag.code)).toEqual(['CHART_INVALID', 'MERMAID_INVALID']);

    const workspace = await mkdtemp(join(tmpdir(), 'slides-lint-codes-'));
    try {
      const errorDeck = join(workspace, 'error.mdx');
      const blockedDeck = join(workspace, 'blocked.mdx');
      const realDir = join(workspace, 'real');
      const symDir = join(workspace, 'sym');
      await mkdir(realDir);
      await writeFile(errorDeck, '::slide{id="dup"}\n# One\n::slide{id="dup"}\n# Two\n');
      await writeFile(blockedDeck, '::slide{id="remote"}\n# Remote\n![Pic](https://example.invalid/pic.png)\n');
      await writeFile(join(realDir, 'ok.mdx'), '::slide{id="one"}\n# Valid\n');
      await symlink(realDir, symDir, process.platform === 'win32' ? 'junction' : 'dir');
      const quiet = { stdout: () => {}, stderr: () => {} };

      expect(await runLintCli([errorDeck], quiet)).toBe(1);
      expect(await runLintCli([blockedDeck], quiet)).toBe(3);
      expect(await runLintCli([join(symDir, 'ok.mdx')], quiet)).toBe(3);
      expect(await runLintCli([errorDeck, blockedDeck], quiet)).toBe(3);
      expect(await runLintCli([blockedDeck, join(workspace, 'missing.mdx')], quiet)).toBe(2);
      expect(await runLintCli([], quiet)).toBe(2);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
