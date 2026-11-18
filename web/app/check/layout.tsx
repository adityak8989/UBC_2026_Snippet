import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check License · Snippet",
  description: "Check a video file against the clips licensed on Snippet. The file is fingerprinted in your browser and never uploaded.",
};

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
