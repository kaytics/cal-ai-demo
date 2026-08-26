import { useState } from "react";
import type { CSSProperties } from "react";
import { EventType } from "@ag-ui/core";
import { streamAgui, type AguiEvent } from "./agui";
import { VerdictCard } from "./VerdictCard";
import { Prose } from "./Prose";
import { emptyChannels, reduceChannel, type ChannelState } from "./channels";

// One hardcoded query (#12 proves the live pipe). A side setback of 4ft trips
// the state-preemption COMPUTED path in the golden slice.
const QUERY = {
  tool_name: "rules_check_setbacks",
  arguments: { setback: "side", proposed_ft: 4 },
  intro: "Checking the applicable setback rule…",
};

type Row = { seq: number; type: string; event: AguiEvent };

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [channels, setChannels] = useState<ChannelState>(emptyChannels);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRows([]);
    setChannels(emptyChannels);
    setError(null);
    setRunning(true);
    try {
      let seq = 0;
      for await (const event of streamAgui(QUERY)) {
        setRows((prev) => [...prev, { seq: seq++, type: event.type, event }]);
        // Route EVERY event through the single channel reducer — the split
        // (prose vs verdict) is decided there, not by ad-hoc checks here.
        setChannels((prev) => reduceChannel(prev, event));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 820, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Permit Copilot — channel split</h1>
      <p style={{ color: "#555" }}>
        POSTs <code>{QUERY.tool_name}</code> to the live Python shell. Narration prose and the
        structured verdict card are rendered from <strong>separate channels</strong> — a number can
        only reach the card, never the prose.
      </p>
      <button onClick={run} disabled={running} style={{ padding: "0.5rem 1rem", fontSize: 16 }}>
        {running ? "Streaming…" : "Run query"}
      </button>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {/* The composed assistant turn: prose and verdict interleaved in stream
          order, each item rendered by the component for its channel only. */}
      {channels.timeline.length > 0 && (
        <section style={turnStyle}>
          {channels.timeline.map((item, i) =>
            item.kind === "prose" ? (
              <Prose key={i} text={item.text} streaming={running && i === channels.timeline.length - 1} />
            ) : (
              <VerdictCard key={i} content={item.content} />
            ),
          )}
        </section>
      )}

      <h2 style={{ fontSize: 15, color: "#555", margin: "1.5rem 0 0.5rem" }}>Raw events</h2>
      <ol style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}>
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

const turnStyle: CSSProperties = {
  marginTop: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

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
