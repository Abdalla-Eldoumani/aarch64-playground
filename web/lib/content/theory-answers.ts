/**
 * The one rule a typed theory answer is graded by, shared by the blanks and
 * prediction blocks and by the sheet that restores a checked answer on a later
 * visit, so a restored question is locked only when the same rule would still
 * pass it. Case and the spaces around the answer do not matter.
 */
export function typedAnswerIsRight(accepted: readonly string[], typed: string): boolean {
  const answer = typed.trim().toLowerCase();
  return accepted.some((candidate) => candidate.trim().toLowerCase() === answer);
}
