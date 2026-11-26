import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { config, modeLabel } from "./config.js";
import { GviStore } from "./store.js";
import { startOrchestrator } from "./orchestrator.js";
import { makeTelegram } from "./telegram.js";
import type { WireEvent } from "./types.js";

const store = new GviStore();
const telegram = makeTelegram();
store.onAlert = (a) => void telegram.send(a);

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, mode: modeLabel(), nodes: store.nodes.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: http });
wss.on("connection", (ws) => {
  const send = (e: WireEvent) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(e)); // 1 === OPEN
  };
  const unsub = store.onClient(send); // immediately sends a snapshot
  ws.on("close", unsub);
  ws.on("error", unsub);
});

const stop = startOrchestrator(store);

http.listen(config.port, () => {
  console.log(`\n  GVI backend  ·  ws://localhost:${config.port}`);
  console.log(`  mode: ${modeLabel()}  |  llm: ${config.llm.provider}  |  search: ${config.search.provider}  |  telegram: ${telegram.enabled ? "on" : "off"}`);
  console.log(`  data: ${config.dataDir}\n`);
});

const shutdown = () => {
  stop();
  wss.close();
  http.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
