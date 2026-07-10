import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { CropMarks } from "@/components/CropMarks";

// The content route group ((site) adds no URL segment) gives every content page
// the persistent full nav and footer in normal document flow. Its own min-h-dvh
// column holds the height context regardless of the body, and the flex-1 main
// pushes the footer to the bottom on short pages. Per-route pages own metadata.
// Reading surfaces sit on the blueprint paper (.paper draws the 24px cell grid;
// self-disabling in high-contrast) with datasheet crop marks in the corners;
// the playground route keeps its own flat layout.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="paper relative flex flex-col min-h-dvh">
      <CropMarks />
      <SiteNav variant="full" />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
