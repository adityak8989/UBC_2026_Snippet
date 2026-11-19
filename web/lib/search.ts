import type { Clip } from "./clips";
import { getCreator } from "./creators";
import { contentTypeLabel } from "./rights";

// Homepage "Search clips or what's said", clip half: a clip matches when every word typed appears
// (case insensitive) somewhere in its title, game/show, publisher, creator name, content type
// ("Gameplay" / "Original") or description. Quotes inside transcripts are searched by captions.ts.

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[’‘]/g, "'");

function haystack(clip: Clip): string {
  return fold(
    [clip.title, clip.show, clip.publisher ?? "", getCreator(clip)?.name ?? "", contentTypeLabel(clip), clip.description].join(
      " \n ",
    ),
  );
}

export function searchClips(query: string, clips: Clip[]): Clip[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return clips.filter((clip) => {
    const text = haystack(clip);
    return words.every((w) => text.includes(w));
  });
}
