import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { streamAgui } from "./agui";
import { Prose } from "./Prose";
import { ToolCallWidget } from "./ToolCallWidget";
import { Inspector } from "./Inspector";
import { emptyChannels, reduceChannel, type ChannelState, type ToolCallItem } from "./channels";

// Hardcoded demo queries (the live pipe, not NL planning). Each is one chat
// turn: a user question bubble followed by the assistant turn it triggers.
// `computed` trips the state-preemption COMPUTED path (side/4); `abstain` omits
// proposed_ft, so the backend returns the honest ABSTAIN (must-survive Q2).
const QUERIES = {
  computed: {
    question: "Is a 4 ft side setback OK on this lot?",
    tool_name: "rules_check_setbacks",
    arguments: { setback: "side", proposed_ft: 4 },
    intro: "Checking the applicable setback rule…",
  },
  abstain: {
    question: "And is the front setback compliant?",
    tool_name: "rules_check_setbacks",
    arguments: { setback: "front" },
    intro: "Checking the front setback…",
  },
} as const;

type QueryKey = keyof typeof QUERIES;

type Turn = { id: number; question: string; channels: ChannelState; running: boolean };

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [inspecting, setInspecting] = useState<ToolCallItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);

  const running = turns.some((t) => t.running);

  async function run(key: QueryKey) {
    const id = nextId.current++;
    setError(null);
    setTurns((prev) => [...prev, { id, question: QUERIES[key].question, channels: emptyChannels, running: true }]);
    const patch = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    try {
      for await (const event of streamAgui(QUERIES[key])) {
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
        <div style={askbarStyle}>
          <button onClick={() => run("computed")} disabled={running} style={sendStyle}>
            {running ? "Streaming…" : "Ask: side / 4 ft"}
          </button>
          <button onClick={() => run("abstain")} disabled={running} style={sendGhostStyle}>
            Ask: front (no distance)
          </button>
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

const askbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  width: "100%",
  maxWidth: 760,
  padding: "12px 16px",
  border: "1px solid #c2cad9",
  borderRadius: 11,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,22,35,.06)",
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

const sendGhostStyle: CSSProperties = {
  font: "inherit",
  fontWeight: 560,
  fontSize: 13,
  color: "#101623",
  background: "#f4f7fb",
  border: "1px solid #c2cad9",
  borderRadius: 8,
  padding: "7px 14px",
  cursor: "pointer",
};
