import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

// The content route group ((site) adds no URL segment) gives every content page
// the persistent full nav and footer in normal document flow. Its own min-h-dvh
// column holds the height context regardless of the body, and the flex-1 main
// pushes the footer to the bottom on short pages. Per-route pages own metadata.
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <SiteNav variant="full" />
      <main className="flex-1 bg-[var(--bg-base)]">{children}</main>
      <SiteFooter />
    </div>
  );
}
