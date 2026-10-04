/**
 * Escape every regex metacharacter so text matches literally inside a
 * RegExp. RegExp.escape does the same, but only in browsers from 2025 on.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
