import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deckDirectory, featureToursRoot, hasSymlink, LibraryError, libraryRoot } from './library';
import { readBundledSampleSvg, readBundledTourAsset } from './runtime-assets';
import { assetMimeType, parseAssetReference, sampleImageReference } from './sample-image-reference';

async function bundledImage(): Promise<Buffer> {
  const bytes = await readBundledSampleSvg();
  if (!bytes) throw new LibraryError(500, 'Sample image is missing from the application');
  return bytes;
}

export async function ensureSampleImage(root = libraryRoot): Promise<Buffer> {
  const bytes = await bundledImage();
  const destination = join(root, sampleImageReference);
  await mkdir(join(root, 'assets'), { recursive: true });
  let sourcePath: string | null = null;
  for (const directory of ['public', 'dist']) {
    const candidate = join(process.cwd(), directory, 'sample-landscape.svg');
    try { await stat(candidate); sourcePath = candidate; break; } catch { /* fallback to embedded bytes */ }
  }
  try {
    if (sourcePath) await copyFile(sourcePath, destination, constants.COPYFILE_EXCL);
    else await writeFile(destination, bytes, { flag: 'wx' });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
  }
  const installed = await readFile(destination);
  if (!installed.equals(bytes)) throw new LibraryError(409, 'Sample image differs from the bundled asset; move it aside and restart the app');
  return installed;
}

export async function ensureBundledTourAsset(relAsset: string, toursRoot = featureToursRoot): Promise<void> {
  const bytes = await readBundledTourAsset(relAsset);
  if (!bytes) throw new LibraryError(500, `Bundled tour asset "${relAsset}" is missing from the application`);
  const destination = join(toursRoot, 'assets', ...relAsset.split('/'));
  await mkdir(join(toursRoot, 'assets'), { recursive: true });
  try {
    await writeFile(destination, bytes, { flag: 'wx' });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    const existing = await readFile(destination);
    if (!existing.equals(bytes) && !(await hasSymlink(destination))) {
      await writeFile(destination, bytes);
    }
  }
}

export async function sampleImageResponse(method: 'GET' | 'HEAD'): Promise<Response> {
  const image = await ensureSampleImage();
  return assetResponse({ bytes: new Uint8Array(image), mime: 'image/svg+xml' }, method);
}

export function assetResponse(asset: { bytes: Uint8Array<ArrayBuffer>; mime: string }, method: 'GET' | 'HEAD'): Response {
  return new Response(method === 'HEAD' ? null : asset.bytes, { headers: {
    'Content-Type': asset.mime,
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer'
  } });
}

export async function readDeckAsset(deckId: string, relPath: string, root = libraryRoot): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string } | null> {
  const normalized = parseAssetReference(`assets/${relPath}`);
  const mime = normalized ? assetMimeType(normalized) : null;
  if (!normalized || !mime) return null;
  const deckDir = await deckDirectory(deckId);
  const candidates = [join(deckDir, 'assets', ...normalized.split('/')), join(root, 'assets', ...normalized.split('/'))];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    let info;
    try { info = await stat(candidate); }
    catch (error) {
      if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) continue;
      throw error;
    }
    if (await hasSymlink(candidate)) throw new LibraryError(403, 'Image asset must not be a symlink');
    if (!info.isFile() || info.size > 10_000_000) throw new LibraryError(400, 'Image asset must be a file under 10 MB');
    return { bytes: new Uint8Array(await readFile(candidate)), mime };
  }
  return null;
}
