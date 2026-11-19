import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator",
  description: "A Snippet creator: their clips, what they have earned, and their best seller, live from Arc testnet.",
};

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
