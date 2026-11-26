import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import { store } from "./store";

// Subscribe React chrome (HUD panels) to store changes. The orbit canvas does
// NOT use this — it reads the mutable store every frame.
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
}

// A plain wall-clock tick, so time-left countdowns and staleness refresh even
// when no store event fires.
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
