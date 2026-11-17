// Checks web/lib/clips.json before listing clips on-chain:
// each fileHash is the sha256 of its file in public/, each clipIdBytes32 is keccak256(id),
// and each split sums to 10000 bps. Run from web/: npm run check-clips
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { keccak256, toBytes } from "viem";

const { clips } = JSON.parse(readFileSync(new URL("../lib/clips.json", import.meta.url), "utf8"));
let ok = true;

for (const clip of clips) {
  const file = readFileSync(new URL(`../public${clip.videoUrl}`, import.meta.url));
  const sha = "0x" + createHash("sha256").update(file).digest("hex");
  const { rightsHolderBps, contributorBps, platformBps } = clip.split;
  const checks = {
    fileHash: sha === clip.fileHash,
    clipIdBytes32: keccak256(toBytes(clip.id)) === clip.clipIdBytes32,
    split: rightsHolderBps + contributorBps + platformBps === 10000,
  };
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) ok = false;
    console.log(`${passed ? "ok  " : "FAIL"} ${clip.id} ${name}${name === "fileHash" && !passed ? ` (file is ${sha})` : ""}`);
  }
}

process.exit(ok ? 0 : 1);
