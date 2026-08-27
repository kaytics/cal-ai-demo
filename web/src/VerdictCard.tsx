// The structured verdict card (#13, must-survive Q1). Consumes a
// TOOL_CALL_RESULT.content string, validates it with the GENERATED contract
// (#11), and renders the COMPUTED variant discriminated on `verdict`.
//
// Numbers appear ONLY here, straight from the validated tool result — never
// synthesized in the UI. A payload that fails validation is surfaced as an
// error, never rendered as a verdict.

import type { CSSProperties } from "react";
import type { z } from "zod";
import { ToolResult } from "@contract";

type Result = z.infer<typeof ToolResult>;
type Computed = Extract<Result, { verdict: "pass" | "fail" }>;
type Abstain = Extract<Result, { verdict: "insufficient_input" }>;

function isComputed(r: Result): r is Computed {
  return r.verdict === "pass" || r.verdict === "fail";
}

export function VerdictCard({ content }: { content: string }) {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return <ErrorCard message="tool result was not valid JSON" />;
  }

  const parsed = ToolResult.safeParse(raw);
  if (!parsed.success) {
    return <ErrorCard message={`contract validation failed: ${parsed.error.issues[0]?.message ?? "invalid payload"}`} />;
  }

  const result = parsed.data;
  if (result.verdict === "insufficient_input") return <AbstainCard result={result} />;
  if (isComputed(result)) return <ComputedCard result={result} />;

  // SOURCED (corpus.*) gets its own card in a later chunk.
  return (
    <div style={cardStyle}>
      <em style={{ color: "#666" }}>{result.responseMode} result — rendered by a later card.</em>
    </div>
  );
}

function AbstainCard({ result }: { result: Abstain }) {
  // The honest refusal (must-survive Q2): no number is produced — the card
  // names exactly which fields the tool needed. `missing` is guaranteed
  // non-empty by the contract (.min(1)).
  return (
    <div style={cardStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={abstainBadgeStyle}>{result.responseMode}</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#556072" }}>Insufficient input</span>
      </header>
      <p style={{ margin: "0 0 10px", color: "#556072", fontSize: 14 }}>
        No verdict is produced. The tool needs the following before it can compute one:
      </p>
      <ul style={missingListStyle}>
        {result.missing.map((field) => (
          <li key={field} style={missingRowStyle}>
            <span style={needsTagStyle}>needs</span>
            <code>{field}</code>
          </li>
        ))}
      </ul>
      <footer style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
        <div>Ruleset: {result.version.ruleset ?? "—"}</div>
      </footer>
    </div>
  );
}

function ComputedCard({ result }: { result: Computed }) {
  const pass = result.verdict === "pass";
  return (
    <div style={cardStyle}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={badgeStyle}>{result.responseMode}</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: pass ? "#0a7a3f" : "#c0392b",
          }}
        >
          {pass ? "PASS" : "FAIL"}
        </span>
      </header>

      <dl style={numbersStyle}>
        <Metric label="Proposed" value={`${result.proposed} ft`} />
        <Metric label="Required" value={`${result.required} ft`} />
        <Metric label="Margin" value={`${result.margin >= 0 ? "+" : ""}${result.margin} ft`} />
      </dl>

      {result.preemption && (
        <section style={preemptionStyle}>
          <strong style={{ display: "block", marginBottom: 4 }}>State preemption applied</strong>
          <div>
            Local: {result.preemption.local.value} ft (<cite>{result.preemption.local.authority.cite}</cite>)
          </div>
          <div>
            Controlling: {result.preemption.controlling.value} ft (
            <cite>{result.preemption.controlling.authority.cite}</cite>)
          </div>
          <p style={{ margin: "6px 0 0", color: "#555" }}>{result.preemption.note}</p>
        </section>
      )}

      <footer style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
        {result.authority && result.authority.length > 0 && (
          <div>
            Authority: {result.authority.map((a) => a.cite).join("; ")}
          </div>
        )}
        <div>Ruleset: {result.version.ruleset ?? "—"}</div>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{value}</dd>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div style={{ ...cardStyle, borderColor: "#e0b4b4", background: "#fdf3f3" }}>
      <strong style={{ color: "crimson" }}>Invalid tool result</strong>
      <p style={{ margin: "4px 0 0", color: "#a33" }}>{message}</p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #d7dde3",
  borderRadius: 10,
  padding: "1rem 1.25rem",
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

// Shared badge geometry; each variant overrides only its colors.
const badgeBase: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  borderRadius: 999,
  padding: "2px 10px",
};

const badgeStyle: CSSProperties = {
  ...badgeBase,
  color: "#0a58ca",
  background: "#e7f0ff",
  border: "1px solid #b6d0ff",
};

const abstainBadgeStyle: CSSProperties = {
  ...badgeBase,
  color: "#64708a",
  background: "#eaedf3",
  border: "1px solid #d3d9e4",
};

const missingListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const missingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "ui-monospace, monospace",
  fontSize: 13,
};

const needsTagStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#64708a",
  border: "1px solid #64708a",
  borderRadius: 4,
  padding: "1px 5px",
};

const numbersStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  margin: 0,
};

const preemptionStyle: CSSProperties = {
  marginTop: 12,
  padding: "0.6rem 0.8rem",
  background: "#fff8e6",
  border: "1px solid #f0e0a8",
  borderRadius: 8,
  fontSize: 14,
};
