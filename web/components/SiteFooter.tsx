import { SNIPPET_LICENSES_ADDRESS } from "@/lib/arc";
import { EXPLORER_URL } from "@/lib/licenses";

export const REPO_URL = "https://github.com/adityak8989/UBC_2026_Snippet";

// Shown on every page: what this site is, and plain terms and privacy notes.
export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-8 text-xs text-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <p>
            <span className="font-semibold text-ink">Snippet is a UBC 2026 hackathon demo on Arc testnet.</span> It uses
            testnet USDC only, which has no real value. Purchases ask your wallet to approve the exact license price,
            never an unlimited amount.
          </p>
          <p>
            <span className="font-semibold text-ink">Terms:</span> provided as is for demonstration; licenses are test
            records and grant no commercial rights.{" "}
            <span className="font-semibold text-ink">Privacy:</span> we collect no personal data and use no tracking.
            Your wallet address and purchases are public on the Arc testnet blockchain.
          </p>
        </div>
        <nav className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href={`${EXPLORER_URL}/address/${SNIPPET_LICENSES_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:text-ink"
          >
            Contract on Arc explorer ↗
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="font-medium hover:text-ink">
            Source code on GitHub ↗
          </a>
          <a href="/.well-known/security.txt" className="font-medium hover:text-ink">
            Security contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
