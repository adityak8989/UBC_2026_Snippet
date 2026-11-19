import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a clip",
  description: "Propose a short clip for Snippet. We review every submission before it is listed on Arc testnet.",
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
