import { getSpokenTranscript } from "./captions";
import type { Clip } from "./clips";
import { getCreator } from "./creators";

/** Short tag for cards: "Gameplay" / "Original". */
export const contentTypeLabel = (clip: Pick<Clip, "contentType">) =>
  clip.contentType === "gameplay" ? "Gameplay" : "Original";

/** One or two plain sentences on who owns what in the clip, and why a use may be unavailable. */
export function rightsSummary(clip: Clip): string {
  const who = getCreator(clip)?.name ?? "The creator";
  if (clip.contentType === "gameplay") {
    // Clips with no speech have no commentary to own.
    const owns = getSpokenTranscript(clip.id) ? "the commentary and play" : "the play";
    const publisher = clip.publisher ?? "the game publisher";
    return `Gameplay clip: ${who} owns ${owns}; the game footage belongs to ${publisher}. Commercial use needs the publisher’s permission.`;
  }
  return "Original content: the creator owns everything in this clip, so all uses are available.";
}
