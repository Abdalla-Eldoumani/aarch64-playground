import { SiteNav } from "@/components/chrome/SiteNav";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { InstallHint } from "@/components/chrome/InstallHint";
import { CropMarks } from "@/components/ui/CropMarks";
import { fetchStarCount } from "@/lib/content/github";

// The column carries its own min-h-dvh so the flex-1 main keeps the footer at
// the bottom of a short page whatever the body does. The playground sits
// outside this group and keeps its own flat layout.
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read once at build time and baked into the static page, so the nav's star
  // count costs the visitor nothing and renders null (icon only) whenever the
  // lookup fails. It refreshes on each deploy.
  const stars = await fetchStarCount();

  return (
    <div className="paper relative flex flex-col min-h-dvh">
      <CropMarks />
      <SiteNav variant="full" stars={stars} />
      {/* tabIndex -1 makes the landmark focusable, so the skip link moves
          the caret and not just the scroll position. */}
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <InstallHint />
    </div>
  );
}
