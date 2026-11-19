import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { DEMO_CLIPS } from "@/lib/clips";
import { getCreator } from "@/lib/creators";
import { USE_TYPE_NAMES } from "@/lib/licenses";
import { getLicenseOnChain } from "@/lib/serverChain";

// Preview card for shared certificate links (/license/[id]): clip title, creator, use type, and
// "Verified on Arc" only when the contract has the license and its file hash is the clip's master.

export const alt = "Snippet license certificate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read on the server through QuickNode, falling back to the public Arc RPC (lib/serverChain.ts).
async function readLicense(id: string) {
  if (!/^\d{1,18}$/.test(id) || id === "0") return undefined;
  try {
    return (await getLicenseOnChain(BigInt(id))).license ?? undefined;
  } catch {
    return undefined; // RPC down: show a plain card rather than fail the preview
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  // Read the chain at request time: a license that doesn't exist yet must not be cached as missing.
  await connection();
  const { id } = await params;
  const license = await readLicense(id);
  const clip = license && DEMO_CLIPS.find((c) => c.clipIdBytes32.toLowerCase() === license.clipId.toLowerCase());
  const verified = !!clip && clip.fileHash.toLowerCase() === license.fileHash.toLowerCase();
  const creator = getCreator(clip);
  const useType = license ? (USE_TYPE_NAMES[license.useType] ?? "") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#0f1115",
          color: "#f5f3ee",
          borderTop: "12px solid #7c5cff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, letterSpacing: 6, color: "#8a8f98" }}>SNIPPET LICENSE CERTIFICATE</div>
            <div style={{ fontSize: 44, fontWeight: 700, marginTop: 8 }}>{`No. ${id.padStart(4, "0")}`}</div>
          </div>
          {verified && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 24px",
                borderRadius: 999,
                border: "2px solid #22c55e",
                color: "#22c55e",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 16 16">
                <path
                  fill="#22c55e"
                  d="M13.3 4.3a1 1 0 0 1 0 1.4l-6 6a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6.6 9.6l5.3-5.3a1 1 0 0 1 1.4 0Z"
                />
              </svg>
              <span>Verified on Arc</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#8a8f98" }}>Licensed clip</div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, marginTop: 8 }}>
            {clip?.title ?? (license ? "Snippet clip" : "License not found")}
          </div>
          {clip && (
            <div style={{ fontSize: 32, color: "#a08cff", marginTop: 12 }}>
              {creator ? `by ${creator.name} · ${clip.show}` : clip.show}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {useType ? (
            <div
              style={{
                display: "flex",
                padding: "10px 24px",
                borderRadius: 12,
                background: "rgba(124, 92, 255, 0.2)",
                color: "#a08cff",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {`${useType} use`}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div style={{ fontSize: 28, color: "#8a8f98" }}>Snippet on Arc testnet</div>
        </div>
      </div>
    ),
    size,
  );
}
