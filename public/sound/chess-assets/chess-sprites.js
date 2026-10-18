import { STYLES, loadPieces } from './pieces.js';

/** Compatibility wrapper. Individual PNGs are tightly cropped and normalized by height. */
export async function loadChessSprites(baseUrl = new URL('./', import.meta.url)) {
  const base = new URL(baseUrl, import.meta.url);
  const entries = await Promise.all(STYLES.map(async style => {
    if (base.href === new URL('./', import.meta.url).href) return [style, await loadPieces(style)];
    const images = {};
    await Promise.all(['white', 'black'].flatMap(color =>
      ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'].map(async role => {
        const image = new Image();
        image.src = new URL(`pieces/${style}/256/${color}-${role}.png`, base).href;
        await image.decode();
        images[`${color}-${role}`] = image;
      })));
    return [style, images];
  }));
  const themes = Object.fromEntries(entries);
  function get(style, color, role) {
    const image = themes[style]?.[`${color}-${role}`];
    if (!image) throw new Error(`Unknown chess sprite: ${style}/${color}/${role}`);
    return image;
  }
  return {
    // x/y is the top-left of a nominal square; height is the exact figure height.
    draw(ctx, style, color, role, x, y, height) {
      const image = get(style, color, role);
      const width = height * image.naturalWidth / image.naturalHeight;
      ctx.drawImage(image, x + (height - width) / 2, y, width, height);
    },
    canvas(style, color, role) {
      const image = get(style, color, role);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas;
    }
  };
}
