import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False on the server and during hydration, true afterwards. Use it to hold back wallet state:
// wagmi can reconnect a wallet before React hydrates, and rendering that state right away
// makes the HTML differ from the server's and breaks hydration.
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
