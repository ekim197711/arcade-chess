import type { MedievalPieceType, PieceColor } from "./MedievalPiece";

export const PIECE_CHOICES = [
  { id: "classic-2d", label: "Classic 2D" },
  { id: "granite-3d", label: "Granite 3D" },
  { id: "medieval-3d", label: "Medieval 3D" },
  { id: "scifi-3d", label: "Sci-Fi 3D" },
  { id: "sports-3d", label: "Sports 3D" },
] as const;

export type PieceStyle = (typeof PIECE_CHOICES)[number]["id"];

type Props = {
  type: MedievalPieceType;
  color: PieceColor;
  theme: PieceStyle;
  fitToSquare?: boolean;
};

const PIECE_FILENAMES: Record<MedievalPieceType, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const loadedStyles = new Map<PieceStyle, Promise<void>>();

export function loadPieceStyle(theme: PieceStyle): Promise<void> {
  const cached = loadedStyles.get(theme);
  if (cached) return cached;
  const loading = Promise.all(
    ["white", "black"].flatMap((side) => Object.values(PIECE_FILENAMES).map((piece) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        const timer = window.setTimeout(() => reject(new Error("Style loading timed out")), 20000);
        image.src = `/pieces/${theme}/256/${side}-${piece}.png`;
        image.decode().then(resolve, reject).finally(() => window.clearTimeout(timer));
      }),
    )),
  ).then(() => undefined).catch((error: unknown) => {
    loadedStyles.delete(theme);
    throw error;
  });
  loadedStyles.set(theme, loading);
  return loading;
}

export function PieceArtwork({
  type,
  color,
  theme,
  fitToSquare = false,
}: Props) {
  const side = color === "w" ? "white" : "black";
  const size = type === "p" ? 68 : type === "r" ? 74 : type === "n" ? 78 : 84;
  return (
    <img
      className="piece-artwork"
      style={
        fitToSquare
          ? {
              // Anchor percentages to the square, not an intrinsic grid track.
              position: "absolute",
              left: `${(100 - size) / 2}%`,
              bottom: "8%",
              width: `${size}%`,
              height: `${size}%`,
              objectFit: "contain",
              objectPosition: "center bottom",
            }
          : undefined
      }
      src={`/pieces/${theme}/256/${side}-${PIECE_FILENAMES[type]}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
