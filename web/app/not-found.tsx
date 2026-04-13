import type { Metadata } from "next";
import { NotFound } from "@/components/NotFound";

export const metadata: Metadata = {
  title: "404 — aarch64 playground",
  description: "The page you were looking for doesn't exist.",
};

export default function NotFoundPage() {
  return <NotFound />;
}
