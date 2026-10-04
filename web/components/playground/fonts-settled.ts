/**
 * Resolves once the web fonts settle or after `limitMs`, whichever is first;
 * never rejects, and resolves at once on the server. The lazy surfaces wait
 * for it so a font swap cannot move them after they mount, and the limit
 * keeps a slow font from holding the editor back.
 */
export function fontsSettled(limitMs = 3000): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, limitMs);
    document.fonts.ready.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}
