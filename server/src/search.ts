import { config } from "./config.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  name: string;
  query(q: string, max?: number): Promise<SearchResult[]>;
}

// Tavily: a simple REST search API with a free tier. Real web discovery.
class TavilyProvider implements SearchProvider {
  name = "tavily";
  constructor(private key: string) {}
  async query(q: string, max = 6): Promise<SearchResult[]> {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: this.key, query: q, max_results: max, search_depth: "basic" }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> };
      return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 280) ?? "" }));
    } catch (err) {
      console.warn("[search] tavily failed:", (err as Error).message);
      return [];
    }
  }
}

// Mock: synthetic-but-structured candidates so the discovery pipeline runs
// end-to-end with no key. Same shape the live provider returns.
const BRANDS = ["Nebula", "Orbit", "Vertex", "Helio", "Quanta", "Axiom", "Pulse", "Cobalt", "Zephyr", "Lumen"];
const KINDS = [
  "reward epoch",
  "testnet incentive",
  "retroactive funding round",
  "liquidity program",
  "critical bug bounty",
  "ecosystem grant wave",
  "points campaign",
  "referral multiplier",
];
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

class MockSearch implements SearchProvider {
  name = "mock";
  async query(q: string, max = 4): Promise<SearchResult[]> {
    const n = 1 + Math.floor(Math.random() * max);
    const out: SearchResult[] = [];
    for (let i = 0; i < n; i++) {
      const brand = pick(BRANDS);
      const kind = pick(KINDS);
      out.push({
        title: `${brand} ${kind}`,
        url: `https://example.org/${brand.toLowerCase()}/${kind.replace(/\s+/g, "-")}`,
        snippet: `${brand} announced a ${kind} relevant to "${q}". Participation and reward details pending verification.`,
      });
    }
    return out;
  }
}

export const search: SearchProvider =
  config.search.provider === "tavily" && config.search.tavilyKey
    ? new TavilyProvider(config.search.tavilyKey)
    : new MockSearch();
