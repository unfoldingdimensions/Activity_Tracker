#!/usr/bin/env node
/**
 * Attribute the WebView2 footprint: which window holds the memory, and what it is holding.
 *
 * Phase T0.2 of the revised memory plan (D-033). The app's own harness measures *how much*
 * Private Working Set the webviews take (215 MB on 2026-11-01, up 98 MB since August); it
 * cannot say which window or which object graph. This does:
 *
 *   - per renderer: JS heap used, DOM nodes, JS listeners (Memory.getDOMCounters)
 *   - per renderer: the biggest allocators by self size, from a sampling heap profile
 *
 * The renderer must be started with a debugging port. Set it for one launch, no code change:
 *
 *   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
 *   Start-Process "C:\Users\<you>\AppData\Local\Activity Tracker v2\activity-tracker-v2.exe"
 *   node scripts/webview-heap.mjs
 *
 * Then run it in each UI state (idle-hidden / dashboard-visible / timeline-visible) — a
 * number without its state is not comparable, same rule as mem-snapshot.ps1.
 */
import process from "node:process";

const PORT = Number(argValue("--port", process.env.CDP_PORT ?? 9222));
const TOP = Number(argValue("--top", 8));
const SAMPLE_MS = Number(argValue("--sample-ms", 1500));
const AS_JSON = process.argv.includes("--json");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      const resolve = this.pending.get(msg.id);
      if (!resolve) return;
      this.pending.delete(msg.id);
      msg.error ? resolve.reject(new Error(msg.error.message)) : resolve.resolve(msg.result);
    });
  }

  static connect(url, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("websocket timeout")); }, timeoutMs);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(new Cdp(ws)); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("websocket error")); }, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 10000);
    });
  }

  close() { try { this.ws.close(); } catch {} }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (bytes) => (bytes / 1048576).toFixed(1);

/** Sum sampled bytes by call-frame name, using the profile's sample list (selfSize is 0 while idle). */
function topAllocators(profile, limit) {
  const names = new Map();
  const stack = [profile.head];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    names.set(
      node.id,
      node.callFrame?.functionName?.trim() || node.callFrame?.url?.split("/").pop() || "(anonymous)",
    );
    for (const child of node.children ?? []) stack.push(child);
  }

  const totals = new Map();
  let sampled = 0;
  for (const sample of profile.samples ?? []) {
    const name = names.get(sample.nodeId) ?? "(unknown)";
    totals.set(name, (totals.get(name) ?? 0) + sample.size);
    sampled += sample.size;
  }
  return {
    sampled,
    top: [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit),
  };
}

async function main() {
  let targets;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    targets = (await res.json()).filter((t) => t.type === "page" || t.type === "webview");
  } catch {
    console.error(`no CDP endpoint on 127.0.0.1:${PORT}.`);
    console.error(`launch the app once with: $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=${PORT}"`);
    return 2;
  }

  if (targets.length === 0) {
    console.error("CDP answered but exposed no page targets — the window may still be starting.");
    return 3;
  }

  const report = [];
  for (const target of targets) {
    const client = await Cdp.connect(target.webSocketDebuggerUrl);
    const entry = { title: target.title, url: target.url };
    try {
      await client.send("Runtime.enable");
      await client.send("HeapProfiler.enable");

      const heap = await client.send("Runtime.getHeapUsage");
      const dom = await client.send("Memory.getDOMCounters");
      entry.heapUsedMb = Number(mb(heap.usedSize));
      entry.heapTotalMb = Number(mb(heap.totalSize));
      entry.documents = dom.documents;
      entry.nodes = dom.nodes;
      entry.listeners = dom.jsEventListeners;

      await client.send("HeapProfiler.startSampling", { samplingInterval: 32768 });
      await sleep(SAMPLE_MS);
      const { profile } = await client.send("HeapProfiler.stopSampling");
      const { sampled, top } = topAllocators(profile, TOP);
      entry.sampledMb = Number(mb(sampled));
      entry.top = top.map(([name, size]) => ({ name, mb: Number(mb(size)) }));
    } finally {
      client.close();
    }
    report.push(entry);
  }

  if (AS_JSON) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  for (const e of report) {
    console.log(`\n${e.title || "(untitled)"}  —  ${e.url}`);
    console.log(`  JS heap ${e.heapUsedMb} MB used / ${e.heapTotalMb} MB committed`);
    console.log(`  DOM ${e.documents} documents, ${e.nodes} nodes, ${e.listeners} listeners`);
    if (e.sampledMb < 0.064) {
      console.log(`  sampling profile: ${e.sampledMb} MB sampled — the renderer is idle, so there is nothing to`);
      console.log("  attribute. Run this again while performing the action you are measuring.");
    } else {
      console.log(`  sampled allocations (${e.sampledMb} MB total):`);
      for (const t of e.top) console.log(`    ${String(t.mb).padStart(6)} MB  ${t.name}`);
    }
  }
  console.log("\nCompare states: idle-hidden → dashboard-visible → timeline-visible.");
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
