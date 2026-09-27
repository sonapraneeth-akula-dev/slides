export function validFontFamily(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 120 &&
    value.trim() === value && /^[\p{L}\p{M}\p{N} .,_'&()+-]+$/u.test(value);
}
