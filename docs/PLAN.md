# Snippet: Hackathon MVP Plan

**Goal:** a demo where a buyer browses 30-second clips from our own podcast, pays in USDC on Arc testnet, and gets a license recorded on-chain plus the file. Anyone can see a live "licenses sold" feed and check whether a take is cleared.

- **Deadline:** Fri Nov 20, 12:00 CST (we submit by 11:00). **Feature freeze: Wed Nov 18, night.**
- **Tracks:** Consumer Apps (main) · Best use of Arc · QuickNode Streams bounty.
- **Scope rule:** build only what the demo needs, without making choices that block a later pilot (see §7).

## Status

Update this list in the same commit that finishes each item.

**Mon: setup**
- [x] Plan (this file)
- [x] CONTRIBUTING.md
- [x] Toolchain check (Node 18+, npm, Foundry)
- [x] Scaffold `/contracts` (Foundry + OpenZeppelin) and `/web` (Next.js + wagmi + viem + RainbowKit, Arc testnet chain)
- [x] `SnippetLicenses` contract + Foundry tests passing (26 tests incl. fuzz + reentrancy)
- [ ] README with fresh-laptop setup steps

**Tue: chain + buy flow**
- [ ] Contract deployed to Arc testnet and verified on the explorer
- [ ] 3 clips listed on-chain (Foundry script)
- [ ] Clip page with buy flow (approve → buyLicense, with pending/confirmed/failed states)
- [ ] Site deployed on Vercel

**Wed: data + feed**
- [ ] Supabase tables + private storage bucket, 3 clip files uploaded with sha256 hashes
- [ ] QuickNode Stream → `/api/streams` webhook → `license_events`
- [ ] Live "licenses sold" feed on `/`
- [ ] `/check` "Is this take cleared?" page
- [ ] `/licenses` page with downloads
- [ ] Feature freeze + full demo run on the deployed site

**Thu–Fri: ship**
- [ ] 3 demo clips recorded and cut (Riya, Aditya)
- [ ] Bug fixes from review
- [ ] Demo video
- [ ] Final README + Devpost text
- [ ] Submitted (by Fri 11:00 CST)

## Team

| Who | Role |
|---|---|
| **Esteban** | Main builder: contract, web app, backend, deployment. Commits to `main`. |
| **Riya, Aditya** | Review and test each piece as it lands; contribute fixes and improvements through pull requests; record and cut the demo podcast clips; make the demo video; write the Devpost text. |

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the branch and PR workflow.

## 1. Demo scope

| In | Out (for now) |
|---|---|
| **3** 30-second clips from **our own** recorded podcast | Third-party content, rights-holder onboarding/verification |
| **One price per use type**, the same for every clip (Editorial / Social / Commercial) | Per-clip pricing, custom terms, exclusivity, expiry, refunds |
| Pay in testnet USDC on Arc, license recorded on-chain | Fiat checkout, mainnet |
| Revenue split paid to rights holder / contributor / platform in the same tx | Withdraw flows, disputes UI |
| **No login: the wallet is the account** | Email accounts, profiles |
| Platform hosts the clip files (off-chain); download only if the connected wallet owns a license | Hosting anyone else's media |
| Live "licenses sold" feed + "Is this take cleared?" checker via **QuickNode Streams** | Full indexer/reconciler |

We hold the rights to all demo content. The platform operator lists clips itself and acts as the rights holder. The contributor role is a teammate credited on specific clips.

## 2. Architecture

```
            ┌─────────────── Next.js app (Vercel) ───────────────┐
 Browser ── │ pages + wagmi/viem wallet  │  API routes            │
  (wallet)  └──────────┬─────────────────┴───────┬───────────────┘
     │ buyLicense tx   │ read catalog / events   │ signed download URL
     ▼                 ▼                         ▼
 Arc testnet ──► SnippetLicenses contract     Supabase: Postgres (clips, license_events)
 (chain 5042002)       │ LicenseIssued                + Storage (clip files, private bucket)
                       ▼                         ▲
              QuickNode Streams (Arc testnet logs, filtered to our contract)
                       └──── webhook POST /api/streams ──┘
```

| Piece | Choice | Notes |
|---|---|---|
| App | Next.js (App Router) + TypeScript in `/web`, deployed on Vercel | Deploy early (Tue): Streams needs a public webhook URL. |
| Wallet | wagmi + viem + RainbowKit, Arc testnet as a custom chain | Buyers need only USDC, because on Arc USDC is also the gas token. |
| Contract | Solidity + Foundry + OpenZeppelin in `/contracts` (`Ownable`, `Pausable`, `ReentrancyGuard`, `SafeERC20`) | One contract. |
| Data/files | Supabase (Postgres + private Storage bucket) | Catalog metadata, Streams event rows, clip files. |
| Events | **QuickNode Streams** → webhook → `license_events` table | Both the live feed and the checker read this table. |
| RPC | QuickNode Arc testnet endpoint | Same account as Streams. |

### Arc specifics (verify against the [Arc docs](https://docs.arc.network/arc/references/contract-addresses) before deploying)
- Chain ID `5042002`. Get testnet USDC from `faucet.circle.com`.
- The USDC ERC-20 interface is at `0x3600000000000000000000000000000000000000` and uses **6 decimals**.
- The **native** gas balance uses **18 decimals**. Never mix the two. The contract and UI use the ERC-20 interface (6 decimals) exclusively.
- A buyer makes 2 transactions: `approve(contract, price)`, then `buyLicense`. Gas for both is paid in USDC, so the "just dollars" UX is a strong point for the Arc track.

## 3. Data: on-chain vs off-chain

**On-chain (per license):**
- `licenseId`
- `clipId`
- `fileHash`: sha256 of the exact file served
- `buyer`
- `price`
- `useType`
- `timestamp`
- the split: rights-holder, contributor, and platform amounts

Nothing else goes on-chain: no personal data, no media.

**Off-chain (Supabase):**
- `clips`: id, `clip_id_bytes32`, title, show/episode, start–end in the source episode, description, contributor name, `file_path`, `file_hash`, preview URL
- `license_events`: tx hash, log index (unique together), block, license fields from the event, `received_at`
- Clip files: a private bucket. The preview is a public, low-bitrate copy. The original master is served via a short-lived signed URL.

**`fileHash` is the link** between the file on our server and the on-chain license.

**Prices:** the contract stores prices per clip, which keeps a later pilot open. For the demo, all 3 clips are listed with the same three prices.

## 4. Contract: `SnippetLicenses`

The contract **never holds funds**. `buyLicense` pulls USDC from the buyer directly to each payee. That means no balances, no withdraw function, and no custody.

| Function | Who | What it does |
|---|---|---|
| `constructor(usdc, treasury, owner)` | deploy | Sets the token (immutable) and the platform treasury. |
| `listClip(clipId, fileHash, rightsHolder, contributor, rhBps, contribBps, platformBps, prices[3])` | owner | Registers a clip. Requires bps to sum to 10000; `contributor == 0` ⇒ `contribBps == 0`; clip not already listed. |
| `updateClip(clipId, prices[3], active)` | owner | Changes prices or delists the clip. Licenses already sold are unaffected. |
| `buyLicense(clipId, useType) → licenseId` | anyone | **Checks** not paused, clip active, price > 0. **Effects** increments `licenseId`, stores the `License`, emits `LicenseIssued`. **Interactions** three `safeTransferFrom(buyer → payee)` calls; the platform payee gets the rounding remainder. `nonReentrant`. |
| `getLicense(licenseId)` / `getClip(clipId)` | view | For the certificate page and for debugging. |
| `pause()` / `unpause()` | owner | Emergency stop for `buyLicense`. |

`useType`: `0 = Editorial, 1 = Social, 2 = Commercial`. Amounts are USDC in 6-decimal units.

**Events:**
- `ClipListed(clipId indexed, fileHash, rightsHolder, contributor, rhBps, contribBps, platformBps, prices)`
- `ClipUpdated(clipId indexed, prices, active)`
- `LicenseIssued(licenseId indexed, clipId indexed, buyer indexed, fileHash, useType, price, rhAmount, contribAmount, platformAmount, timestamp)`

**Foundry tests:**
- happy path: exact split amounts, and the event emits the correct args
- reverts: unlisted or inactive clip, paused, insufficient allowance, bad bps
- fuzz: price × bps, checking that the three amounts sum to the price
- `onlyOwner` on admin functions

## 5. QuickNode Streams, pages, and API

**Stream:**
- **Dataset:** Arc testnet logs.
- **Filter function:** keep logs where `address == SnippetLicenses` and `topic0 ∈ {LicenseIssued, ClipListed}`.
- **Decoding:** decode in the filter function if practical, otherwise in the webhook.
- **Destination:** webhook → `POST /api/streams`. The handler checks the security token header, decodes, and upserts on `(tx_hash, log_index)` so duplicates are harmless.
- **Start block:** the contract deploy block, so the feed backfills on its own.

| Page | What it shows / does | API |
|---|---|---|
| `/` Marketplace | 3 clip cards (preview, title, contributor credit, prices) + **live "licenses sold" ticker** | `GET /api/clips`, `GET /api/feed` (poll every 3 s) |
| `/clips/[id]` | Preview player, split breakdown, use-type picker, **Buy** (connect → approve → buy, with pending/confirmed/failed states) | `GET /api/clips/[id]` |
| `/licenses` | The connected wallet's licenses with an Arc explorer link and a **Download** button | `GET /api/licenses?buyer=`, `POST /api/download` |
| `/check` **Is this take cleared?** | Drop a file (hashed in the browser with sha256) or pick a clip, optionally enter a wallet address → "Cleared for Social use by 0xab…12 on Nov 18 (tx)" or "No license found" | `GET /api/check?fileHash=&buyer=` (reads `license_events`) |

**Download gate (no login):** the server checks only one thing: does the connected wallet own a license for this clip in `license_events`? The wallet signs a short message, which is free and costs no gas, so the server knows the request really comes from that wallet. Without the signature, anyone could paste a buyer's address. If the check passes, the server returns a short-lived signed URL.

The checker matches **exact files only**: a re-encoded or edited file won't match. Say this on the page.

The contract's own `getLicense` is a backup source if the Stream is down during the demo.

## 6. Schedule

| When | Esteban (build) | Riya, Aditya (review, test, content) |
|---|---|---|
| **Mon night** | Setup, scaffold `/contracts` + `/web`, contract with tests | Clone repo, follow README setup, review contract PR/commit; plan podcast recording |
| **Tue** | Deploy contract to Arc testnet, list 3 clips, clip page with buy flow, site on Vercel | Test buy flow with their own testnet wallets; record + cut the 3 clips |
| **Wed** | Supabase + QuickNode Streams webhook, live feed, `/check`, `/licenses` with downloads. **Feature freeze Wed night.** | Test each feature as it lands, file Issues, small fix PRs |
| **Thu** | Bug fixes, final README | Demo video, Devpost text |
| **Fri** | Submit by **11:00 CST** | Final check of the submission |

**Definition of done:**
1. A fresh wallet with faucet USDC buys a clip on the deployed site.
2. The split lands in three wallets, visible on the explorer.
3. The sale appears in the live feed within seconds, via Streams.
4. The buyer downloads the file.
5. `/check` with that file reports it as cleared.

## 7. Before a real launch (not in this build)
- **Rights verification:** third-party content needs a rights-holder claim + review + attestation flow. The platform can record claims; it cannot verify copyright.
- **Link plus license instead of hosting:** a real launch should probably link to the source and license the use, rather than host files. Hosting third-party media without explicit permission is the biggest legal risk.
- **Rights-holder signed offers:** rights holders sign offers (EIP-712) and the contract verifies them, instead of the operator listing clips.
- **Contract changes:**
  - license expiry
  - a dispute/suspension status on licenses
  - pull-based payouts, so a blocked payee can't block a sale
  - multisig admin
- **Launch gates:** legal review of license terms, takedown process, and payments regulation; a contract audit before mainnet.
