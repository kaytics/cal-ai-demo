// Real wire payloads (TOOL_CALL_RESULT.content) produced by the Python adapter,
// kept verbatim so tests assert against what the backend actually emits — the
// golden-payload convention (see VerdictCard.test.tsx / research #2).

// The golden `side/4` case: state preemption caps the local 5.0 ft minimum at
// 4.0 ft, so proposed and required are both 4 ft and the margin is 0.
export const COMPUTED_PREEMPTED = JSON.stringify({
  tool: "rules_check_setbacks",
  version: { image: "dev", ruleset: "demo-city-2026.08" },
  timestamp: "2026-08-26T17:36:22.850994+00:00",
  authority: [
    { cite: "Demo City Muni Code §12.04.030(B)", kind: "local_code" },
    { cite: "Cal. Gov. Code §66323(a)(1)", kind: "statute" },
  ],
  verdict: "pass",
  responseMode: "COMPUTED",
  proposed: 4.0,
  required: 4.0,
  margin: 0.0,
  trace: [
    { label: "Local minimum", expression: "side setback ≥ 5.0 ft", value: 5.0 },
    { label: "State preemption", expression: "required = min(5.0, 4.0)", value: 4.0 },
    { label: "Margin", expression: "4.0 − 4.0", value: 0.0 },
  ],
  preemption: {
    local: { value: 5.0, authority: { cite: "Demo City Muni Code §12.04.030(B)", kind: "local_code" } },
    controlling: { value: 4.0, authority: { cite: "Cal. Gov. Code §66323(a)(1)", kind: "statute" } },
    note: "State law caps the required side setback at 4.0 ft, preempting the local 5.0 ft minimum.",
  },
});

// The golden ABSTAIN case (front setback with no proposed distance): the honest
// refusal names the exact missing field.
export const ABSTAIN = JSON.stringify({
  tool: "rules_check_setbacks",
  version: { image: "dev", ruleset: "demo-city-2026.08" },
  timestamp: "2026-08-27T08:23:52.711666+00:00",
  verdict: "insufficient_input",
  responseMode: "ABSTAIN",
  missing: ["proposed_ft"],
});
