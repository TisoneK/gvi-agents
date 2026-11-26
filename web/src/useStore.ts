import { useSyncExternalStore } from "react";
import { store } from "./store";

// Subscribe React chrome (agent rail, feed, metrics) to store changes.
// The graph canvas does NOT use this — it reads the mutable store every frame.
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}
