// Checks web/lib/clips.json before listing clips on-chain:
// each fileHash is the sha256 of its file in public/, each clipIdBytes32 is keccak256(id),
// each split sums to 10000 bps, the playback preview (not the master itself) and poster exist, every
// price-0 (not for sale) use type has a note, each transcript matches its master and manifest hash, and the
// rights rules hold: "original" clips sell all three uses; "gameplay" clips name a publisher and never sell
// Commercial (price 0).
// Run from web/: npm run check-clips
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { keccak256, toBytes } from "viem";

const { clips } = JSON.parse(readFileSync(new URL("../lib/clips.json", import.meta.url), "utf8"));
// Quotes are compared ignoring case, punctuation and [audio events].
const normalize = (s) =>
  s.toLowerCase().replace(/\[[^\]]*\]/g, " ").replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const manifest = readFileSync(new URL("../lib/transcripts/manifest.ts", import.meta.url), "utf8");
let ok = true;

for (const clip of clips) {
  const file = readFileSync(new URL(`../public${clip.videoUrl}`, import.meta.url));
  const sha = "0x" + createHash("sha256").update(file).digest("hex");
  const { rightsHolderBps, contributorBps, platformBps } = clip.split;
  const checks = {
    fileHash: sha === clip.fileHash,
    clipIdBytes32: keccak256(toBytes(clip.id)) === clip.clipIdBytes32,
    split: rightsHolderBps + contributorBps + platformBps === 10000,
    previewAndPoster:
      clip.previewUrl !== clip.videoUrl &&
      [clip.previewUrl, clip.posterUrl].every((url) => url && existsSync(new URL(`../public${url}`, import.meta.url))),
    priceNotes: Object.entries(clip.prices).every(([use, price]) => price > 0 || !!clip.priceNotes?.[use]),
    rights:
      clip.contentType === "original"
        ? !clip.publisher && Object.values(clip.prices).every((p) => p > 0)
        : clip.contentType === "gameplay" && !!clip.publisher && clip.prices.commercial === 0,
  };
  const transcriptFile = new URL(`../lib/transcripts/${clip.id}.json`, import.meta.url);
  if (existsSync(transcriptFile)) {
    const bytes = readFileSync(transcriptFile);
    const hash = "0x" + createHash("sha256").update(bytes).digest("hex");
    const transcript = JSON.parse(bytes);
    checks.transcript = transcript.fileHash === clip.fileHash && manifest.includes(`"${clip.id}": { sha256: "${hash}"`);
    if (clip.quote) checks.quote = transcript.hasSpeech && normalize(transcript.text).includes(normalize(clip.quote));
  } else if (clip.quote) {
    checks.quote = false; // a quote needs a transcript to come from
  }
  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) ok = false;
    console.log(`${passed ? "ok  " : "FAIL"} ${clip.id} ${name}${name === "fileHash" && !passed ? ` (file is ${sha})` : ""}`);
  }
}

process.exit(ok ? 0 : 1);
