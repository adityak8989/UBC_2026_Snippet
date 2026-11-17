import { NextRequest, NextResponse } from "next/server";
import { findLicenseByHash } from "@/lib/events";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileHash = searchParams.get("fileHash");
    const buyer = searchParams.get("buyer") || undefined;

    if (!fileHash) {
      return NextResponse.json(
        { error: "Missing required parameter 'fileHash'" },
        { status: 400 }
      );
    }

    const license = findLicenseByHash(fileHash, buyer);

    if (license) {
      return NextResponse.json({
        cleared: true,
        message: "License verified on Arc testnet",
        license,
      });
    }

    return NextResponse.json({
      cleared: false,
      message: "No active license found for this file hash on Arc testnet",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Clearance check failed", details: String(error) },
      { status: 500 }
    );
  }
}
