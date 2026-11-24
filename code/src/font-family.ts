export const defaultSansFontStack =
  '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Ubuntu", "Cantarell", "Noto Sans", "Liberation Sans", system-ui, sans-serif';

export const defaultMonoFontStack =
  '"Cascadia Code PL", "Cascadia Code", "Cascadia Mono", "SF Mono", "JetBrains Mono", "Fira Code", "Ubuntu Mono", ui-monospace, "Consolas", "Menlo", "DejaVu Sans Mono", "Liberation Mono", monospace';

export function validFontFamily(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 &&
    value.trim() === value && /^[\p{L}\p{M}\p{N} .,_'&()+-]+$/u.test(value);
}
