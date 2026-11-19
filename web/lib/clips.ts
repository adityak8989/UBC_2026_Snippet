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
// licensees download. previewUrl (720p, ~2 MB, faststart) and posterUrl are for playback only
// (posterUrl may be empty until a poster is made);
// they are different bytes, so never hash them or list them on-chain.
export interface Clip {
  id: string;
  clipIdBytes32: `0x${string}`;
  title: string;
  // A short spoken line shown in italics under the title: copied word for word from the clip's ElevenLabs
  // transcript (npm run check-clips verifies it). Omitted for clips without speech.
  quote?: string;
  creator?: string; // key into CREATORS (lib/creators.ts); the creator receives the rights-holder share
  description: string;
  show: string;
  // Rights: "original" = the creator owns everything, all three uses are for sale.
  // "gameplay" = the game footage belongs to `publisher`, so Commercial is not for sale (price 0;
  // npm run check-clips enforces it).
  contentType: "original" | "gameplay";
  publisher?: string; // gameplay only, e.g. "Activision"
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
  // Why a use type is unavailable (price 0: the contract refuses to sell it), shown next to it.
  priceNotes?: Partial<Record<"editorial" | "social" | "commercial", string>>;
  // false = delisted (contracts/script/DelistClips.s.sol). Kept here so certificates for licenses
  // already sold still find the clip, but it is no longer shown or sold.
  active?: boolean;
}

/** Every clip ever listed, including delisted ones: use this to look up a clip from a license. */
export const DEMO_CLIPS = clipsData.clips as Clip[];

/** Clips currently for sale: the marketplace and search. */
export const LISTED_CLIPS = DEMO_CLIPS.filter((c) => c.active !== false);

export function getClipById(id: string): Clip | undefined {
  return DEMO_CLIPS.find((c) => c.id === id);
}
