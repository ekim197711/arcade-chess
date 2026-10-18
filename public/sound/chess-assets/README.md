# Chess game assets

180 pieces across 15 themes, each available at 256px and 512px height (360 transparent PNGs).

Every individual PNG is tightly cropped to the figure, including its base. There is no square canvas or intentional transparent padding. All figures have the same pixel height within each resolution; widths vary to preserve their proportions. Your game controls displayed height.

## Files

`pieces/<style>/<height>/<color>-<role>.png`

- Heights: `256`, `512`.
- Colors: `white`, `black`.
- Roles: `king`, `queen`, `bishop`, `knight`, `rook`, `pawn`.
- Styles: `granite-3d`, `classic-2d`, `medieval-3d`, `sports-3d`, `scifi-3d`, `norse-3d`, `egypt-3d`, `ocean-3d`, `steampunk-3d`, `forest-3d`, `samurai-3d`, `gothic-3d`, `candy-3d`, `space-3d`, `arctic-3d`.

Use height plus automatic width; do not force a square width and height. Transparent pixels inside irregular silhouettes remain, with antialiased edges preserved. The 512px version is resized from source artwork, not additional native detail. These are rendered PNG sprites, not rotatable 3D meshes.

## HTML / CSS

```html
<img class="chess-piece"
     src="/chess-assets/pieces/granite-3d/256/white-pawn.png"
     alt="White pawn" draggable="false">
<style>
  .chess-piece { height: 80px; width: auto; display: block; }
</style>
```

## JavaScript Canvas

Serve the assets over HTTP from your game's static/public directory.

```js
import { loadPieces } from './chess-assets/pieces.js';
const pieces = await loadPieces('granite-3d');
const image = pieces['white-pawn'];
const height = 80; // controlled by your game
const width = height * image.naturalWidth / image.naturalHeight;
ctx.drawImage(image, centerX - width / 2, baselineY - height, width, height);
```

The same height works for any role or theme. Use a bottom-center anchor `(0.5, 1)` in a sprite engine. `manifest.json` lists paths. `pieces.js` provides `pieceUrl`, `loadPieces`, and the theme/role/color lists. `chess-sprites.js` provides a compatibility drawing wrapper using these individual files.

Open `preview.html` to compare all pieces at equal displayed heights against light and dark backgrounds. The ZIP includes the individual game assets, not the original source sheets or outdated square-canvas previews.
