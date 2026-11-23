export const sampleImageReference = 'assets/sample-landscape.svg';
export const sampleImageUrl = '/api/sample-image';

const assetMimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export function parseAssetReference(src: string): string | null {
  if (typeof src !== 'string' || !src.startsWith('assets/') || src.length > 240) return null;
  const rel = src.slice('assets/'.length);
  const parts = rel.split('/');
  if (!parts.length || parts.length > 3) return null;
  if (parts.some(part => !part || part === '.' || part === '..' || !/^[\w][\w.-]*$/.test(part))) return null;
  return assetMimeType(rel) ? rel : null;
}

export function assetMimeType(relPath: string): string | null {
  const dot = relPath.lastIndexOf('.');
  if (dot <= 0) return null;
  return assetMimeTypes[relPath.slice(dot).toLowerCase()] ?? null;
}
