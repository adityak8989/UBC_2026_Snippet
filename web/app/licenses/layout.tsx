import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Licenses",
  description: "Every Snippet license your connected wallet owns on Arc testnet, with certificates and master downloads.",
};

export default function LicensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
