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
    clipIdBytes32: "0x25145b57224240a2fe7ee1cb641c7b808ec2fd0b14fb4987034c5685794aa1c2",
    title: "Why AI Agents Need Blockchain Wallets",
    description: "Discussing how autonomous agents will transact, settle micro-payments, and license media on-chain.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Esteban & Aditya",
    contributorName: "Aditya (Co-host)",
    duration: "0:28",
    videoUrl: "/clips/clip1.mp4",
    fileHash: "0x0d8008875f768886066b00143d3f9e703815b33c7115517b47f9cfc6a21d5c6c",
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
    clipIdBytes32: "0x38e2ea5fb026d368d407621c4310d5e1f7480a48b321c7fa15be43431d102e3b",
    title: "USDC as Native Gas on Arc Testnet",
    description: "Breaking down how gas is paid directly in dollars, making crypto UX finally accessible for everyday consumers.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Riya & Esteban",
    contributorName: "Riya (Guest Speaker)",
    duration: "0:30",
    videoUrl: "/clips/clip2.mp4",
    fileHash: "0xc54c607b3399536a8308bc8b5bf194e53df3c7822337454d4183c5a97bb1d60c",
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
    clipIdBytes32: "0xec2eb351d451eb7db7ae6ef9d3d3a778fc3ecb483c6b29d47915bf5dfc5bbf84",
    title: "Instant Creator Royalties vs Opaque Sync Agencies",
    description: "Why traditional stock licensing takes 60 days to pay creators, and how atomic splits fix the podcast economy.",
    show: "Snippet Podcast · Episode 1",
    speaker: "Esteban",
    contributorName: "Solo Take (No Guest)",
    duration: "0:15",
    videoUrl: "/clips/clip3.mp4",
    fileHash: "0xa188de76316fd48e7592697bf58a3c68d6e40a0c40ceeb3160dcd86e2415b3fa",
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
