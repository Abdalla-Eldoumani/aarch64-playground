/**
 * `0x` hex or plain decimal only. `parseInt(str, 16)` stops at the first bad
 * character, so "0x0060O000" (capital O) would quietly become 0x60.
 */
export function parseAddress(raw: string): number | null {
  const t = raw.trim();
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return null;
}
