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
  if (!isComputed(result)) {
    // Other variants (ABSTAIN #15, SOURCED) get their own cards; out of scope for #13.
    return (
      <div style={cardStyle}>
        <em style={{ color: "#666" }}>
          {result.responseMode} result — rendered by a later card ({result.verdict}).
        </em>
      </div>
    );
  }

  return <ComputedCard result={result} />;
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

const badgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: "#0a58ca",
  background: "#e7f0ff",
  border: "1px solid #b6d0ff",
  borderRadius: 999,
  padding: "2px 10px",
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
