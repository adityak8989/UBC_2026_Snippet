import { NextResponse } from "next/server";
import { getAllLicenseEvents } from "@/lib/events";

export async function GET() {
  try {
    const events = getAllLicenseEvents();
    return NextResponse.json({
      success: true,
      count: events.length,
      events: events.slice(0, 10), // return top 10 latest events
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch feed", details: String(error) },
      { status: 500 }
    );
  }
}
