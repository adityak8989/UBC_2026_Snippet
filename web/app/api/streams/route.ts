import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog } from "viem";
import { SnippetLicensesAbi } from "@/lib/abi";
import { saveLicenseEvent, USE_TYPE_MAP, LicenseEvent } from "@/lib/events";
import { DEMO_CLIPS } from "@/lib/clips";

// Optional security token for QuickNode Streams webhook header
const STREAM_SECURITY_TOKEN = process.env.QUICKNODE_STREAMS_SECURITY_TOKEN;

export async function POST(req: NextRequest) {
  try {
    // 1. Verify QuickNode Streams security token if configured
    if (STREAM_SECURITY_TOKEN) {
      const authHeader = req.headers.get("x-qn-security-token") || req.headers.get("authorization");
      if (authHeader !== STREAM_SECURITY_TOKEN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();

    // QuickNode Streams can send a single payload or an array of blocks/transactions
    const payloads = Array.isArray(body) ? body : [body];
    let processedCount = 0;

    for (const item of payloads) {
      // Direct event test payload
      if (item.licenseId && item.fileHash && item.buyer) {
        const matchingClip = DEMO_CLIPS.find(
          (c) => c.fileHash.toLowerCase() === item.fileHash.toLowerCase()
        );
        saveLicenseEvent({
          licenseId: Number(item.licenseId),
          clipId: item.clipId || "0x",
          clipTitle: matchingClip?.title || "Podcast Moment",
          buyer: item.buyer,
          fileHash: item.fileHash,
          useType: item.useType || "Social",
          priceUsdc: Number(item.priceUsdc || item.price || 15),
          timestamp: Number(item.timestamp || Math.floor(Date.now() / 1000)),
          txHash: item.txHash || "0x",
        });
        processedCount++;
        continue;
      }

      // QuickNode Streams block logs format
      const logs = item.logs || (item.data && item.data.logs) || [];
      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: SnippetLicensesAbi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "LicenseIssued") {
            const args = decoded.args as {
              licenseId: bigint;
              clipId: `0x${string}`;
              buyer: `0x${string}`;
              fileHash: `0x${string}`;
              useType: number;
              price: bigint;
              timestamp: bigint;
            };

            const matchingClip = DEMO_CLIPS.find(
              (c) => c.clipIdBytes32.toLowerCase() === args.clipId.toLowerCase()
            );

            const eventRecord: LicenseEvent = {
              licenseId: Number(args.licenseId),
              clipId: args.clipId,
              clipTitle: matchingClip?.title || "Podcast Clip",
              buyer: args.buyer,
              fileHash: args.fileHash,
              useType: USE_TYPE_MAP[args.useType] || "Social",
              priceUsdc: Number(args.price) / 1e6, // 6 decimals
              timestamp: Number(args.timestamp),
              txHash: log.transactionHash || item.transactionHash || "0x",
              blockNumber: Number(log.blockNumber || item.blockNumber),
              logIndex: Number(log.logIndex),
            };

            saveLicenseEvent(eventRecord);
            processedCount++;
          }
        } catch {
          // Log was not LicenseIssued or didn't match ABI (skip silently)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "QuickNode Stream processed",
      eventsProcessed: processedCount,
    });
  } catch (error) {
    console.error("QuickNode Streams webhook error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}
