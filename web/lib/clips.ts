// fileHash = sha256 of the exact file in web/public/clips. It goes on-chain at listing and
// cannot be changed afterwards, so recompute it whenever a clip file changes:
//   sha256sum web/public/clips/clip1.mp4
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

export const DEMO_CLIPS: Clip[] = [
  {
    id: "clip-1",
    // keccak256("clip-1")
    clipIdBytes32: "0x9584457997a664eed0a88667c6e268f47e93beb8fa9f00af17fca5228170a7fd",
    title: "Why AI Agents Need Blockchain Wallets",
    description: "Discussing how autonomous agents will transact, settle micro-payments, and license media on-chain.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Esteban & Aditya",
    contributorName: "Aditya (Co-host)",
    duration: "0:28",
    videoUrl: "/clips/clip1.mp4",
    fileHash: "0xed770ac420e933f25434c5ad07ae73d8f446a48af6b3eeb4fad069f4a0bcfa47",
    prices: {
      editorial: 5,
      social: 15,
      commercial: 50,
    },
    split: {
      rightsHolderBps: 7000, // 70%
      contributorBps: 2000,  // 20%
      platformBps: 1000,     // 10%
    },
  },
  {
    id: "clip-2",
    // keccak256("clip-2")
    clipIdBytes32: "0x76d3ab437960819271e93704814b9ce221e7d84c5a6bf6e5840e6d6d562cc835",
    title: "USDC as Native Gas on Arc Testnet",
    description: "Breaking down how gas is paid directly in dollars, making crypto UX finally accessible for everyday consumers.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Riya & Esteban",
    contributorName: "Riya (Guest Speaker)",
    duration: "0:30",
    videoUrl: "/clips/clip2.mp4",
    fileHash: "0x18cf7f14d9f9abf2f014ceaafc449cb5fce309f21eff227b3b0d439090de0245",
    prices: {
      editorial: 5,
      social: 15,
      commercial: 50,
    },
    split: {
      rightsHolderBps: 7000,
      contributorBps: 2000,
      platformBps: 1000,
    },
  },
  {
    id: "clip-3",
    // keccak256("clip-3")
    clipIdBytes32: "0xe3c4ea9e8aa23f20c3aba6205a5b6da9c124e33d0886290021235e619e93e220",
    title: "Instant Creator Royalties vs Opaque Sync Agencies",
    description: "Why traditional stock licensing takes 60 days to pay creators, and how atomic splits fix the podcast economy.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Esteban",
    contributorName: "Solo Take (No Guest)",
    duration: "0:15",
    videoUrl: "/clips/clip3.mp4",
    fileHash: "0x09f4a1563d66df5da733b9c72d15e7f10f2aa7430c6020d6a1116979b67057f5",
    prices: {
      editorial: 5,
      social: 15,
      commercial: 50,
    },
    split: {
      rightsHolderBps: 9000, // 90% to host
      contributorBps: 0,     // 0% (solo clip)
      platformBps: 1000,     // 10%
    },
  },
];

export function getClipById(id: string): Clip | undefined {
  return DEMO_CLIPS.find((c) => c.id === id);
}
