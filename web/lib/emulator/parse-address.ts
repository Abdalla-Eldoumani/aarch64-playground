/**
 * Strict address parse shared by the memory panels: `0x`-prefixed hex or
 * bare decimal, nothing else. `parseInt(str, 16)` stops at the first bad
 * character, so a single slip inside a hex address ("0x0060O000" with a
 * capital O) silently truncated to 0x60 and relocated the window to an
 * address full of zeros.
 */
export function parseAddress(raw: string): number | null {
  const t = raw.trim();
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return null;
}
