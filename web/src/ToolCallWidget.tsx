// The inline collapsible tool-call widget (#16). One node on the assistant
// turn's sequence rail: a collapsed head (badge · tool name · one-line summary ·
// Inspect) that expands to reveal the verdict card. The "Inspect" action opens
// the drawer inspector (structured trace) — handled by the parent via onInspect.
//
// The widget reuses VerdictCard (#13/#15) for the expanded verdict; it does NOT
// re-render numbers itself. It reads the badge/summary from the same validated
// parse, so a payload that fails the contract collapses to an error head.

import { useState } from "react";
import type { CSSProperties } from "react";
import { VerdictCard } from "./VerdictCard";
import { parseToolResult, summarize } from "./toolResult";
import type { ToolCallItem } from "./channels";

export function ToolCallWidget({
  item,
  onInspect,
}: {
  item: ToolCallItem;
  onInspect: (item: ToolCallItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = item.content ? parseToolResult(item.content) : null;

  const badge = badgeFor(parsed);
  const summary = summaryFor(parsed, item);
  const done = item.content !== null;

  return (
    <div style={rowStyle}>
      <span style={done ? dotDoneStyle : dotStyle} aria-hidden="true" />
      <div style={cardStyle} data-tc={item.toolCallId}>
        <div style={headStyle}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={headButtonStyle}
          >
            <span style={badge.style}>{badge.label}</span>
            <code style={toolStyle}>{item.toolName || "tool"}</code>
            <span style={summaryStyle}>{summary}</span>
            <span style={{ ...chevStyle, transform: open ? "rotate(90deg)" : "none" }} aria-hidden="true">
              ▸
            </span>
          </button>
          {done && (
            <button type="button" onClick={() => onInspect(item)} style={inspectStyle} title="Open inspector">
              Inspect ↗
            </button>
          )}
        </div>
        {open && (
          <div style={bodyStyle}>
            {item.content ? (
              <VerdictCard content={item.content} />
            ) : (
              <p style={{ margin: 0, color: "#8a94a6", fontSize: 13 }}>Calling tool…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function badgeFor(parsed: ReturnType<typeof parseToolResult> | null): {
  label: string;
  style: CSSProperties;
} {
  if (!parsed) return { label: "RUNNING", style: runningBadge };
  if (!parsed.ok) return { label: "ERROR", style: errorBadge };
  return { label: parsed.result.responseMode, style: badgeFor2(parsed.result.responseMode) };
}

function badgeFor2(mode: string): CSSProperties {
  return mode === "ABSTAIN" ? abstainBadge : computedBadge;
}

function summaryFor(parsed: ReturnType<typeof parseToolResult> | null, item: ToolCallItem): string {
  if (!parsed) return item.argsJson ? "…" : "";
  if (!parsed.ok) return parsed.error;
  return summarize(parsed.result);
}

const rowStyle: CSSProperties = { display: "flex", gap: 12, position: "relative", alignItems: "flex-start" };

const dotBase: CSSProperties = {
  flex: "none",
  width: 10,
  height: 10,
  marginTop: 15,
  borderRadius: "50%",
  background: "#fff",
  border: "2px solid #c2cad9",
};
const dotStyle: CSSProperties = dotBase;
const dotDoneStyle: CSSProperties = { ...dotBase, borderColor: "#2f4fd6" };

const cardStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid #d6dce8",
  borderRadius: 11,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(16,22,35,.06)",
  overflow: "hidden",
};

const headStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" };

const headButtonStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 0,
  border: 0,
  background: "transparent",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
};

const toolStyle: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#101623",
};

const summaryStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  color: "#556072",
  fontSize: 13,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chevStyle: CSSProperties = { color: "#8a94a6", fontSize: 12, transition: "transform .18s ease" };

const inspectStyle: CSSProperties = {
  flex: "none",
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 560,
  borderRadius: 8,
  padding: "4px 9px",
  cursor: "pointer",
  border: "1px solid #c2cad9",
  background: "#f4f7fb",
  color: "#101623",
};

const bodyStyle: CSSProperties = { padding: "0 10px 12px", borderTop: "1px solid #eef1f6" };

const badgeBase: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  padding: "2px 7px",
  borderRadius: 999,
  textTransform: "uppercase",
  flex: "none",
};
const computedBadge: CSSProperties = { ...badgeBase, color: "#2f4fd6", background: "#e7ecfe" };
const abstainBadge: CSSProperties = { ...badgeBase, color: "#64708a", background: "#eaedf3" };
const runningBadge: CSSProperties = { ...badgeBase, color: "#8a94a6", background: "#eef1f6" };
const errorBadge: CSSProperties = { ...badgeBase, color: "#c0392b", background: "#fdecec" };
