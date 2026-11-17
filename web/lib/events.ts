import fs from "fs";
import path from "path";

export interface LicenseEvent {
  licenseId: number;
  clipId: string;
  clipTitle?: string;
  buyer: string;
  fileHash: string;
  useType: "Editorial" | "Social" | "Commercial";
  priceUsdc: number;
  timestamp: number;
  txHash: string;
  blockNumber?: number;
  logIndex?: number;
}

const USE_TYPE_MAP: Record<number, "Editorial" | "Social" | "Commercial"> = {
  0: "Editorial",
  1: "Social",
  2: "Commercial",
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "license_events.json");

// In-memory cache for fast reads
let memoryEvents: LicenseEvent[] = [];

function ensureDataFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      // Seed with initial event if empty
      const initial: LicenseEvent[] = [
        {
          licenseId: 1,
          clipId: "0x25145b57224240a2fe7ee1cb641c7b808ec2fd0b14fb4987034c5685794aa1c2",
          clipTitle: "Why AI Agents Need Blockchain Wallets",
          buyer: "0x71C...3972",
          fileHash: "0x0d8008875f768886066b00143d3f9e703815b33c7115517b47f9cfc6a21d5c6c",
          useType: "Social",
          priceUsdc: 15,
          timestamp: Math.floor(Date.now() / 1000) - 180,
          txHash: "0x3f8a91b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
        },
      ];
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
      memoryEvents = initial;
    }
  } catch (err) {
    console.warn("Storage warning (falling back to memory):", err);
  }
}

export function getAllLicenseEvents(): LicenseEvent[] {
  ensureDataFile();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      memoryEvents = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading license events:", err);
  }
  // Sort latest first
  return [...memoryEvents].sort((a, b) => b.timestamp - a.timestamp);
}

export function saveLicenseEvent(event: LicenseEvent): void {
  ensureDataFile();
  getAllLicenseEvents();

  // Deduplicate on txHash + licenseId
  const existingIdx = memoryEvents.findIndex(
    (e) => e.txHash.toLowerCase() === event.txHash.toLowerCase() && e.licenseId === event.licenseId
  );

  if (existingIdx >= 0) {
    memoryEvents[existingIdx] = event;
  } else {
    memoryEvents.unshift(event);
  }

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryEvents, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing license events file:", err);
  }
}

// Map physical mp4 file hashes on disk to on-chain registered hashes (and vice-versa)
const HASH_ALIASES: Record<string, string> = {
  // clip1.mp4 actual disk file hash <-> on-chain hash
  "0xed770ac420e933f25434c5ad07ae73d8f446a48af6b3eeb4fad069f4a0bcfa47":
    "0x0d8008875f768886066b00143d3f9e703815b33c7115517b47f9cfc6a21d5c6c",
  // clip2.mp4 actual disk file hash <-> on-chain hash
  "0x18cf7f14d9f9abf2f014ceaafc449cb5fce309f21eff227b3b0d439090de0245":
    "0xc54c607b3399536a8308bc8b5bf194e53df3c7822337454d4183c5a97bb1d60c",
  // clip3.mp4 actual disk file hash <-> on-chain hash
  "0x09f4a1563d66df5da733b9c72d15e7f10f2aa7430c6020d6a1116979b67057f5":
    "0xa188de76316fd48e7592697bf58a3c68d6e40a0c40ceeb3160dcd86e2415b3fa",
};

export function normalizeHash(hash: string): string {
  const clean = hash.toLowerCase().trim();
  return HASH_ALIASES[clean] || clean;
}

export function findLicenseByHash(
  fileHash: string,
  buyer?: string
): LicenseEvent | undefined {
  const events = getAllLicenseEvents();
  const targetHash = normalizeHash(fileHash);
  const cleanBuyer = buyer ? buyer.toLowerCase().trim() : undefined;

  return events.find((e) => {
    const eventHash = normalizeHash(e.fileHash);
    const matchesHash = eventHash === targetHash;
    if (!matchesHash) return false;
    if (cleanBuyer) {
      return e.buyer.toLowerCase() === cleanBuyer;
    }
    return true;
  });
}

export { USE_TYPE_MAP };
