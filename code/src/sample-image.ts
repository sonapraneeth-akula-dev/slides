import { constants } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LibraryError, libraryRoot } from './library';
import { sampleImageReference } from './sample-image-reference';

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
  return new Response(method === 'HEAD' ? null : new Uint8Array(image), { headers: {
    'Content-Type': 'image/svg+xml',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer'
  } });
}
