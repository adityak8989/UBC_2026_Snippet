# contracts

Foundry project for the `SnippetLicenses` contract. See the root [README](../README.md) for setup and [docs/PLAN.md](../docs/PLAN.md) §4 for the spec.

```
forge build    # compile
forge test     # run tests
```

## Deployment (Arc testnet, chain ID 5042002)

| | |
|---|---|
| `SnippetLicenses` | [`0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20`](https://testnet.arcscan.app/address/0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20) (source verified) |
| USDC (ERC-20, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| Explorer | https://testnet.arcscan.app (redirects to https://explorer.testnet.arc.io, a Blockscout instance) |
| Public RPC | https://rpc.testnet.arc.network |

Check the listed clips still match `web/lib/clips.json`: `cd web && npm run verify-onchain`.

Re-verify the source (Blockscout needs no API key; the constructor args are usdc, treasury, owner):
```
forge verify-contract 0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20 src/SnippetLicenses.sol:SnippetLicenses \
  --chain-id 5042002 --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" \
    0x3600000000000000000000000000000000000000 0x3Ec429C01b1475295F036dc747332727F46C7Ba2 0x2326Fa11c6B9fE3Da136501c4e92039bFf6DE5a3)
```
