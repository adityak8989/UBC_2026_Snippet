// Adds a new clip to the site, from a raw recording to a clips.json entry ready to list on-chain:
//   1. copies the recording byte for byte to public/clips/clipN.mp4 (the master: its sha256 is the on-chain fileHash)
//   2. makes the playback preview (<= 720p, 30 fps, AAC kept for captions, faststart) and a poster with ffmpeg
//   3. appends the clip to lib/clips.json (next free id, keccak256 clip id, duration, prices, split, rights)
//   4. transcribes it with ElevenLabs (npm run transcribe) and runs npm run check-clips
// Then list it on-chain with contracts/script/ListClips.s.sol (the script prints the command).
//
// Run from web/ (put the raw file in web/incoming/, which is gitignored):
//   npm run add-clip -- --file incoming/my-take.mp4 --title "..." --show "..." --description "..." \
//     --content-type original --prices 5,15,50 --split 7000,2000,1000 --contributor-name "..." [--creator <id>]
//   Gameplay: --content-type gameplay --publisher "Activision" --prices 5,15,0
//   Options: --speaker "...", --no-transcribe, --dry-run (print the entry, change nothing)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toBytes } from "viem";

const GAMEPLAY_COMMERCIAL_NOTE = "Commercial use requires the game publisher’s permission";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`Unexpected argument: ${a}`);
    const key = a.slice(2);
    if (["no-transcribe", "dry-run"].includes(key)) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function fail(msg) {
  console.error(`add-clip: ${msg}`);
  process.exit(1);
}

// ffmpeg / ffprobe: on PATH, or in the winget package folder (winget's Links alias is not always created).
function findTool(name) {
  if (spawnSync(name, ["-version"], { stdio: "ignore" }).status === 0) return name;
  const pkgs = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages");
  if (pkgs && existsSync(pkgs)) {
    for (const pkg of readdirSync(pkgs).filter((d) => d.startsWith("Gyan.FFmpeg"))) {
      for (const build of readdirSync(join(pkgs, pkg))) {
        const exe = join(pkgs, pkg, build, "bin", `${name}.exe`);
        if (existsSync(exe)) return exe;
      }
    }
  }
  fail(`${name} not found. Install it (winget install Gyan.FFmpeg) or put it on PATH.`);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) fail(`${cmd} failed:\n${r.stderr}`);
  return r.stdout;
}

const args = parseArgs(process.argv.slice(2));
for (const k of ["file", "title", "show", "content-type", "prices", "split"]) if (!args[k]) fail(`--${k} is required`);

const contentType = args["content-type"];
if (!["original", "gameplay"].includes(contentType)) fail('--content-type must be "original" or "gameplay"');
if (contentType === "gameplay" && !args.publisher) fail("gameplay clips need --publisher");
if (contentType === "original" && args.publisher) fail("--publisher is only for gameplay clips");

const [editorial, social, commercial] = args.prices.split(",").map(Number);
if (![editorial, social, commercial].every((p) => Number.isInteger(p) && p >= 0)) fail("--prices: three whole USDC amounts");
if (contentType === "original" && !(editorial > 0 && social > 0 && commercial > 0))
  fail("original clips sell all three uses: every price must be > 0");
if (contentType === "gameplay" && commercial !== 0) fail("gameplay clips can't sell Commercial: use 0 as the third price");

const [rightsHolderBps, contributorBps, platformBps] = args.split.split(",").map(Number);
if (rightsHolderBps + contributorBps + platformBps !== 10000) fail("--split must sum to 10000 bps");
if (contributorBps > 0 && !args["contributor-name"]) fail("a contributor share needs --contributor-name (shown on the site)");

const src = args.file;
if (!existsSync(src)) fail(`${src} not found`);
const master = readFileSync(src);
const fileHash = "0x" + createHash("sha256").update(master).digest("hex");

const clipsPath = new URL("../lib/clips.json", import.meta.url);
const data = JSON.parse(readFileSync(clipsPath, "utf8"));
const dup = data.clips.find((c) => c.fileHash === fileHash);
if (dup) fail(`this file is already ${dup.id}`);

const n = Math.max(0, ...data.clips.map((c) => Number(c.id.replace("clip-", "")))) + 1;
const id = `clip-${n}`;

const ffprobe = findTool("ffprobe");
const seconds = Number(run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).trim());
const hasAudio = run(ffprobe, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", src]).trim() !== "";
const duration = `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;

const clip = {
  id,
  clipIdBytes32: keccak256(toBytes(id)),
  title: args.title,
  ...(args.creator ? { creator: args.creator } : {}),
  description: args.description ?? "",
  show: args.show,
  contentType,
  ...(args.publisher ? { publisher: args.publisher } : {}),
  speaker: args.speaker ?? "",
  contributorName: args["contributor-name"] ?? "",
  duration,
  videoUrl: `/clips/clip${n}.mp4`,
  previewUrl: `/clips/preview/clip${n}.mp4`,
  posterUrl: `/clips/posters/clip${n}.jpg`,
  fileHash,
  prices: { editorial, social, commercial },
  split: { rightsHolderBps, contributorBps, platformBps },
  ...(contentType === "gameplay" ? { priceNotes: { commercial: GAMEPLAY_COMMERCIAL_NOTE } } : {}),
};

console.log(`${id}: ${seconds.toFixed(1)} s, ${hasAudio ? "with" : "NO"} audio, sha256 ${fileHash}`);
if (args["dry-run"]) {
  console.log(JSON.stringify(clip, null, 2));
  console.log("dry run: nothing written");
  process.exit(0);
}

const pub = (p) => fileURLToPath(new URL(`../public${p}`, import.meta.url));
mkdirSync(pub("/clips/preview"), { recursive: true });
mkdirSync(pub("/clips/posters"), { recursive: true });
copyFileSync(src, pub(clip.videoUrl));

const ffmpeg = findTool("ffmpeg");
const scale = "scale=-2:'min(720,ih)'"; // never upscale
run(ffmpeg, [
  "-v", "error", "-y", "-i", src,
  "-vf", scale, "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "27",
  "-maxrate", "1500k", "-bufsize", "3000k", "-pix_fmt", "yuv420p",
  ...(hasAudio ? ["-c:a", "aac", "-b:a", "96k"] : ["-an"]),
  "-movflags", "+faststart", pub(clip.previewUrl),
]);
run(ffmpeg, [
  "-v", "error", "-y", "-ss", (seconds / 3).toFixed(2), "-i", src, "-frames:v", "1", "-vf", scale, "-q:v", "3",
  pub(clip.posterUrl),
]);

data.clips.push(clip);
writeFileSync(clipsPath, JSON.stringify(data, null, 2) + "\n");
console.log(`added ${id} to lib/clips.json; master, preview and poster are in public/clips`);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!args["no-transcribe"] && hasAudio) {
  const t = spawnSync(npm, ["run", "transcribe", "--", id], { stdio: "inherit", shell: process.platform === "win32" });
  if (t.status !== 0) fail("transcription failed; fix it and rerun: npm run transcribe -- " + id);
}
const check = spawnSync(npm, ["run", "check-clips"], { stdio: "inherit", shell: process.platform === "win32" });

console.log(`
Next: look at public${clip.posterUrl}, then list ${id} on-chain from contracts/ (Git Bash), as the owner:
  export SNIPPET_LICENSES_ADDRESS=0xfc6a8dd5569ff53ca64065fac5eb17677ad1fe20
  export RIGHTS_HOLDER_ADDRESS=<rights holder wallet>
  export CONTRIBUTOR_ADDRESS=<contributor wallet>   # used only for clips with a contributor share
  forge script script/ListClips.s.sol:ListClips --rpc-url https://rpc.testnet.arc.network \\
    --account <your-keystore-name> --sender 0x2326Fa11c6B9fE3Da136501c4e92039bFf6DE5a3 --broadcast
Then: npm run verify-onchain`);
process.exit(check.status ?? 1);
