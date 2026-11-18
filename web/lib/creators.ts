import type { Clip } from "./clips";

// Creators shown on the site. A clip names its creator with `"creator": "<id>"` in clips.json; the creator's
// share is the clip's rights-holder share.
export interface Creator {
  name: string;
  initials: string; // shown in the avatar badge
  bio: string; // one line
}

export const CREATORS: Record<string, Creator> = {
  spacelofi: { name: "SpaceLofi", initials: "SL", bio: "Streams COD, Valorant and Monster Hunter" },
};

export function getCreator(clip: Pick<Clip, "creator"> | undefined): Creator | undefined {
  return clip?.creator ? CREATORS[clip.creator] : undefined;
}

/** Label for the rights-holder share in a payment split: "Paid to SpaceLofi", or "Creator". */
export function creatorPayoutLabel(clip: Pick<Clip, "creator"> | undefined) {
  const creator = getCreator(clip);
  return creator ? `Paid to ${creator.name}` : "Creator";
}
