export const layouts = [
  'title-content', 'two-columns', 'three-columns', 'picture-text', 'blank',
  'title-image-left', 'title-image-right', 'image-full'
] as const;

export const metadataPositions = [
  'TopLeft', 'TopCenter', 'TopRight', 'BottomLeft', 'BottomCenter', 'BottomRight'
] as const;
export type MetadataKey = `metadata${typeof metadataPositions[number]}`;
export const metadataValues = ['none', 'slideNumber', 'deckTitle', 'slideTitle', 'footer', 'logo'] as const;
