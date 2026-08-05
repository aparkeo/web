/**
 * Interpolación mínima para los diccionarios: sustituye placeholders
 * `{nombre}` por valores. Un placeholder sin valor se deja literal (fallo
 * visible en desarrollo en lugar de texto tragado).
 */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
