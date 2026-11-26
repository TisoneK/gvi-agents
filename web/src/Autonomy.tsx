import type { Autonomy as AutonomyLevel } from "./store";
import { store } from "./store";
import { useStoreVersion } from "./useStore";

// How much leash the presence has — visible, so its limits are trustable.
// Watch: only observes. Suggest: surfaces finds. Ask first: pulls decisions to
// you. Act: claims what's about to vanish and tells you after.
const LEVELS: { id: AutonomyLevel; label: string; hint: string }[] = [
  { id: "watch", label: "Watch", hint: "only observes" },
  { id: "suggest", label: "Suggest", hint: "surfaces what it finds" },
  { id: "ask", label: "Ask first", hint: "brings decisions to you" },
  { id: "act", label: "Act", hint: "claims what's about to vanish" },
];

export default function Autonomy() {
  useStoreVersion();
  const cur = store.autonomy;
  return (
    <div className="autonomy" title={`Presence: ${LEVELS.find((l) => l.id === cur)?.hint}`}>
      <span className="autonomy-label">leash</span>
      <div className="autonomy-track">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            className={"autonomy-step" + (l.id === cur ? " on" : "")}
            onClick={() => store.setAutonomy(l.id)}
            title={l.hint}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
