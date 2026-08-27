// Shared parsing of a TOOL_CALL_RESULT.content string against the GENERATED
// contract (#11). One place validates; the widget, the card, and the inspector
// all consume the same fail-closed result — a number reaches the UI only after
// it has passed the strict Zod union.

import type { z } from "zod";
import { ToolResult } from "@contract";

export type Result = z.infer<typeof ToolResult>;
export type Computed = Extract<Result, { verdict: "pass" | "fail" }>;
export type Abstain = Extract<Result, { verdict: "insufficient_input" }>;

export type Parsed =
  | { ok: true; result: Result }
  | { ok: false; error: string };

export function parseToolResult(content: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return { ok: false, error: "tool result was not valid JSON" };
  }
  const parsed = ToolResult.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `contract validation failed: ${parsed.error.issues[0]?.message ?? "invalid payload"}` };
  }
  return { ok: true, result: parsed.data };
}

export function isComputed(r: Result): r is Computed {
  return r.verdict === "pass" || r.verdict === "fail";
}

// A one-line summary for the collapsed widget head. Numbers come straight from
// the validated result — never synthesized.
export function summarize(r: Result): string {
  if (r.verdict === "insufficient_input") {
    const n = r.missing.length;
    return `Insufficient input · ${n} field${n === 1 ? "" : "s"} missing`;
  }
  if (isComputed(r)) {
    const label = r.verdict === "pass" ? "PASS" : "FAIL";
    return `${label} · ${r.proposed} ft proposed / ${r.required} ft required`;
  }
  return r.responseMode;
}
