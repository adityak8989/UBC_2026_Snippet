import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { arcTestnet } from "./arc";

// WalletConnect (phone wallets via QR code) needs a free project ID from https://cloud.reown.com.
// Without one we fall back to browser-extension wallets only (MetaMask, Rabby, ...).
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: projectId
        ? [metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet]
        : [injectedWallet],
    },
  ],
  { appName: "Snippet", projectId },
);

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: { [arcTestnet.id]: http() },
  ssr: true,
});
