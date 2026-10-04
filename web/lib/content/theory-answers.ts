/**
 * Case and outer spaces do not count. The blanks, the predictions, and the
 * restore on a later visit all grade here, so a restored answer locks only
 * when it would still pass.
 */
export function typedAnswerIsRight(accepted: readonly string[], typed: string): boolean {
  const answer = typed.trim().toLowerCase();
  return accepted.some((candidate) => candidate.trim().toLowerCase() === answer);
}
