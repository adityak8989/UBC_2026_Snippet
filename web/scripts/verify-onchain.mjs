// Reads the deployed SnippetLicenses contract and checks every clip against web/lib/clips.json
// (listed, active unless clips.json marks it "active": false, file hash, split, prices). Run from web/:
//   npm run verify-onchain [-- <contract address> [rpc url]]
import { readFileSync } from "node:fs";
import { createPublicClient, http, parseUnits, zeroAddress } from "viem";
import { SnippetLicensesAbi } from "../lib/abi.ts";

const address = process.argv[2] ?? "0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20";
const rpcUrl = process.argv[3] ?? "https://rpc.testnet.arc.network"; // public Arc testnet RPC

const { clips } = JSON.parse(readFileSync(new URL("../lib/clips.json", import.meta.url), "utf8"));
const client = createPublicClient({ transport: http(rpcUrl) });
console.log(`contract ${address} on chain ${await client.getChainId()}`);

let ok = true;
for (const clip of clips) {
  const c = await client.readContract({
    address,
    abi: SnippetLicensesAbi,
    functionName: "getClip",
    args: [clip.clipIdBytes32],
  });
  const expectedPrices = [clip.prices.editorial, clip.prices.social, clip.prices.commercial].map((p) =>
    parseUnits(String(p), 6),
  );
  const checks = {
    listed: c.listed,
    active: c.active === (clip.active !== false),
    fileHash: c.fileHash === clip.fileHash,
    split:
      c.rhBps === clip.split.rightsHolderBps &&
      c.contribBps === clip.split.contributorBps &&
      c.platformBps === clip.split.platformBps,
    prices: c.prices.every((p, i) => p === expectedPrices[i]),
    contributor: clip.split.contributorBps !== 0 || c.contributor === zeroAddress,
  };
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) ok = false;
    console.log(`${passed ? "ok  " : "FAIL"} ${clip.id} ${name}`);
  }
}

process.exit(ok ? 0 : 1);
