// Drops the errors a page served by local next start logs for Vercel's
// analytics scripts, which only Vercel's edge serves, and any favicon 404.
export function realErrors(errors) {
  return errors.filter((e) => !/favicon/i.test(e) && !/_vercel\/(insights|speed-insights)/i.test(e));
}
