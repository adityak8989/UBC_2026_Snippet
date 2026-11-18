"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

// Connect button and wallet modal in the Snippet palette (blue primary).
const rainbowTheme = darkTheme({
  accentColor: "#2563eb",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
});

// Wallet state (wagmi), request caching (React Query), and the connect modal (RainbowKit)
// all live in the browser, so they are wrapped in this one client component.
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
