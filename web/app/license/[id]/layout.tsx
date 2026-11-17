import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "License Certificate · Snippet",
  description: "A podcast clip license recorded on Arc testnet, verified live from the Snippet contract.",
};

export default function LicenseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
