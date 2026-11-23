import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { deckDirectory, hasSymlink, LibraryError, libraryRoot } from './library';
import { assetMimeType, parseAssetReference, sampleImageReference } from './sample-image-reference';

async function bundledImage(): Promise<{ path: string; bytes: Buffer }> {
  for (const directory of ['public', 'dist']) {
    const path = join(process.cwd(), directory, 'sample-landscape.svg');
    try { return { path, bytes: await readFile(path) }; }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  throw new LibraryError(500, 'Sample image is missing from the application');
}

export async function ensureSampleImage(root = libraryRoot): Promise<Buffer> {
  const { path: source, bytes } = await bundledImage();
  const destination = join(root, sampleImageReference);
  await mkdir(join(root, 'assets'), { recursive: true });
  try { await copyFile(source, destination, constants.COPYFILE_EXCL); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
  }
  const installed = await readFile(destination);
  if (!installed.equals(bytes)) throw new LibraryError(409, 'Sample image differs from the bundled asset; move it aside and restart the app');
  return installed;
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
