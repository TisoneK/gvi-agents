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

// Pick the reasoning provider. Explicit LLM_PROVIDER wins; otherwise Anthropic
// if its key is set, else an OpenAI-compatible endpoint if a key or base_url is
// set (OpenAI, OpenRouter, Together, or a local Ollama/vLLM server), else mock.
type LLMProviderName = "anthropic" | "openai" | "mock";
const anthropicKey = env.ANTHROPIC_API_KEY ?? "";
const openaiKey = env.OPENAI_API_KEY ?? "";
const openaiBaseUrl = env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const hasOpenAI = Boolean(openaiKey || env.OPENAI_BASE_URL);
const llmProvider: LLMProviderName =
  (env.LLM_PROVIDER as LLMProviderName | undefined) ??
  (anthropicKey ? "anthropic" : hasOpenAI ? "openai" : "mock");
const llmModel =
  env.GVI_MODEL ??
  (llmProvider === "openai" ? env.OPENAI_MODEL ?? "gpt-4o-mini" : "claude-opus-5-5");

export const config = {
  // Some shells export PORT (often as "0" for "pick a free port"), which would
  // move the backend off the port web/src/wsClient.ts hardcodes. Treat an
  // empty/zero/unparseable value as "unset".
  port: Number(env.PORT ?? 8787) || 8787,

  llm: {
    provider: llmProvider,
    // Defaults to Opus 5.5 (Anthropic) or gpt-4o-mini (OpenAI-compatible).
    // Set GVI_MODEL to override either; for a chatty loop a small/cheap model
    // (claude-haiku-5-5, gpt-4o-mini, or a local model) is usually plenty.
    model: llmModel,
    anthropicKey,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    openaiKey,
    openaiBaseUrl,
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
  if (config.llm.provider !== "mock") live.push(`reasoning(${config.llm.provider})`);
  if (config.search.provider === "tavily") live.push("search");
  if (config.telegram.enabled) live.push("telegram");
  return live.length ? `live:${live.join("+")}` : "mock";
}
