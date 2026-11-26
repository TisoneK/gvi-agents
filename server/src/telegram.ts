import { config } from "./config.js";
import type { AlertSnap } from "./types.js";

const MARK: Record<string, string> = {
  verified: "✅ VERIFIED",
  flagged: "⛔ FLAGGED",
  decaying: "⏳ DECAYING",
  info: "• INTEL",
};

// Pushes meaningful alerts to Telegram via the Bot API. No-op without a token,
// so the system runs fine before the channel is configured.
export function makeTelegram() {
  if (!config.telegram.enabled) {
    return { enabled: false, async send(_a: AlertSnap) {} };
  }
  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;
  return {
    enabled: true,
    async send(a: AlertSnap) {
      if (a.severity === "info") return; // skip routine intel noise
      const text = `${MARK[a.severity] ?? "•"}\n${a.text}`;
      try {
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: config.telegram.chatId, text, disable_notification: a.severity === "decaying" }),
        });
      } catch (err) {
        console.warn("[telegram] send failed:", (err as Error).message);
      }
    },
  };
}
