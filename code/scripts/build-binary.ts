import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, posix, relative } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const buildDir = join(root, 'build');
await mkdir(buildDir, { recursive: true });

const mimeMap: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

const distFiles: Record<string, { base64: string; mime: string }> = {};
async function collectDist(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectDist(full);
    } else if (entry.isFile()) {
      const rel = relative(distDir, full).split('\\').join('/');
      const ext = extname(entry.name).toLowerCase();
      distFiles[rel] = {
        base64: (await readFile(full)).toString('base64'),
        mime: mimeMap[ext] ?? 'application/octet-stream',
      };
    }
  }
}
await collectDist(distDir);

const [audienceAssetsRaw, featureTourMdx, leakmonShowcaseMdx, sampleSvg, exportCss, exportPlayerJs] = await Promise.all([
  readFile(join(buildDir, 'audience-assets.json'), 'utf8'),
  readFile(join(root, 'public', 'feature-tour.mdx'), 'utf8'),
  readFile(join(root, 'public', 'leakmon-showcase.mdx'), 'utf8'),
  readFile(join(root, 'public', 'sample-landscape.svg')),
  readFile(join(buildDir, 'export.css'), 'utf8'),
  readFile(join(buildDir, 'export-player.js'), 'utf8'),
]);

const entryFile = join(buildDir, '_standalone-entry.ts');
const bundlePayload = {
  distFiles,
  audienceAssets: JSON.parse(audienceAssetsRaw) as string[],
  featureTourMdx,
  leakmonShowcaseMdx,
  sampleLandscapeSvgBase64: sampleSvg.toString('base64'),
  exportCss,
  exportPlayerJs,
};

await writeFile(
  entryFile,
  `import { registerEmbeddedBundle } from '../src/runtime-assets';
import { runCli } from '../src/cli';

registerEmbeddedBundle(${JSON.stringify(bundlePayload)});
const result = await runCli(process.argv.slice(2));
if (result.exitCode !== undefined) process.exit(result.exitCode);
const shutdown = () => { result.stop?.(); process.exit(0); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
`,
  'utf8',
);

const outBinary = join(buildDir, process.platform === 'win32' ? 'slides.exe' : 'slides');
try {
  const proc = spawnSync(
    process.execPath,
    ['build', entryFile, '--compile', '--external', 'playwright-core', '--outfile', outBinary],
    { cwd: root, stdio: 'inherit' },
  );
  if (proc.status !== 0) {
    throw new Error(`bun build --compile failed with exit code ${proc.status}`);
  }
} finally {
  await rm(entryFile, { force: true });
}
console.log(`Standalone Slides binary: ${posix.normalize(relative(root, outBinary).split('\\').join('/'))}`);
