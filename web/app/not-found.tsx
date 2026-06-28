import type { Metadata } from "next";
import { NotFound } from "@/components/NotFound";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "404",
  description: "The page you were looking for doesn't exist.",
};

export default function NotFoundPage() {
  return (
    <div className="flex flex-col min-h-dvh">
      <SiteNav variant="full" />
      <NotFound />
      <SiteFooter />
    </div>
  );
}
