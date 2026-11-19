# Snippet

License short moments from streams and podcasts, paid in USDC on **Arc testnet**.

A buyer picks a clip and a use type (Editorial, Social, or Commercial) and pays in USDC. The `SnippetLicenses` contract records the license on-chain: clip, file hash, buyer, price, use type, and timestamp. It pays the rights holder, the clip's contributor, and the platform in the same transaction. A live "licenses sold" feed and a "Check License" page read those on-chain events through QuickNode Streams.

Hackathon project (UBC, Nov 2026). **Testnet only.** The clips for sale are our teammate Riya's (SpaceLofi) own stream clips; the first three test clips are delisted.

In this testnet demo, a team-held wallet receives SpaceLofi’s creator share; in production, each creator connects their own wallet.

**Live demo: https://snippet-gamma.vercel.app** (Arc testnet; contract [`0xfc6a…1fe20`](https://testnet.arcscan.app/address/0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20))

**The official contract is `0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20`. The app must keep using it** (its license #1 and listed clips live there; don't point the site at a new deployment).

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

## How we use Arc

Every license is a transaction on **Arc testnet** (chain `5042002`) to one contract.

**Contract:** `SnippetLicenses` at [`0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20`](https://testnet.arcscan.app/address/0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20), with its source verified on the explorer. Source: [`contracts/src/SnippetLicenses.sol`](contracts/src/SnippetLicenses.sol).

**USDC is the gas token.** On Arc a buyer only ever holds dollars: the license price and the network fee are both paid in USDC. Fees are under 1¢ per transaction (about $0.007 to $0.009 for a purchase). The app pays through the 6 decimal USDC ERC-20 interface (`0x3600…0000`), never the 18 decimal native balance.

**Atomic split.** `buyLicense(clipId, useType)` records the license and pays every party in the same transaction. The contract never holds funds; it pulls USDC from the buyer straight to each payee. Example: an Editorial license on clip-7 ("Clipping on the Blockchain", $5, split 70/20/10) pays:

| Payee | Share | Amount |
|---|---|---|
| SpaceLofi (rights holder) | 70% | $3.50 |
| Esteban (producer, contributor) | 20% | $1.00 |
| Snippet (platform treasury) | 10% | $0.50 |

All three transfers happen in one transaction, or none do.

**File hash licenses.** Each clip is listed with the sha256 of its exact master file, and every `LicenseIssued` event and stored license carries that hash. A certificate proves which bytes were licensed, and `/check` matches a dropped file against those on-chain hashes. ElevenLabs transcripts add a second fingerprint for the licensed words.

**Rights aware tiers.** Prices are per clip and per use type (Editorial, Social, Commercial). A price of 0 means not for sale, and `buyLicense` reverts with `PriceNotSet`. Gameplay clips use this for Commercial, because the game footage belongs to the publisher. `npm run check-clips` enforces it before anything is listed.

**Foundry.** The contract is built and tested with Foundry: **27 tests**, including fuzzing of the split math, a reentrancy attack, zero price refusal, pause, and owner only admin. Deploy, list, update price and delist scripts all read the same `web/lib/clips.json` the site uses. Run `cd contracts && forge test`.

**Circle passkeys and Gas Station.** Besides browser wallets, a buyer can pay with a passkey (Face ID, Touch ID, or a device PIN). A Circle Modular Wallets smart account on Arc sends the USDC approve and `buyLicense` as one user operation, and Circle Gas Station sponsors the gas. Details in [Passkey checkout](#passkey-checkout-circle-modular-wallets--gas-station).

## How we use QuickNode

QuickNode does two jobs:
- **Streams (live sales):** every sale is pushed to us as it happens.
- **RPC (license verification):** what the site shows is checked against the contract.

```
Arc testnet ──► QuickNode Stream (Logs + filter) ──► POST /api/streams (signed) ──► Supabase license_events
     │                                                                                   │ Realtime
     │                         "Recently licensed", stats, "Licensed N times", /check list, My licenses ◄┘
     │
     └──► QuickNode RPC (server only) ──► /api/chain/license/[id], /api/chain/clips, certificate preview image
                                           certificate "Verified on Arc", Check License fingerprint match
```

### Streams: live sales

QuickNode Streams is Snippet's data source for sales. Every `LicenseIssued` event from the official contract flows through a Stream into our database. These all read from it:
- the homepage "Recently licensed" strip and its stats;
- "Licensed N times" on clip cards and clip pages;
- `/check`'s list of licenses sold;
- My licenses;
- each certificate's transaction link;
- **automated creator alerts** on Discord (below).

It covers wallet and passkey purchases alike.

**Stream configuration**
| Setting | Value |
|---|---|
| Network | Arc Testnet |
| Dataset | Logs |
| Start block | `72718270` (before license #1, so every license backfills) |
| End block | none (keep streaming) |
| Filter | [`quicknode/filter.js`](quicknode/filter.js): keeps only logs from `0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20` whose topic 0 is `LicenseIssued` (`0x019c42efa4a2ed077d7577fc401e2f0dfcf241fd5f419761e314dd00c73cfd8d`); returns `null` otherwise so empty batches aren't delivered |
| Destination | Webhook, `https://snippet-gamma.vercel.app/api/streams` |

**Webhook** ([`web/app/api/streams/route.ts`](web/app/api/streams/route.ts))
1. **Verifies the signature.** QuickNode sends `X-QN-Nonce`, `X-QN-Timestamp`, `X-QN-Signature`. We recompute `HMAC-SHA256(security token, nonce + timestamp + body)` and compare in constant time. A bad or missing signature gets 401, and without a configured token nothing is accepted.
2. **Decodes and stores.** It collects logs from the payload, keeps only `LicenseIssued` from the official contract, decodes them with viem, and upserts into `license_events` on `license_id`. Retries and backfills can't create duplicates.
3. **Lets QuickNode retry.** It answers 5xx when the database is unreachable, so QuickNode retries instead of dropping the sale.
4. **Sends automated creator alerts.** For each row that is genuinely new (insert with duplicates ignored, so retries and backfills never alert twice), it posts to a Discord channel, for example: "💸 SpaceLofi just earned $3.50 and Esteban (producer) earned $1.00 from Clipping on the Blockchain (Editorial license) · Verified on Arc", with links to the certificate and the transaction ([`web/lib/discord.ts`](web/lib/discord.ts)). It runs after the response (`after()`), so Discord can never slow down or fail the stream; if Discord errors or `DISCORD_WEBHOOK_URL` is missing, it's logged and QuickNode still gets a 2xx.

**Storage and reads.** [`supabase/license_events.sql`](supabase/license_events.sql) creates the table:
- **Row Level Security:** anyone can read, and only the server's secret key can write.
- **Realtime:** the homepage strip and the clip counts update within seconds of a sale (one shared subscription, [`web/lib/useSales.ts`](web/lib/useSales.ts)).
- **Fallback:** pages fall back to reading the contract directly if Supabase is down.
- **Verification:** a certificate only shows "Verified on Arc" after the chain agrees with the indexed row.

**Environment variables** (in `web/.env.local` and the Vercel project; names in [`web/.env.example`](web/.env.example)):
| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and webhook | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser (read only) | no |
| `SUPABASE_SECRET_KEY` | webhook only | **yes, never `NEXT_PUBLIC_`** |
| `QUICKNODE_STREAMS_SECURITY_TOKEN` | webhook only | **yes** |
| `QUICKNODE_ARC_RPC_URL` | server only (license verification, below) | **yes, never `NEXT_PUBLIC_`** |
| `DISCORD_WEBHOOK_URL` | webhook only (creator alerts; optional) | **yes, never `NEXT_PUBLIC_`** |

**Why it's core.** Reading every sale from the contract means one RPC call per license, and the public RPC refuses log searches over a few thousand blocks. Streams turns the chain into a push feed: each sale arrives once, is signed, and backfills from a fixed block. That makes the live feed, totals, and lookups instant and cheap. The contract stays the source of truth that every certificate is checked against.

### RPC: license verification

Reads that prove a license is real go through our QuickNode Arc testnet endpoint, on the server only ([`web/lib/serverChain.ts`](web/lib/serverChain.ts)):
- **Certificates:** `/license/[id]` reads `getLicense` through `/api/chain/license/[id]`. It shows "Verified on Arc" only when the contract agrees with the indexed row and the file hash is the clip's master.
- **Check License:** `/check` reads every clip's on-chain file hash through `/api/chain/clips` to match a dropped file's fingerprint.
- **Preview cards:** each certificate's share preview image (`opengraph-image`) reads the license the same way.

**Keeping the key private:**
- `QUICKNODE_ARC_RPC_URL` is never `NEXT_PUBLIC_`, never logged, and never reaches the browser.
- The module is `server-only`, so importing it from browser code fails the build.
- Responses carry `x-snippet-rpc: quicknode` or `public`, never the URL.

**Fallback:** if QuickNode is missing, slow (6 s timeout), or errors, the read falls back to the public Arc RPC (`https://rpc.testnet.arc.network`), so verification keeps working.

## Rights and adding a clip

Each clip in `web/lib/clips.json` has a `contentType`:
- **`original`**: the creator owns everything in the clip, so Editorial, Social, and Commercial are all for sale.
- **`gameplay`**: the clip names its `publisher` (for example Activision, Capcom, or Riot Games). The creator owns the commentary and play, but the game footage belongs to the publisher, so Commercial is not for sale (price 0, which the contract refuses).

`npm run check-clips` enforces both rules. The clip page explains them in a "Rights" box, and each card carries an "Original" or "Gameplay" tag.

**Adding a clip.** Put the raw recording in `web/incoming/` (gitignored), then from `web/`:
```
npm run add-clip -- --file incoming/<take>.mp4 --title "<title>" --show "<show>" --description "<one line>"   --content-type original --prices 5,15,50 --split 7000,2000,1000 --contributor-name "<name for the 20% share>"
```
It copies the master byte for byte to `public/clips/clipN.mp4`, makes the preview and poster with ffmpeg, adds the entry to `clips.json`, transcribes the clip with ElevenLabs, and runs `check-clips`. Add `--dry-run` to see the entry without writing anything. For gameplay, use `--content-type gameplay --publisher "<publisher>" --prices 5,15,0`.

Then list the clip on-chain from `contracts/`, as the owner. `ListClips` skips clips that are already listed. `CONTRIBUTOR_ADDRESS` is used only for clips with a contributor share:
```
export SNIPPET_LICENSES_ADDRESS=0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20
export RIGHTS_HOLDER_ADDRESS=<rights holder wallet>
export CONTRIBUTOR_ADDRESS=<contributor wallet>
forge script script/ListClips.s.sol:ListClips --rpc-url https://rpc.testnet.arc.network   --account <keystore> --sender <owner address> --broadcast
cd ../web && npm run verify-onchain
```
A clip's rights holder and contributor can't be changed after it's listed. Check both addresses before broadcasting.

## Passkey checkout (Circle Modular Wallets + Gas Station)

There are two ways to buy on a clip page: a browser wallet (MetaMask and others), or **Buy with passkey (no wallet needed)**.

- **Account:** a passkey (Face ID, Touch ID, or a device PIN) owns a Circle smart account on Arc testnet, created with `@circle-fin/modular-wallets-core` and viem account abstraction. The smart account's address is the license holder on chain.
- **One confirmation:** the USDC approve (exact price) and `buyLicense` go in one user operation, so one passkey confirmation buys the license.
- **Gas:** Circle Gas Station sponsors it (`paymaster: true`; testnet is sponsored automatically). If sponsorship is refused, the account pays gas in USDC instead.
- **Funding:** the account only needs USDC for the price. When it has too little, the panel shows its address with a copy button and a faucet link.
- **After purchase:** the receipt, certificate, live feed (QuickNode Streams) and My licenses work the same as for wallet purchases. With no wallet connected, My licenses shows the passkey account's licenses.
- **Storage:** only the passkey's public data (credential id, public key, username) is kept in the browser. The private key never leaves the device.

Code: [`web/lib/passkey.ts`](web/lib/passkey.ts) and [`web/components/PasskeyCheckout.tsx`](web/components/PasskeyCheckout.tsx).

**Config:** `NEXT_PUBLIC_CIRCLE_CLIENT_KEY` and `NEXT_PUBLIC_CIRCLE_CLIENT_URL` (in `web/.env.local` and the Vercel project; both are public client values). Passkeys only work on the passkey domain set in the Circle Console (Wallets → Modular Wallets → Passkey): `snippet-gamma.vercel.app` in production and `localhost` for development. Preview URLs won't work.

**Tested:** license #6 was bought this way on Arc testnet, with gas sponsored by Circle's paymaster. The smart account paid exactly the $5 price and nothing for gas.

## How we use ElevenLabs

Every clip's sound is transcribed with **ElevenLabs Speech to Text** (`scribe_v2`, word-level timestamps). The transcript drives three features:
- **Synced captions** on the clip page: each word lights up as it's spoken, with a **Transcript** toggle where clicking a word jumps there.
- **"Search what's said"** on the homepage: type a quote and jump to that exact moment in the clip.
- **"Licensed words"** on each license certificate: the transcript of the licensed master, with its SHA256.

[`web/scripts/transcribe.mjs`](web/scripts/transcribe.mjs) sends the clip's **original master**, after checking its sha256 against `fileHash`, and saves `web/lib/transcripts/<clip-id>.json`: text, language, and each word or audio event (`[laughs]`) with start and end times. It also regenerates `manifest.ts` with each transcript's sha256. Clips with no speech show no captions. Clips with no audio track are skipped.

```
cd web
npm run transcribe -- clip-4 clip-6   # or --all
npm run check-clips                   # transcript matches its master and its hash
```
It reads `ELEVENLABS_API_KEY` from `web/.env.local`, and only on your laptop. The site never calls ElevenLabs.

## Notes
- **USDC decimals on Arc:** the native gas balance uses 18 decimals; the USDC ERC-20 interface (`0x3600000000000000000000000000000000000000`) uses 6. The contract and app use only the 6-decimal ERC-20 interface.
- **`npm audit` warnings:** you will see warnings about WalletConnect dependencies. The only fix npm offers is wagmi v3, which RainbowKit doesn't support yet, so we're staying on wagmi v2 for the hackathon.
- `web/package.json` pins `@coinbase/cdp-sdk` to 1.52.0 via `overrides`. Newer versions import optional packages that break the dev build.
- Never commit `.env` files or keys. See [CONTRIBUTING.md](CONTRIBUTING.md).
