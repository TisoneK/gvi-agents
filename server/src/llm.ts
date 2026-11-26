import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

// Provider-agnostic LLM interface. Agents depend on this, never on a vendor —
// so the reasoning layer is replaceable (a stated project requirement).
export interface LLMProvider {
  name: string;
  complete(req: { system?: string; prompt: string; maxTokens?: number }): Promise<string>;
}

class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic;
  private model: string;
  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }
  async complete({ system, prompt, maxTokens = 1024 }: { system?: string; prompt: string; maxTokens?: number }) {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    };
    // Keep worker calls cheap: low effort on the structured extraction tasks.
    (params as unknown as Record<string, unknown>).output_config = { effort: "low" };
    const res = await this.client.messages.create(params);
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}

export const llm: LLMProvider | null =
  config.llm.provider === "anthropic" && config.llm.apiKey
    ? new AnthropicProvider(config.llm.apiKey, config.llm.model)
    : null;

export const llmLive = llm !== null;

// Pull the first JSON object/array out of a model response (tolerant of prose).
function extractJson<T>(text: string): T | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  for (let end = text.length; end > start; end--) {
    const slice = text.slice(start, end);
    try {
      return JSON.parse(slice) as T;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

// reason() is the single call-site the agents use. In mock mode (no key) it
// returns the agent's synthetic fallback, so the full pipeline still runs. In
// live mode it genuinely reasons and parses JSON, falling back on any failure.
export async function reason<T>(args: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  fallback: T;
}): Promise<T> {
  if (!llm) return args.fallback;
  try {
    const txt = await llm.complete({ system: args.system, prompt: args.prompt, maxTokens: args.maxTokens });
    return extractJson<T>(txt) ?? args.fallback;
  } catch (err) {
    console.warn("[llm] reason failed, using fallback:", (err as Error).message);
    return args.fallback;
  }
}
