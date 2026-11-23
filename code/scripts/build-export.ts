import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'build');
await mkdir(outDir, { recursive: true });

const [appCss, hljsCss, katexRawCss] = await Promise.all([
  readFile(join(root, 'src', 'styles.css'), 'utf8'),
  readFile(join(root, 'node_modules', 'highlight.js', 'styles', 'github.css'), 'utf8'),
  readFile(join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), 'utf8'),
]);
const katexCss = katexRawCss.replace(/@font-face\{[^}]*\}/g, '');
await writeFile(join(outDir, 'export.css'), `${katexCss}\n${hljsCss}\n${appCss}\n`);

const built = await Bun.build({
  entrypoints: [join(root, 'src', 'export-player.ts')],
  target: 'browser',
  minify: true,
});
if (!built.success) {
  throw new Error(`Failed to bundle export-player.ts: ${built.logs.map(log => log.message).join('; ')}`);
}
const jsOutput = built.outputs.find(output => output.path.endsWith('.js'));
if (!jsOutput) throw new Error('Missing JS output from export-player build');
await writeFile(join(outDir, 'export-player.js'), await jsOutput.text());
