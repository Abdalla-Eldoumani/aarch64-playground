import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { CropMarks } from "@/components/ui/CropMarks";
import { fetchStarCount } from "@/lib/content/github";

// The content route group ((site) adds no URL segment) gives every content page
// the persistent full nav and footer in normal document flow. Its own min-h-dvh
// column holds the height context regardless of the body, and the flex-1 main
// pushes the footer to the bottom on short pages. Per-route pages own metadata.
// Reading surfaces sit on the blueprint paper (.paper draws the 24px cell grid;
// self-disabling in high-contrast) with datasheet crop marks in the corners;
// the playground route keeps its own flat layout.
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side and revalidated hourly, so the nav's star count costs the
  // visitor nothing and renders null (icon only) whenever the lookup fails.
  const stars = await fetchStarCount();

  return (
    <div className="paper relative flex flex-col min-h-dvh">
      <CropMarks />
      <SiteNav variant="full" stars={stars} />
      {/* The root layout's skip link targets this id; tabIndex -1 makes the
          landmark itself focusable so the jump moves the caret, not just the
          scroll position. */}
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
