import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { streamAgui } from "./agui";
import { Prose } from "./Prose";
import { ToolCallWidget } from "./ToolCallWidget";
import { Inspector } from "./Inspector";
import { emptyChannels, reduceChannel, type ChannelState, type ToolCallItem } from "./channels";

// Example prompts that prefill the Ask box — the backend plans the tool call
// from the natural-language message. The first trips the state-preemption
// COMPUTED path (side/4); the second omits a distance, so the planner passes
// args through and the tool returns the honest ABSTAIN (must-survive Q2).
const EXAMPLES = [
  "Is a 4 ft side setback OK on this lot?",
  "Is the front setback compliant?",
] as const;

type Turn = { id: number; question: string; channels: ChannelState; running: boolean };

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [inspecting, setInspecting] = useState<ToolCallItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);

  const running = turns.some((t) => t.running);

  async function run(message: string) {
    const question = message.trim();
    if (!question || running) return;
    const id = nextId.current++;
    setError(null);
    setDraft("");
    setTurns((prev) => [...prev, { id, question, channels: emptyChannels, running: true }]);
    const patch = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    try {
      for await (const event of streamAgui({ message: question })) {
        // Route EVERY event through the single channel reducer — the split
        // (prose vs tool/verdict) is decided there, not by ad-hoc checks here.
        patch((t) => ({ ...t, channels: reduceChannel(t.channels, event) }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      patch((t) => ({ ...t, running: false }));
    }
  }

  return (
    <div style={appStyle}>
      <header style={topbarStyle}>
        <span style={brandStyle}>
          <span style={sealStyle}>CA</span> Permit Copilot <small style={{ color: "#8a94a6", fontWeight: 500 }}>/ Demo City</small>
        </span>
      </header>

      <main style={scrollStyle}>
        <div style={threadStyle}>
          {turns.length === 0 && (
            <p style={{ color: "#8a94a6", textAlign: "center" }}>
              Ask a setback question below to start the thread.
            </p>
          )}
          {turns.map((turn) => (
            <TurnView key={turn.id} turn={turn} onInspect={setInspecting} />
          ))}
          {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
        </div>
      </main>

      <footer style={askwrapStyle}>
        <div style={askcolStyle}>
          <div style={chipsStyle}>
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setDraft(ex)} disabled={running} style={chipStyle}>
                {ex}
              </button>
            ))}
          </div>
          <form
            style={askbarStyle}
            onSubmit={(e) => {
              e.preventDefault();
              run(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={running}
              placeholder="Ask a setback question…"
              aria-label="Ask a setback question"
              style={inputStyle}
            />
            <button type="submit" disabled={running || draft.trim() === ""} style={sendStyle}>
              {running ? "Streaming…" : "Send"}
            </button>
          </form>
        </div>
      </footer>

      <Inspector item={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}

function TurnView({ turn, onInspect }: { turn: Turn; onInspect: (item: ToolCallItem) => void }) {
  const items = turn.channels.timeline;
  return (
    <div style={turnStyle}>
      <div style={userqStyle}>{turn.question}</div>
      <div style={assistantStyle}>
        <div style={avatarStyle}>CP</div>
        <div style={abodyStyle}>{renderTimeline(items, turn.running, onInspect)}</div>
      </div>
    </div>
  );
}

// Walk the timeline, grouping consecutive tool items onto one sequence rail so
// the tool calls read in order between the surrounding prose.
function renderTimeline(
  items: ChannelState["timeline"],
  running: boolean,
  onInspect: (item: ToolCallItem) => void,
): ReactNode[] {
  const out: ReactNode[] = [];
  let rail: ToolCallItem[] = [];
  const flush = () => {
    if (rail.length === 0) return;
    const group = rail;
    rail = [];
    out.push(
      <div key={`rail-${out.length}`} style={railStyle}>
        {group.map((item) => (
          <ToolCallWidget key={item.toolCallId} item={item} onInspect={onInspect} />
        ))}
      </div>,
    );
  };

  items.forEach((item, i) => {
    if (item.kind === "tool") {
      rail.push(item);
    } else {
      flush();
      out.push(
        <Prose key={`prose-${i}`} text={item.text} streaming={running && i === items.length - 1} />,
      );
    }
  });
  flush();
  return out;
}

const appStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  background: "#eaeef4",
  color: "#101623",
};

const topbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 20px",
  borderBottom: "1px solid #d6dce8",
  background: "#fff",
  position: "sticky",
  top: 0,
  zIndex: 5,
};

const brandStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontWeight: 640 };

const sealStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  background: "linear-gradient(150deg, #2f4fd6, #24308a)",
  display: "grid",
  placeItems: "center",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const scrollStyle: CSSProperties = { flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "26px 16px 22px" };

const threadStyle: CSSProperties = { width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 22 };

const turnStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

const userqStyle: CSSProperties = {
  alignSelf: "flex-end",
  background: "#2f4fd6",
  color: "#fff",
  padding: "9px 14px",
  borderRadius: "14px 14px 4px 14px",
  fontSize: 14.5,
  maxWidth: "82%",
};

const assistantStyle: CSSProperties = { display: "flex", gap: 12 };

const avatarStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  background: "#e6ebfd",
  color: "#2f4fd6",
  display: "grid",
  placeItems: "center",
  fontWeight: 800,
  fontSize: 12,
  flex: "none",
};

const abodyStyle: CSSProperties = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 };

const railStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 9,
  borderLeft: "2px solid #d6dce8",
  paddingLeft: 12,
  marginLeft: 4,
};

const askwrapStyle: CSSProperties = {
  padding: "14px 16px 20px",
  display: "flex",
  justifyContent: "center",
  position: "sticky",
  bottom: 0,
  background: "linear-gradient(transparent, #eaeef4 34%)",
};

const askcolStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: "100%",
  maxWidth: 760,
};

const chipsStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const chipStyle: CSSProperties = {
  font: "inherit",
  fontWeight: 500,
  fontSize: 12.5,
  color: "#31415f",
  background: "#f4f7fb",
  border: "1px solid #c2cad9",
  borderRadius: 999,
  padding: "5px 12px",
  cursor: "pointer",
};

const askbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  width: "100%",
  padding: "12px 16px",
  border: "1px solid #c2cad9",
  borderRadius: 11,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,22,35,.06)",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  font: "inherit",
  fontSize: 14.5,
  color: "#101623",
  border: 0,
  outline: "none",
  background: "transparent",
};

const sendStyle: CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  fontSize: 13,
  color: "#fff",
  background: "#2f4fd6",
  border: 0,
  borderRadius: 8,
  padding: "7px 14px",
  cursor: "pointer",
};
