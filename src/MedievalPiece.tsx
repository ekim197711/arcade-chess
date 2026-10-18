import type { CSSProperties } from "react";

export type MedievalPieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";

export const PIECE_THEMES = [
  { id: "candy", label: "Candy" },
  { id: "space", label: "Space" },
  { id: "kung-fu", label: "Kong fu" },
  { id: "cowboy", label: "Cowboy" },
  { id: "sport", label: "Sport" },
  { id: "urban", label: "Urban" },
] as const;

export type PieceTheme = (typeof PIECE_THEMES)[number]["id"];

type PieceFinish = {
  body: string;
  highlight: string;
  shade: string;
  outline: string;
  edge: string;
};

type PiecePalette = {
  light: PieceFinish;
  dark: PieceFinish;
  accents: Record<MedievalPieceType, string>;
};

type Props = {
  type: MedievalPieceType;
  color: PieceColor;
  theme?: PieceTheme;
  className?: string;
  style?: CSSProperties;
};

const PIECE_PALETTES: Record<PieceTheme, PiecePalette> = {
  candy: {
    light: {
      body: "#fff3fa",
      highlight: "#ffffff",
      shade: "#edbfdc",
      outline: "#914a78",
      edge: "#f3c2e1",
    },
    dark: {
      body: "#713568",
      highlight: "#e9a8d8",
      shade: "#4a244e",
      outline: "#321b38",
      edge: "#ad65a5",
    },
    accents: {
      p: "#f56eaa",
      n: "#67c8dc",
      b: "#b17ce0",
      r: "#f4bf58",
      q: "#ed6692",
      k: "#79bd91",
    },
  },
  space: {
    light: {
      body: "#fff6dc",
      highlight: "#ffffff",
      shade: "#c5d4f3",
      outline: "#203984",
      edge: "#d5e1f7",
    },
    dark: {
      body: "#3155b8",
      highlight: "#62dce8",
      shade: "#243d8e",
      outline: "#17265f",
      edge: "#3aa9ce",
    },
    accents: {
      p: "#9bcf3d",
      n: "#dc4bb5",
      b: "#29bcd0",
      r: "#9bcf3d",
      q: "#dc4bb5",
      k: "#29bcd0",
    },
  },
  "kung-fu": {
    light: {
      body: "#fff0d2",
      highlight: "#fff9e9",
      shade: "#d9ad68",
      outline: "#70412d",
      edge: "#d49b4a",
    },
    dark: {
      body: "#9b3432",
      highlight: "#f3a169",
      shade: "#612528",
      outline: "#3e1c23",
      edge: "#c65c3a",
    },
    accents: {
      p: "#d94c39",
      n: "#e3b044",
      b: "#50845c",
      r: "#e3b044",
      q: "#d94c39",
      k: "#f1c55c",
    },
  },
  cowboy: {
    light: {
      body: "#fff1d5",
      highlight: "#fffaf0",
      shade: "#d3b47b",
      outline: "#67462f",
      edge: "#bd8546",
    },
    dark: {
      body: "#624833",
      highlight: "#d4aa72",
      shade: "#3c2b24",
      outline: "#271d1a",
      edge: "#a46b39",
    },
    accents: {
      p: "#ad6738",
      n: "#638273",
      b: "#bd8d43",
      r: "#84533a",
      q: "#d0a64f",
      k: "#bf8241",
    },
  },
  sport: {
    light: {
      body: "#f6fbff",
      highlight: "#ffffff",
      shade: "#b9d8f2",
      outline: "#214b83",
      edge: "#5a91cb",
    },
    dark: {
      body: "#234782",
      highlight: "#85bded",
      shade: "#172f59",
      outline: "#101f3d",
      edge: "#d94b48",
    },
    accents: {
      p: "#ed584e",
      n: "#36a5c7",
      b: "#f2bd47",
      r: "#36a5c7",
      q: "#ed584e",
      k: "#f2bd47",
    },
  },
  urban: {
    light: {
      body: "#e9efec",
      highlight: "#ffffff",
      shade: "#b8c7c1",
      outline: "#344645",
      edge: "#44c4a0",
    },
    dark: {
      body: "#354344",
      highlight: "#91aaa0",
      shade: "#202b2d",
      outline: "#141c1d",
      edge: "#8ad95e",
    },
    accents: {
      p: "#8bd85e",
      n: "#57d8ce",
      b: "#e0bf4d",
      r: "#57d8ce",
      q: "#ed7294",
      k: "#8bd85e",
    },
  },
};

export function MedievalPiece({
  type,
  color,
  theme = "space",
  className,
  style,
}: Props) {
  const light = color === "w";
  const finish = light
    ? PIECE_PALETTES[theme].light
    : PIECE_PALETTES[theme].dark;
  const { body, highlight, shade, outline, edge } = finish;
  const accent = PIECE_PALETTES[theme].accents[type];
  const common = {
    stroke: outline,
    strokeWidth: 4,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  return (
    <svg
      className={`medieval-figure piece-${type} piece-theme-${theme} ${className ?? ""}`.trim()}
      style={style}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M23 84 H77 L81 91 V97 H19 V91Z" fill={edge} {...common} />
      <path
        d="M24 88 H76"
        fill="none"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="square"
      />
      <path d="M23 94 H77" fill="none" stroke={outline} strokeWidth="2" />

      {type === "p" && (
        <g {...common}>
          <path
            d="M39 48 Q34 51 33 58 L30 72 Q29 78 36 81 H64 Q71 78 70 72 L67 58 Q66 51 61 48 Q56 52 50 52 Q44 52 39 48Z"
            fill={body}
          />
          <path
            d="M36 67 Q50 72 64 67 L62 77 H38Z"
            fill={shade}
            stroke="none"
          />
          <circle cx="50" cy="33" r="13.5" fill={body} />
          <path
            d="M38 47 Q50 53 62 47 L65 53 Q50 60 35 53Z"
            fill={accent}
            stroke="none"
          />
          <path
            d="M42 30 Q45 25 50 24"
            fill="none"
            stroke={highlight}
            strokeWidth="4"
          />
        </g>
      )}

      {type === "n" && (
        <g {...common}>
          <path
            d="M34 82 L34 67 L30 51 L33 38 L42 43 L44 25 L50 34 L56 25 L58 43 L67 38 L70 51 L66 67 L66 82Z"
            fill={body}
          />
          <path
            d="M39 47 L43 40 L47 43 L45 58 L40 62Z"
            fill={shade}
            stroke="none"
          />
          <path
            d="M61 47 L57 40 L53 43 L55 58 L60 62Z"
            fill={shade}
            stroke="none"
          />
          <path
            d="M39 61 Q50 55 61 61 L60 70 Q50 77 40 70Z"
            fill={edge}
            stroke="none"
          />
          <path d="M39 52 H43 M57 52 H61" stroke={outline} strokeWidth="4" />
          <path
            d="M43 63 Q50 66 57 63"
            fill="none"
            stroke={accent}
            strokeWidth="4"
          />
        </g>
      )}

      {type === "b" && (
        <g {...common}>
          <path
            d="M36 82 Q37 68 43 59 L46 53 Q39 48 39 41 Q39 32 50 21 Q61 32 61 41 Q61 49 54 53 L58 60 Q64 69 64 82Z"
            fill={body}
          />
          <path
            d="M50 26 L54 39 L47 46 L53 52"
            fill="none"
            stroke={accent}
            strokeWidth="5"
          />
          <path
            d="M43 61 Q50 66 57 61"
            fill="none"
            stroke={shade}
            strokeWidth="4"
          />
          <path d="M41 75 H59" fill="none" stroke={highlight} strokeWidth="4" />
        </g>
      )}

      {type === "r" && (
        <g {...common}>
          <path
            d="M34 82 L36 51 H32 V31 H43 V39 H48 V26 H53 V39 H58 V31 H69 V51 H64 L66 82Z"
            fill={body}
          />
          <path d="M37 52 H63 V61 H37Z" fill={shade} stroke="none" />
          <path d="M38 53 H62" fill="none" stroke={accent} strokeWidth="5" />
          <path
            d="M43 63 V77 M50 63 V77 M57 63 V77"
            fill="none"
            stroke={highlight}
            strokeWidth="3"
          />
        </g>
      )}

      {type === "q" && (
        <g {...common}>
          <path
            d="M35 82 Q37 68 43 59 L40 50 L35 33 L46 42 L50 23 L55 42 L66 33 L60 51 L57 59 Q64 68 66 82Z"
            fill={body}
          />
          <path
            d="M35 33 L32 25 L40 30Z M50 23 V17 L55 25Z M66 33 L71 25 L69 36Z"
            fill={accent}
          />
          <path
            d="M41 53 Q50 58 59 53 L57 61 Q50 65 43 61Z"
            fill={shade}
            stroke="none"
          />
          <path d="M41 72 H59" fill="none" stroke={highlight} strokeWidth="4" />
        </g>
      )}

      {type === "k" && (
        <g {...common}>
          <path
            d="M36 82 Q37 68 43 59 L44 51 Q39 47 39 41 Q39 34 45 31 L45 27 H55 V31 Q61 34 61 41 Q61 48 56 51 L58 59 Q64 68 64 82Z"
            fill={body}
          />
          <path
            d="M43 53 Q50 58 57 53 L59 61 Q50 66 41 61Z"
            fill={shade}
            stroke="none"
          />
          <path
            d="M48 19 H52 V29 H60 V34 H52 V44 H48 V34 H40 V29 H48Z"
            fill={accent}
          />
          <path d="M43 73 H57" fill="none" stroke={highlight} strokeWidth="4" />
        </g>
      )}

      {theme === "candy" && (
        <g aria-hidden="true">
          <circle cx="43" cy="68" r="1.8" fill={accent} />
          <circle cx="58" cy="72" r="1.8" fill={highlight} />
          <path
            d="m49 64 2 3m-8 11 2-2m12-12 2-2"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      {theme === "space" && (
        <g aria-hidden="true" fill="none" stroke={accent} strokeWidth="1.8">
          <ellipse
            cx="50"
            cy="68"
            rx="19"
            ry="6"
            transform="rotate(-18 50 68)"
          />
          <circle cx="67" cy="62" r="2.2" fill={accent} stroke="none" />
          <path
            d="M39 60v5m-2.5-2.5h5m16 14v4m-2-2h4"
            stroke={highlight}
            strokeWidth="1.4"
          />
        </g>
      )}
      {theme === "kung-fu" && (
        <g aria-hidden="true" fill="none" stroke={accent} strokeWidth="4">
          <path d="M35 68 Q50 73 65 68" />
          <path d="m61 68 2 8" strokeWidth="3" />
        </g>
      )}
      {theme === "cowboy" && (
        <path
          aria-hidden="true"
          d="m50 60 2.3 5.2 5.7.5-4.3 3.8 1.3 5.5-5-2.8-5 2.8 1.3-5.5-4.3-3.8 5.7-.5Z"
          fill={accent}
          stroke={outline}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
      {theme === "sport" && (
        <g aria-hidden="true" fill="none" stroke={accent} strokeWidth="1.8">
          <circle cx="50" cy="68" r="7" />
          <path d="M45 63q5 5 0 10m10-10q-5 5 0 10M43 68h14" />
        </g>
      )}
      {theme === "urban" && (
        <path
          aria-hidden="true"
          d="m36 72 8-10 5 7 9-11 7 5"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
