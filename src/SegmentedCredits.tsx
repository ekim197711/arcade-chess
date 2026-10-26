const SEGMENTS = [
  "8,2 28,2 32,6 28,10 8,10 4,6",
  "30,12 34,8 34,30 30,34 26,30 26,16",
  "30,38 34,42 34,64 30,60 26,56 26,42",
  "8,62 28,62 32,66 28,70 8,70 4,66",
  "6,38 10,42 10,56 6,60 2,64 2,42",
  "6,12 10,16 10,30 6,34 2,30 2,8",
  "8,32 28,32 32,36 28,40 8,40 4,36",
];
const DIGITS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

/** Two physical seven-segment digits, including the dim, unlit LED bars. */
export function SegmentedCredits({ value }: { value: number }) {
  const digits = String(Math.min(99, Math.max(0, Math.floor(value)))).padStart(2, "0");
  return <svg className="segmented-credits" viewBox="0 0 82 72" aria-hidden="true" focusable="false">
    {[...digits].map((digit, index) => <g key={index} transform={`translate(${index * 46}, 0)`}>
      {SEGMENTS.map((points, segment) => <polygon key={segment} points={points}
        className={DIGITS[Number(digit)].includes("abcdefg"[segment]) ? "credit-segment-lit" : "credit-segment-unlit"} />)}
    </g>)}
  </svg>;
}
