// Load .env (Node 24 native, no dotenv dependency) and derive feature flags.
// The system runs fully in "mock" mode with no secrets; adding keys flips the
// corresponding capability to live.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  try {
    (process as unknown as { loadEnvFile: (p: string) => void }).loadEnvFile(envPath);
  } catch {
    // older node without loadEnvFile — env must be provided by the shell
  }
}

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),

  llm: {
    provider: (env.LLM_PROVIDER ?? (env.ANTHROPIC_API_KEY ? "anthropic" : "mock")) as "anthropic" | "mock",
    apiKey: env.ANTHROPIC_API_KEY ?? "",
    // Defaults to Opus 5.5; set GVI_MODEL=claude-haiku-5-5 to cut cost sharply
    // given the high call volume of a continuous agent loop.
    model: env.GVI_MODEL ?? "claude-opus-5-5",
    baseUrl: env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
  },

  search: {
    provider: (env.SEARCH_PROVIDER ?? (env.TAVILY_API_KEY ? "tavily" : "mock")) as "tavily" | "mock",
    tavilyKey: env.TAVILY_API_KEY ?? "",
  },

  telegram: {
    enabled: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    token: env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: env.TELEGRAM_CHAT_ID ?? "",
  },

  // tempo of the autonomous loop (ms)
  tempo: Number(env.GVI_TEMPO ?? 2200),
  dataDir: env.GVI_DATA_DIR ?? resolve(process.cwd(), "data"),
};

export function modeLabel() {
  const live = [];
  if (config.llm.provider === "anthropic") live.push("reasoning");
  if (config.search.provider === "tavily") live.push("search");
  if (config.telegram.enabled) live.push("telegram");
  return live.length ? `live:${live.join("+")}` : "mock";
}
