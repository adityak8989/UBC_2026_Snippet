# Snippet: Plan (2-minute read)

**What we're building:** a marketplace where anyone can buy a license to use a 30-second podcast moment, paying in USDC on Arc testnet, with the license and the revenue split recorded on-chain.

Deadline: **Fri Nov 20, submit by 11:00 CST**. Feature freeze: **Wed night**. Details: [SPEC.md](SPEC.md).

## Who's who in the product

| Role | Who they are | Example: a 10 USDC Social license |
|---|---|---|
| **Rights holder** | Owns the podcast and allows its moments to be licensed. For the demo, that's us. | gets **70%** = 7 USDC |
| **Contributor** | The clipper who found the moment in the full episode and edited it into a 30-second clip | gets **20%** = 2 USDC |
| **Buyer** | Pays to use the clip for one use type: Editorial, Social, or Commercial | pays 10 USDC, gets a license + the file |
| **Platform** | Snippet: runs the marketplace | gets **10%** = 1 USDC, plus any rounding remainder |

All three payments happen in the buyer's single purchase transaction. The contract never holds money.

## Who owns what on the team

| Person | Owns |
|---|---|
| **Esteban** | Contract, deployment, backend (Supabase, QuickNode Streams webhook, API routes) |
| **Aditya** | Frontend: pages, buy flow UI, live feed, `/check`, `/licenses` |
| **Riya** | Testing, recording and cutting the 3 demo clips, demo video, Devpost text |

Branch and PR rules: [CONTRIBUTING.md](../CONTRIBUTING.md). Monday's setup is done: scaffold, contract, and 26 passing tests.

## Today (Tue Nov 17)

- [ ] **Riya:** record, cut, and hand over the 3 final clip files. Each file's hash goes on-chain and can't change later, so they must be final.
- [ ] **Esteban:** deploy + list-clips scripts, tested on a local chain
- [ ] **Esteban:** deploy the contract to Arc testnet, then list the 3 clips once the files are final
- [ ] **Esteban:** site live on Vercel
- [ ] **Aditya:** clip page `/clips/[id]`: preview, split breakdown, use-type picker
- [ ] **Aditya:** buy flow: connect wallet → approve USDC → buy, with pending / confirmed / failed states
- [ ] **Everyone:** one test purchase on Arc testnet with your own testnet wallet

## Demo script (~2 min)

1. **Hook:** "Podcasts are hours long; the value is in 30-second moments. Snippet lets anyone license one, and pays the person who found it."
2. **Marketplace:** show the 3 clips and the live "licenses sold" feed.
3. **Clip page:** play the preview. Point out the contributor credit and the 70 / 20 / 10 split.
4. **Buy:** connect a wallet and pick *Social*. Approve, then buy. Mention that it's dollars only: on Arc, even gas is paid in USDC.
5. **Proof:** open the transaction on the Arc explorer and show three transfers, to the rights holder, the contributor, and the platform.
6. **Live feed:** the sale appears on the home page within seconds, delivered by QuickNode Streams.
7. **Download:** on `/licenses`, download the licensed file.
8. **Cleared?:** on `/check`, drop in the file → "Cleared for Social use by 0x…". Then drop in a different file → "No license found".
9. **Close:** "Next steps: rights-holder verification and link-plus-license for third-party content."
