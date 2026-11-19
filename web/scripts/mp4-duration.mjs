// Reads an MP4's duration in seconds from its movie header ('mvhd' box), no ffmpeg needed.
// Used by check-clips to keep each clip's "duration" label equal to what the video player shows.
import { readFileSync } from "node:fs";

export function mp4DurationSeconds(path) {
  const buf = readFileSync(path);
  const at = buf.indexOf("mvhd");
  if (at < 4) throw new Error(`${path}: no mvhd box`);
  const version = buf[at + 4];
  // version 0: 32 bit creation/modification, then timescale, 32 bit duration
  // version 1: 64 bit creation/modification, then timescale, 64 bit duration
  if (version === 1) {
    const timescale = buf.readUInt32BE(at + 4 + 4 + 16);
    const duration = Number(buf.readBigUInt64BE(at + 4 + 4 + 16 + 4));
    return duration / timescale;
  }
  const timescale = buf.readUInt32BE(at + 4 + 4 + 8);
  const duration = buf.readUInt32BE(at + 4 + 4 + 8 + 4);
  return duration / timescale;
}

/** The label the player shows: whole seconds rounded down, "0:12". */
export function durationLabel(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
