/**
 * Resolves once the page's web fonts have settled, or after `limitMs`,
 * whichever comes first. Never rejects, and resolves at once during SSR.
 *
 * The lazy surfaces await this beside their chunk import, so they mount with
 * the real faces already measured. A surface that mounts in the fallback face
 * and then takes the swap re-wraps the header band and the register chips and
 * moves the editor section with them, which the field recorded as a 0.34
 * layout shift on the playground; a swap that lands while the loading beat
 * is still up moves nothing. The limit keeps a slow font from holding the
 * editor hostage: past it the surface mounts in whatever face is there, the
 * behaviour it had before the wait.
 */
export function fontsSettled(limitMs = 3000): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
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
