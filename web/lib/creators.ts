import type { Clip } from "./clips";

// Creators shown on the site. A clip names its creator with `"creator": "<id>"` in clips.json; the creator's
// share is the clip's rights-holder share.
export interface Creator {
  name: string;
  initials: string; // avatar fallback when there is no image
  avatar?: string; // square image under public/, e.g. a pixel-art SVG
  bio: string; // one line
}

export const CREATORS: Record<string, Creator> = {
  spacelofi: {
    name: "SpaceLofi",
    initials: "SL",
    avatar: "/creators/spacelofi.svg",
    bio: "Streams COD, Valorant and Monster Hunter",
  },
};

export function getCreator(clip: Pick<Clip, "creator"> | undefined): Creator | undefined {
  return clip?.creator ? CREATORS[clip.creator] : undefined;
}

/** Label for the contributor share: "Paid to Esteban (producer)" on clips with a named creator and
 * contributor; "Contributor" otherwise (the delisted nature clips keep their old wording). */
export function contributorPayoutLabel(clip: Pick<Clip, "creator" | "contributorName"> | undefined) {
  return clip?.creator && clip.contributorName ? `Paid to ${clip.contributorName}` : "Contributor";
}

/** Short name of the contributor for the card's royalty split line. */
export function contributorShortName(clip: Pick<Clip, "creator" | "contributorName">) {
  return clip.creator && clip.contributorName ? clip.contributorName : "Contributor";
}

/** Label for the rights-holder share in a payment split: "Paid to SpaceLofi", or "Creator". */
export function creatorPayoutLabel(clip: Pick<Clip, "creator"> | undefined) {
  const creator = getCreator(clip);
  return creator ? `Paid to ${creator.name}` : "Creator";
}
