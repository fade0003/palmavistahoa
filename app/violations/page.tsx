import type { Metadata, Viewport } from "next";
import ViolationsMap from "./ViolationsMap";

export const metadata: Metadata = {
  title: "Violations map — Palma Vista HOA",
  description: "Board map of open violations and balances for Palma Vista.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function ViolationsPage() {
  return <ViolationsMap />;
}
