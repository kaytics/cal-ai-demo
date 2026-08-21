import { useState } from "react";

// SKELETON (chunk-01 #6): chat thread + inline collapsible tool-call widgets +
// Drawer inspector. This scaffold proves the SSE round-trip end-to-end; the real
// verdict card / trace panel / drawer land in the scenario chunks.
//
// After-parse validation gate (ADR-0001 §4): once `npm run gen` has produced
// ../contract/zod/tool-result.ts, import `toResultSchema` and .parse() the
// TOOL_CALL_RESULT.content before rendering. Left as a TODO so the app builds
// before the contract is generated.

interface Frame {
  kind: string;
  detail: string;
}

export function App() {
  const [setback, setSetback] = useState("side");
  const [proposedFt, setProposedFt] = useState(4);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setFrames([]);
    const res = await fetch("/agui/run", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        tool_name: "rules.check_setbacks",
        arguments: { setback, proposed_ft: proposedFt },
        intro: `Checking the ${setback} setback…`,
      }),
    });
    const reader = res.body?.getReader();
    if (!reader) {
      setBusy(false);
      return;
    }
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(5).trim()) as { type: string };
          setFrames((f) => [...f, { kind: evt.type, detail: line.slice(5).trim() }]);
        } catch {
          /* ignore keep-alives */
        }
      }
    }
    setBusy(false);
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "2rem auto" }}>
      <h1>CA AI Permitting — Showcase (scaffold)</h1>
      <p>Deterministic form mode → shell → agent → MCP → rules-core. Live AG-UI stream below.</p>
      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
        <label>
          Setback
          <select value={setback} onChange={(e) => setSetback(e.target.value)}>
            <option value="front">front</option>
            <option value="side">side</option>
            <option value="rear">rear</option>
          </select>
        </label>
        <label>
          Proposed (ft)
          <input
            type="number"
            value={proposedFt}
            onChange={(e) => setProposedFt(Number(e.target.value))}
          />
        </label>
        <button onClick={run} disabled={busy}>
          {busy ? "Running…" : "Check"}
        </button>
      </div>
      <ol>
        {frames.map((f, i) => (
          <li key={i}>
            <strong>{f.kind}</strong>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{f.detail}</pre>
          </li>
        ))}
      </ol>
    </main>
  );
}
