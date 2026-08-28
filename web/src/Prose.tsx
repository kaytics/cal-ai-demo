// The prose pane (#14). It renders narration text and ONLY text — its single
// prop is a plain string. There is no path by which a verdict payload could be
// handed to it, which is the structural half of the channel-split invariant
// (the other half lives in channels.ts, which only ever fills prose from
// TEXT_MESSAGE_CONTENT deltas).

import type { CSSProperties } from "react";

export function Prose({ text, streaming = false }: { text: string; streaming?: boolean }) {
  if (!text && !streaming) return null;
  return (
    <p style={proseStyle} data-channel="prose">
      {text}
      {streaming && <span style={cursorStyle} aria-hidden="true" />}
    </p>
  );
}

const proseStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.55,
  color: "#334",
};

const cursorStyle: CSSProperties = {
  display: "inline-block",
  width: 7,
  height: 15,
  marginLeft: 2,
  verticalAlign: "text-bottom",
  background: "#2f4fd6",
  borderRadius: 1,
};
