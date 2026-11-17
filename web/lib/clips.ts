import clipsData from "./clips.json";

// The clip data lives in clips.json so the website and the Foundry list script
// (contracts/script/ListClips.s.sol) read the exact same IDs, file hashes, splits, and prices.
//
// fileHash = sha256 of the exact file in web/public/clips. It goes on-chain at listing and
// cannot be changed afterwards, so recompute it whenever a clip file changes:
//   sha256sum web/public/clips/clip1.mp4
// clipIdBytes32 = keccak256 of the id string, e.g. `cast keccak clip-1`.
// Prices are whole USDC (the list script and the clip page both convert with 6 decimals).
//
// videoUrl is the original master file: the one fileHash describes, the /check page matches, and
// licensees download. previewUrl (720p, ~2 MB, faststart) and posterUrl are for playback only;
// they are different bytes, so never hash them or list them on-chain.
export interface Clip {
  id: string;
  clipIdBytes32: `0x${string}`;
  title: string;
  description: string;
  show: string;
  speaker: string;
  contributorName: string;
  duration: string;
  videoUrl: string;
  previewUrl: string;
  posterUrl: string;
  fileHash: `0x${string}`;
  prices: {
    editorial: number; // in USDC
    social: number;
    commercial: number;
  };
  split: {
    rightsHolderBps: number;
    contributorBps: number;
    platformBps: number;
  };
}

export const DEMO_CLIPS = clipsData.clips as Clip[];

export function getClipById(id: string): Clip | undefined {
  return DEMO_CLIPS.find((c) => c.id === id);
}
