import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface EmbeddedBundle {
  distFiles: Record<string, { base64: string; mime: string }>;
  audienceAssets: string[];
  featureTourMdx: string;
  leakmonShowcaseMdx?: string;
  sampleLandscapeSvgBase64: string;
  exportCss: string;
  exportPlayerJs: string;
}

let embeddedBundle: EmbeddedBundle | null = null;

export function registerEmbeddedBundle(bundle: EmbeddedBundle): void {
  embeddedBundle = bundle;
}

export function getEmbeddedBundle(): EmbeddedBundle | null {
  return embeddedBundle;
}

export async function readPublicDistAsset(asset: string): Promise<{ body: BodyInit; type: string } | null> {
  const diskPath = join(process.cwd(), 'dist', asset);
  const diskFile = Bun.file(diskPath);
  if (await diskFile.exists()) {
    return { body: diskFile, type: diskFile.type };
  }
  const embedded = embeddedBundle?.distFiles[asset];
  if (!embedded) return null;
  return { body: new Uint8Array(Buffer.from(embedded.base64, 'base64')), type: embedded.mime };
}

export async function hasUiAssets(): Promise<boolean> {
  if (await Bun.file(join(process.cwd(), 'dist', 'index.html')).exists()) return true;
  return Boolean(embeddedBundle?.distFiles['index.html']);
}

export async function readFeatureTourBundle(): Promise<string | null> {
  for (const candidate of [join(process.cwd(), 'public', 'feature-tour.mdx'), join(process.cwd(), 'dist', 'feature-tour.mdx')]) {
    const file = Bun.file(candidate);
    if (await file.exists()) return file.text();
  }
  return embeddedBundle?.featureTourMdx ?? null;
}

export async function readLeakMonShowcaseBundle(): Promise<string | null> {
  for (const candidate of [join(process.cwd(), 'public', 'leakmon-showcase.mdx'), join(process.cwd(), 'dist', 'leakmon-showcase.mdx')]) {
    const file = Bun.file(candidate);
    if (await file.exists()) return file.text();
  }
  return embeddedBundle?.leakmonShowcaseMdx ?? null;
}

export async function readBundledTourAsset(relAsset: string): Promise<Buffer | null> {
  for (const dir of ['public', 'dist']) {
    const path = join(process.cwd(), dir, 'assets', ...relAsset.split('/'));
    try { return await readFile(path); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  const embedded = embeddedBundle?.distFiles[`assets/${relAsset}`];
  return embedded ? Buffer.from(embedded.base64, 'base64') : null;
}

export async function readBundledSampleSvg(): Promise<Buffer | null> {
  for (const dir of ['public', 'dist']) {
    const path = join(process.cwd(), dir, 'sample-landscape.svg');
    try { return await readFile(path); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  return embeddedBundle ? Buffer.from(embeddedBundle.sampleLandscapeSvgBase64, 'base64') : null;
}

export function createAudienceAssetLookup(): (() => Set<string>) | null {
  const manifest = join(process.cwd(), 'build', 'audience-assets.json');
  if (existsSync(manifest)) {
    let cache = { mtime: -1, allowed: new Set<string>() };
    const lookup = () => {
      try {
        const mtime = statSync(manifest).mtimeMs;
        if (mtime !== cache.mtime) cache = { mtime, allowed: new Set(JSON.parse(readFileSync(manifest, 'utf8'))) };
      } catch { /* retain previous manifest during concurrent rebuild */ }
      return cache.allowed;
    };
    lookup();
    return lookup;
  }
  if (embeddedBundle) {
    const fixed = new Set(embeddedBundle.audienceAssets);
    return () => fixed;
  }
  return null;
}
