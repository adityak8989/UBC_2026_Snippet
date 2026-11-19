import { zeroAddress } from "viem";

// Browser side of the server's Arc reads (/api/chain/*), which go through QuickNode with the public Arc
// RPC as fallback. The QuickNode endpoint itself never reaches the browser.

export interface ChainLicense {
  clipId: `0x${string}`;
  fileHash: `0x${string}`;
  buyer: `0x${string}`;
  useType: number;
  timestamp: bigint;
  price: bigint;
  rhAmount: bigint;
  contribAmount: bigint;
  platformAmount: bigint;
}

/** The contract's record of a license; buyer is the zero address when it doesn't exist (like getLicense). */
export async function fetchChainLicense(licenseId: bigint): Promise<ChainLicense> {
  const res = await fetch(`/api/chain/license/${licenseId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`license read failed (${res.status})`);
  const { license } = (await res.json()) as { license: Record<string, string | number> | null };
  if (!license) {
    return {
      clipId: `0x${"0".repeat(64)}`,
      fileHash: `0x${"0".repeat(64)}`,
      buyer: zeroAddress,
      useType: 0,
      timestamp: BigInt(0),
      price: BigInt(0),
      rhAmount: BigInt(0),
      contribAmount: BigInt(0),
      platformAmount: BigInt(0),
    };
  }
  return {
    clipId: license.clipId as `0x${string}`,
    fileHash: license.fileHash as `0x${string}`,
    buyer: license.buyer as `0x${string}`,
    useType: Number(license.useType),
    timestamp: BigInt(license.timestamp),
    price: BigInt(license.price),
    rhAmount: BigInt(license.rhAmount),
    contribAmount: BigInt(license.contribAmount),
    platformAmount: BigInt(license.platformAmount),
  };
}

export interface ChainClip {
  id: string;
  listed: boolean;
  active: boolean;
  fileHash: `0x${string}`;
  rightsHolder: `0x${string}`;
}

/** Every clip's on chain registration, in DEMO_CLIPS order. */
export async function fetchChainClips(): Promise<ChainClip[]> {
  const res = await fetch("/api/chain/clips", { cache: "no-store" });
  if (!res.ok) throw new Error(`clip registry read failed (${res.status})`);
  return ((await res.json()) as { clips: ChainClip[] }).clips;
}
