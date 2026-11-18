import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { SiteFooter } from "@/components/SiteFooter";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = "https://snippet-gamma.vercel.app";
const DESCRIPTION =
  "Snippet is a UBC 2026 hackathon demo on Arc testnet: license 30 second clips with testnet USDC, and the creator and everyone in the clip are paid in the same transaction. Exact amount approvals only; no real funds.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Snippet · Clip licensing demo on Arc testnet", template: "%s · Snippet" },
  description: DESCRIPTION,
  applicationName: "Snippet",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Snippet",
    title: "Snippet · Clip licensing demo on Arc testnet",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Snippet · Clip licensing demo on Arc testnet",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1115",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <Providers>{children}</Providers>
        <SiteFooter />
      </body>
    </html>
  );
}
