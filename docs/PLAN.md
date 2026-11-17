# Snippet: Hackathon MVP Plan

**Goal:** a demo where a buyer browses 30-second clips from our own podcast, pays in USDC on Arc testnet, and gets a license recorded on-chain plus the file. Anyone can see a live "licenses sold" feed and check whether a take is cleared.

- **Deadline:** Fri Nov 20, 12:00 CST. Feature-complete target: **Wed Nov 18, night**.
- **Tracks:** Consumer Apps (main) · Best use of Arc · QuickNode Streams bounty.
- **Scope rule:** build only what the demo needs, without making choices that block a later pilot (see §6).

## 1. Demo scope

| In | Out (for now) |
|---|---|
| A handful of 30 s clips from **our own** recorded podcast | Third-party content, rights-holder onboarding/verification |
| Fixed price per clip × use type (Editorial / Social / Commercial) | Custom terms, exclusivity, expiry, refunds |
| Pay in testnet USDC on Arc, license recorded on-chain | Fiat checkout, mainnet |
| Revenue split credited to rights holder / contributor / platform in the same tx | Withdraw flows, disputes UI |
| Platform hosts the clip files (off-chain), download for license holders | Hosting anyone else's media |
| Live "licenses sold" feed + "Is this take cleared?" checker via **QuickNode Streams** | Full indexer/reconciler |

We hold the rights to all demo content, so the platform operator lists clips itself and acts as the rights holder. The contributor role is a teammate credited on specific clips.

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
| App | Next.js (App Router) + TypeScript, deployed on Vercel | One repo, one deploy. Deploy early: Streams needs a public webhook URL. |
| Wallet | wagmi + viem + RainbowKit, Arc testnet defined as a custom chain | Buyers need only USDC, because on Arc USDC is also the gas token. |
| Contract | Solidity + Foundry + OpenZeppelin (`Ownable`, `Pausable`, `ReentrancyGuard`, `SafeERC20`) | One contract. |
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
- `clips`: id, `clip_id_bytes32`, title, show/episode, start–end in the source episode, description, contributor name, `file_path`, `file_hash`, preview URL, prices (mirrors the chain)
- `license_events`: tx hash, log index (unique together), block, license fields from the event, `received_at`
- Clip files: a private bucket. The preview is a public, low-bitrate copy. The original master is served via a short-lived signed URL.

**`fileHash` is the link** between the file on our server and the on-chain license.

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
| `/` Marketplace | Clip cards (preview, title, contributor credit, prices) + **live "licenses sold" ticker** | `GET /api/clips`, `GET /api/feed` (poll every 3 s) |
| `/clips/[id]` | Preview player, split breakdown, use-type picker, **Buy** (connect → approve → buy, with pending/confirmed/failed states) | `GET /api/clips/[id]` |
| `/licenses` | The connected wallet's licenses with an Arc explorer link and a **Download** button | `GET /api/licenses?buyer=`, `POST /api/download` (signed message from wallet → checks `license_events` → returns signed URL) |
| `/check` **Is this take cleared?** | Drop a file (hashed in the browser with sha256) or pick a clip, optionally enter a wallet address → "Cleared for Social use by 0xab…12 on Nov 18 (tx)" or "No license found" | `GET /api/check?fileHash=&buyer=` (reads `license_events`) |

The checker matches **exact files only**: a re-encoded or edited file won't match. Say this on the page.

The contract's own `getLicense` is a backup source if the Stream is down during the demo.

## 6. Build order (3 people, finish Wed night)

Roles: **A** = contract and chain · **B** = frontend · **C** = backend, Streams, and storage.

| When | A (contract) | B (frontend) | C (backend/Streams) |
|---|---|---|---|
| **Mon night** | Foundry scaffold, contract + tests | Next.js scaffold, Arc chain config in wagmi, page shells | Supabase project + tables + bucket; cut 3–5 clips, compute sha256, upload |
| **Tue** | Deploy to Arc testnet, verify, list clips via Foundry script; export ABI + address to `packages/shared` or `src/lib/contract.ts` | Marketplace + clip page + buy flow wired to contract | Deploy to Vercel; create Stream + `/api/streams` webhook; `/api/feed`, `/api/clips` |
| **Wed** | End-to-end buys with 2–3 wallets; edge cases (insufficient USDC, paused) | `/licenses` + download, `/check` page, tx states, polish | `/api/download` (wallet-signed request), `/api/check`; backfill check |
| **Wed night** | **Feature freeze.** Full demo run on the deployed site. | | |
| **Thu** | Bug fixes, demo video, README, submission text per track | | |
| **Fri ≤ 11:00** | Submit (1 h buffer) | | |

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
