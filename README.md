# Snippet

License 30-second moments from podcasts, paid in USDC on **Arc testnet**.

A buyer picks a clip and a use type (Editorial, Social, or Commercial) and pays in USDC. The `SnippetLicenses` contract records the license on-chain: clip, file hash, buyer, price, use type, and timestamp. It pays the rights holder, the clip's contributor, and the platform in the same transaction. A live "licenses sold" feed and an "Is this take cleared?" checker read those on-chain events through QuickNode Streams.

Hackathon project (UBC, Nov 2026). **Testnet only.** All demo clips come from our own recorded podcast.

**Live demo: https://snippet-gamma.vercel.app** (Arc testnet; contract [`0xfc6a…1fe20`](https://testnet.arcscan.app/address/0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20))

- Plan and status checklist: [docs/PLAN.md](docs/PLAN.md)
- How we work (branches, PRs, secrets): [CONTRIBUTING.md](CONTRIBUTING.md)

## Repo layout

| Folder | What's inside |
|---|---|
| `contracts/` | Foundry project: `src/SnippetLicenses.sol`, tests in `test/` |
| `web/` | Next.js app (TypeScript, App Router) with wagmi, viem, and RainbowKit; Arc testnet config in `web/lib/arc.ts` |
| `docs/` | Plan |

## Setup on a fresh laptop

### 1. Install the tools (once)
- **Git**: https://git-scm.com. On Windows this also installs **Git Bash**, which you'll use below.
- **Node.js 18 or newer** (LTS recommended): https://nodejs.org. Check with `node -v`.
- **Foundry** (for the contract):
  - **macOS / Linux:** `curl -L https://foundry.paradigm.xyz | bash`, then open a new terminal and run `foundryup`.
  - **Windows:** run the same two commands in **Git Bash**. Then add `C:\Users\<you>\.foundry\bin` to your user PATH (Start → "Edit environment variables for your account" → Path → New) and **restart VS Code** so its terminals pick up the change.
  - Check with `forge --version`.

### 2. Clone (with submodules)
The contract libraries (OpenZeppelin, forge-std) are git submodules, so clone with `--recurse-submodules`:

```
git clone --recurse-submodules https://github.com/adityak8989/UBC_2026_Snippet.git
cd UBC_2026_Snippet
```

If you already cloned without it, run `git submodule update --init --recursive`.

### 3. Contract: build and test
```
cd contracts
forge build
forge test
```
You should see all tests pass. Use `forge test -vvv` to see details when a test fails.

### 4. Web app: install, configure, run
```
cd web
npm install
cp .env.example .env
```
Open `web/.env` and fill in:
- `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`: an Arc testnet RPC URL (ask the team for the QuickNode endpoint, or use the public RPC from the [Arc docs](https://docs.arc.network)).
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional): enables phone wallets. Without it, browser-extension wallets like MetaMask still work.
- `NEXT_PUBLIC_SNIPPET_LICENSES_ADDRESS`: leave empty until the contract is deployed.

Then start the app:
```
npm run dev
```
Open http://localhost:3000.

### 5. Testnet wallet
- Use a **fresh testnet-only wallet**, never one that holds real funds.
- Add Arc testnet (chain ID `5042002`). The app prompts you to switch networks.
- Get testnet USDC from https://faucet.circle.com. On Arc, USDC also pays for gas.

## Deploying the web app
The site is the Vercel project `snippet` (team Snippet) with `web/` as its root. It isn't connected to GitHub, so pushes don't redeploy it. To deploy, run from `web/` (the first time, `npx vercel login`):
```
npx vercel@65.9.0 --scope snippet4 deploy --prod
```
Environment variables are set in the Vercel project, not uploaded: `web/.vercelignore` keeps `.env*` files out of every deploy.

## Notes
- **USDC decimals on Arc:** the native gas balance uses 18 decimals; the USDC ERC-20 interface (`0x3600000000000000000000000000000000000000`) uses 6. The contract and app use only the 6-decimal ERC-20 interface.
- **`npm audit` warnings:** you will see warnings about WalletConnect dependencies. The only fix npm offers is wagmi v3, which RainbowKit doesn't support yet, so we're staying on wagmi v2 for the hackathon.
- `web/package.json` pins `@coinbase/cdp-sdk` to 1.52.0 via `overrides`. Newer versions import optional packages that break the dev build.
- Never commit `.env` files or keys. See [CONTRIBUTING.md](CONTRIBUTING.md).
