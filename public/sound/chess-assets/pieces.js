export const STYLES = ["granite-3d","classic-2d","medieval-3d","sports-3d","scifi-3d","norse-3d","egypt-3d","ocean-3d","steampunk-3d","forest-3d","samurai-3d","gothic-3d","candy-3d","space-3d","arctic-3d"];
export const ROLES = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
export const COLORS = ['white', 'black'];

/** Tightly cropped PNG. size specifies height; width preserves aspect ratio. */
export function pieceUrl(style, color, role, size = 256) {
  if (!STYLES.includes(style) || !COLORS.includes(color) || !ROLES.includes(role)
    || ![256, 512].includes(size)) throw new Error('Invalid chess piece or size');
  return new URL(`./pieces/${style}/${size}/${color}-${role}.png`, import.meta.url).href;
}

/** Preload one theme. Returns images keyed by white-king, black-pawn, etc. */
export async function loadPieces(style = 'granite-3d', size = 256) {
  const entries = await Promise.all(COLORS.flatMap(color => ROLES.map(async role => {
    const image = new Image();
    image.src = pieceUrl(style, color, role, size);
    await image.decode();
    return [`${color}-${role}`, image];
  })));
  return Object.fromEntries(entries);
}
