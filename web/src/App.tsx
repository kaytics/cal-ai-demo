import { useState } from "react";
import { EventType } from "@ag-ui/core";
import { streamAgui, type AguiEvent } from "./agui";

// One hardcoded query (#12 proves the live pipe, not the UI). A side setback of
// 4ft trips the state-preemption COMPUTED path in the golden slice.
const QUERY = {
  tool_name: "rules_check_setbacks",
  arguments: { setback: "side", proposed_ft: 4 },
  intro: "Checking the applicable setback rule…",
};

type Row = { seq: number; type: string; event: AguiEvent };

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRows([]);
    setError(null);
    setRunning(true);
    try {
      let seq = 0;
      for await (const event of streamAgui(QUERY)) {
        setRows((prev) => [...prev, { seq: seq++, type: event.type, event }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 820, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>AG-UI stream — raw events</h1>
      <p style={{ color: "#555" }}>
        POSTs <code>{QUERY.tool_name}</code> to the live Python shell via the dev proxy and lists each
        event as it streams. Known channels are tagged so the split is visible.
      </p>
      <button onClick={run} disabled={running} style={{ padding: "0.5rem 1rem", fontSize: 16 }}>
        {running ? "Streaming…" : "Run query"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      <ol style={{ marginTop: "1.5rem", paddingLeft: 0, listStyle: "none" }}>
        {rows.map((r) => (
          <li key={r.seq} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem 0.75rem", marginBottom: 8 }}>
            <strong>{r.type}</strong> {channelTag(r.type)}
            <pre style={{ margin: "0.4rem 0 0", whiteSpace: "pre-wrap", fontSize: 13, color: "#333" }}>
              {JSON.stringify(r.event, null, 2)}
            </pre>
          </li>
        ))}
      </ol>
    </main>
  );
}

function channelTag(type: string) {
  if (type === EventType.TOOL_CALL_RESULT) return <em style={{ color: "#0a7" }}>← verdict channel</em>;
  if (
    type === EventType.TEXT_MESSAGE_START ||
    type === EventType.TEXT_MESSAGE_CONTENT ||
    type === EventType.TEXT_MESSAGE_END
  )
    return <em style={{ color: "#06c" }}>← prose channel</em>;
  return null;
}
