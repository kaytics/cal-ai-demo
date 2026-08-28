// GENERATED - do not edit. Source: utils.contract (uv run export-schema).
import { z } from "zod";

export const Authority = z.object({
  cite: z.string(),
  kind: z.enum(["statute", "guidance", "local_code"]),
  url: z.string().optional(),
}).strict();
export const Version = z.object({
  image: z.string(),
  ruleset: z.string().optional(),
  corpus: z.string().optional(),
  fixtures: z.string().optional(),
}).strict();
export const AbstainResult = z.object({
  tool: z.string(),
  version: Version,
  timestamp: z.string(),
  authority: z.array(Authority).optional(),
  verdict: z.literal("insufficient_input"),
  responseMode: z.literal("ABSTAIN"),
  missing: z.array(z.string()).min(1),
}).strict();
export const PreemptionSide = z.object({
  value: z.number(),
  authority: Authority,
}).strict();
export const Preemption = z.object({
  local: PreemptionSide,
  controlling: PreemptionSide,
  note: z.string(),
}).strict();
export const TraceStep = z.object({
  label: z.string(),
  expression: z.string(),
  value: z.union([z.number(), z.string()]),
}).strict();
export const ComputedResult = z.object({
  tool: z.string(),
  version: Version,
  timestamp: z.string(),
  authority: z.array(Authority).optional(),
  verdict: z.enum(["pass", "fail"]),
  responseMode: z.enum(["COMPUTED", "MIXED"]),
  proposed: z.number(),
  required: z.number(),
  margin: z.number(),
  trace: z.array(TraceStep).min(1),
  preemption: Preemption.optional(),
}).strict();
export const SourcedResult = z.object({
  tool: z.string(),
  version: Version,
  timestamp: z.string(),
  authority: z.array(Authority).optional(),
  verdict: z.literal("answered"),
  responseMode: z.enum(["SOURCED", "MIXED"]),
  answer: z.string(),
  citations: z.array(Authority).min(1),
}).strict();

export const ToolResult = z.discriminatedUnion("verdict", [AbstainResult, ComputedResult, SourcedResult]);
export type ToolResult = z.infer<typeof ToolResult>;
