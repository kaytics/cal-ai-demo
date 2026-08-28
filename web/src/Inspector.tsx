// The Drawer trace inspector (#16, variant A). Opened by a widget's "Inspect"
// action, it slides in from the right and renders the DEEP view of one tool
// call: the verdict card, the structured `trace` steps (the thing the inline
// widget omits), the request arguments, and the raw TOOL_CALL_RESULT.content.
//
// The trace comes from the validated ComputedResult — the same fail-closed parse
// the card uses — so a number appears here only after passing the contract.

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { VerdictCard } from "./VerdictCard";
import { parseToolResult, isComputed } from "./toolResult";
import type { ToolCallItem } from "./channels";

export function Inspector({ item, onClose }: { item: ToolCallItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const parsed = item.content ? parseToolResult(item.content) : null;
  const trace = parsed && parsed.ok && isComputed(parsed.result) ? parsed.result.trace : null;

  return (
    <>
      <div style={scrimStyle} onClick={onClose} data-testid="inspector-scrim" />
      <aside style={drawerStyle} role="dialog" aria-label="Inspector">
        <header style={headStyle}>
          <code style={toolStyle}>{item.toolName || "tool"}</code>
          <button type="button" onClick={onClose} aria-label="Close inspector" style={closeStyle}>
            ×
          </button>
        </header>

        {item.content && <VerdictCard content={item.content} />}

        {trace && (
          <section style={sectionStyle}>
            <div style={eyebrowStyle}>Computation trace · {trace.length} steps</div>
            <ol style={traceListStyle}>
              {trace.map((step, i) => (
                <li key={i} style={traceRowStyle}>
                  <span style={traceLabelStyle}>{step.label}</span>
                  <code style={traceExprStyle}>{step.expression}</code>
                  <span style={traceValueStyle}>{String(step.value)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section style={sectionStyle}>
          <div style={eyebrowStyle}>Arguments</div>
          <pre style={preStyle}>{formatArgs(item.argsJson)}</pre>
        </section>

        <section style={sectionStyle}>
          <div style={eyebrowStyle}>Raw TOOL_CALL_RESULT.content</div>
          <pre style={preStyle}>{formatArgs(item.content ?? "")}</pre>
          <p style={{ fontSize: 11.5, color: "#8a94a6", margin: "7px 0 0" }}>
            This string is the only channel a number travels on — prose never carries it.
          </p>
        </section>
      </aside>
    </>
  );
}

function formatArgs(json: string): string {
  if (!json) return "—";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

const scrimStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(10,14,22,.42)",
  zIndex: 40,
};

const drawerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: "min(440px, 92vw)",
  background: "#fff",
  borderLeft: "1px solid #d6dce8",
  boxShadow: "0 2px 6px rgba(16,22,35,.08), 0 24px 50px -18px rgba(16,22,35,.34)",
  zIndex: 41,
  overflow: "auto",
  padding: "18px 20px",
  boxSizing: "border-box",
};

const headStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const toolStyle: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontWeight: 600,
  fontSize: 13,
  color: "#101623",
};

const closeStyle: CSSProperties = {
  font: "inherit",
  border: 0,
  background: "transparent",
  color: "#556072",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
  width: 30,
  height: 30,
  borderRadius: 7,
};

const sectionStyle: CSSProperties = { marginTop: 18 };

const eyebrowStyle: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#8a94a6",
  marginBottom: 8,
};

const traceListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  counterReset: "s",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const traceRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gridTemplateAreas: '"label value" "expr expr"',
  gap: "2px 10px",
  padding: "8px 10px",
  border: "1px solid #eef1f6",
  borderRadius: 8,
  background: "#f4f7fb",
};

const traceLabelStyle: CSSProperties = { gridArea: "label", fontSize: 12, fontWeight: 600, color: "#101623" };
const traceValueStyle: CSSProperties = {
  gridArea: "value",
  fontFamily: "ui-monospace, monospace",
  fontSize: 13,
  fontWeight: 700,
  color: "#2f4fd6",
};
const traceExprStyle: CSSProperties = {
  gridArea: "expr",
  fontFamily: "ui-monospace, monospace",
  fontSize: 11.5,
  color: "#556072",
};

const preStyle: CSSProperties = {
  margin: 0,
  padding: "11px 12px",
  background: "#f4f7fb",
  border: "1px solid #d6dce8",
  borderRadius: 8,
  fontFamily: "ui-monospace, monospace",
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "#101623",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
};
