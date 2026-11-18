import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "License Certificate",
  description: "A clip license recorded on Arc testnet by the Snippet hackathon demo, checked live against the contract.",
};

export default function LicenseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
