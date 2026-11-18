# Snippet

License short moments from streams and podcasts, paid in USDC on **Arc testnet**.

A buyer picks a clip and a use type (Editorial, Social, or Commercial) and pays in USDC. The `SnippetLicenses` contract records the license on-chain: clip, file hash, buyer, price, use type, and timestamp. It pays the rights holder, the clip's contributor, and the platform in the same transaction. A live "licenses sold" feed and a "Check License" page read those on-chain events through QuickNode Streams.

Hackathon project (UBC, Nov 2026). **Testnet only.** The clips for sale are our teammate Riya's (SpaceLofi) own stream clips; the first three test clips are delisted.

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

## How we use QuickNode Streams

QuickNode Streams is Snippet's data source for sales. Every `LicenseIssued` event from the official contract flows through a Stream into our database. The live "Licenses sold" feed, the stats, `/check`'s "licenses sold" list, and each certificate's transaction link all read from that.

```
Arc testnet ──► QuickNode Stream (Logs dataset + filter) ──► POST /api/streams (signed) ──► Supabase license_events
                                                                                              │
                         home feed + stats (Realtime) ◄──────── /check ◄──────── /license/[id] ◄┘
```

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

**Storage and reads.** [`supabase/license_events.sql`](supabase/license_events.sql) creates the table:
- **Row Level Security:** anyone can read, and only the server's secret key can write.
- **Realtime:** the home feed updates within seconds of a sale.
- **Fallback:** pages fall back to reading the contract directly if Supabase is down.
- **Verification:** a certificate only shows "Verified on Arc" after the chain agrees with the indexed row.

**Environment variables** (in `web/.env.local` and the Vercel project; names in [`web/.env.example`](web/.env.example)):
| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and webhook | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser (read only) | no |
| `SUPABASE_SECRET_KEY` | webhook only | **yes, never `NEXT_PUBLIC_`** |
| `QUICKNODE_STREAMS_SECURITY_TOKEN` | webhook only | **yes** |

**Why it's core.** Reading every sale from the contract means one RPC call per license, and the public RPC refuses log searches over a few thousand blocks. Streams turns the chain into a push feed: each sale arrives once, is signed, and backfills from a fixed block. That makes the live feed, totals, and lookups instant and cheap. The contract stays the source of truth that every certificate is checked against.

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
