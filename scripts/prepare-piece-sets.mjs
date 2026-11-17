// Deterministic game exports only; the original AI artwork is kept in art/pieces.
// Setup: npm install --prefix .tmp/piece-tools --no-audit --no-fund sharp
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sharp = createRequire(resolve(root, '.tmp/piece-tools/package.json'))('sharp');
const order = ['white-king', 'white-queen', 'white-bishop', 'white-knight', 'white-rook', 'white-pawn',
  'black-king', 'black-queen', 'black-bishop', 'black-knight', 'black-rook', 'black-pawn'];
const artistic = ['kintsugi-3d', 'aurora-glass-3d', 'verdigris-3d'];

async function saveSprite(style, name, input) {
  // The renderer owns the relative pawn/rook/royal sizes. Normalize every sprite
  // to the same transparent canvas and baseline to avoid scaling pieces twice.
  for (const size of [256, 512]) {
    const dir = resolve(root, 'public/pieces', style, String(size));
    await mkdir(dir, { recursive: true });
    const piece = await sharp(input).resize(size - 8, size - 8, { fit: 'inside' }).toBuffer();
    const dimensions = await sharp(piece).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
      .composite([{ input: piece, left: Math.floor((size - dimensions.width) / 2), top: size - 4 - dimensions.height }])
      .png({ compressionLevel: 9 }).toFile(resolve(dir, `${name}.png`));
  }
}

for (const style of artistic) {
  const { data, info } = await sharp(resolve(root, 'art/pieces/sources', `${style}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < order.length; index++) {
    const row = Math.floor(index / 3), column = index % 3;
    const x0 = Math.round(column * info.width / 3), x1 = Math.round((column + 1) * info.width / 3);
    const y0 = Math.round(row * info.height / 4), y1 = Math.round((row + 1) * info.height / 4);
    let left = x1, top = y1, right = x0, bottom = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 220) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (right <= left || bottom <= top) throw new Error(`Empty sprite: ${style}/${order[index]}`);
    left = Math.max(x0, left - 2); top = Math.max(y0, top - 2);
    right = Math.min(x1 - 1, right + 2); bottom = Math.min(y1 - 1, bottom + 2);
    const width = right - left + 1, height = bottom - top + 1;
    const sprite = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const source = ((y + top) * info.width + x + left) * 4, destination = (y * width + x) * 4;
      data.copy(sprite, destination, source, source + 4);
      // Discard the generator's faint disconnected extraction halo. Keep a
      // smooth alpha edge and the original RGB, with no background matting.
      const coverage = Math.max(0, Math.min(1, (data[source + 3] - 150) / 95));
      sprite[destination + 3] = Math.round(255 * coverage * coverage * (3 - 2 * coverage));
    }
    await saveSprite(style, order[index], await sharp(sprite, { raw: { width, height, channels: 4 } }).png().toBuffer());
  }
  console.log(`Exported ${style}: 12 transparent sprites at 256 and 512`);
}

// Original, editable flat artwork. No fonts or third-party piece assets.
const tournament = {
  king: `<path d="M59 7h10v11h11v10H69v13H59V28H48V18h11z"/><path d="M43 43Q64 32 85 43l-9 20H52zM53 66h22l6 33H47z"/><path d="M46 99h36l10 12H36zM34 111h60v10H34z"/><path class="detail" d="M50 55h28M53 70h22M44 109h40"/>`,
  queen: `<path d="m33 28 17 14 2-23 12 20 12-20 2 23 17-14-12 34H45z"/><circle cx="33" cy="25" r="5"/><circle cx="52" cy="16" r="5"/><circle cx="76" cy="16" r="5"/><circle cx="95" cy="25" r="5"/><path d="M47 65h34l-6 17 7 17H46l7-17zM44 99h40l10 12H34zM32 111h64v10H32z"/><path class="detail" d="M47 53h34M50 72h28M44 109h40"/>`,
  bishop: `<path d="M64 7C48 19 39 30 43 43q3 13 21 16 18-3 21-16C89 30 80 19 64 7z"/><path class="detail" d="m68 20-12 18"/><path d="M46 60h36v9H46zM55 69h18l8 30H47zM44 99h40l10 12H34zM32 111h64v10H32z"/><path class="detail" d="M44 109h40"/>`,
  knight: `<path d="m53 10 5 16 20 5 16 24-1 43H40l9-26 15-18-16 3-12 9-12-14 13-22 7-4z"/><path class="detail" d="m72 39 11 18-4 26M34 49l10 2M48 29l8 9"/><circle class="eye" cx="50" cy="42" r="3.5"/><path d="M40 99h49l8 12H32zM30 111h69v10H30z"/>`,
  rook: `<path d="M36 13h13v14h10V13h11v14h10V13h13v34l-9 10H45l-9-10zM47 58h35l-5 40H52zM44 99h41l10 12H34zM32 111h65v10H32z"/><path class="detail" d="M39 41h51M50 67h30M43 109h43"/>`,
  pawn: `<circle cx="64" cy="29" r="19"/><path d="M45 52h38v10H45zM55 62h18l10 36H45zM42 99h44l10 12H32zM30 111h68v10H30z"/><path class="detail" d="M44 109h40"/>`,
};

const woodcut = {
  king: `<path d="M59 5h10v12h12v10H69v13H59V27H47V17h12zM39 43l10-7h30l10 7-10 20H49zM51 65h26l-5 16 11 20H45l11-20zM42 101h44l9 18H33z"/><path class="detail" d="M46 50h36M51 70h26M45 110h39"/>`,
  queen: `<path d="m32 24 18 19 3-27 11 20 11-20 3 27 18-19-13 40H45zM47 66h34l-8 15 12 20H43l12-20zM40 102h48l8 17H32z"/><circle cx="32" cy="22" r="4"/><circle cx="53" cy="13" r="4"/><circle cx="75" cy="13" r="4"/><circle cx="96" cy="22" r="4"/><path class="detail" d="M44 54h40M49 73h30M43 110h42"/>`,
  bishop: `<path d="M64 6 44 29l-5 15 9 12 16 6 16-6 9-12-5-15z"/><path class="detail" d="m69 20-14 19"/><path d="M45 63h38v9H45zM55 73h18l-2 11 13 17H44l13-17zM41 102h46l9 17H32z"/><path class="detail" d="M44 110h40"/>`,
  knight: `<path d="m51 7 11 18 20 10 12 22-4 43H39l10-28 16-20-16 5-11 10-14-13 10-21 9-8z"/><path class="detail" d="m67 34 14 20-6 32M33 50l12 1M45 27l9 13M84 45l-9 5"/><circle class="eye" cx="50" cy="43" r="3"/><path d="M38 102h52l8 17H30z"/>`,
  rook: `<path d="M34 12h14v16h10V12h12v16h10V12h14v34l-12 12H46L34 46zM47 60h35l-7 26 10 15H44l10-15zM41 103h47l9 16H31z"/><path class="detail" d="M37 43h54M49 68h30M44 111h41"/>`,
  pawn: `<path d="m64 9 14 5 6 14-6 15-14 6-14-6-6-15 6-14zM44 53h40v9H44zM55 65h18l-2 16 13 20H44l13-20zM41 103h46l9 16H32z"/><path class="detail" d="M48 28h9M44 111h40"/>`,
};

for (const [style, pieces] of [['tournament-2d', tournament], ['woodcut-2d', woodcut]]) {
  const sourceDir = resolve(root, 'art/pieces/sources', style);
  await mkdir(sourceDir, { recursive: true });
  for (const name of order) {
    const [side, type] = name.split('-'), light = side === 'white', print = style === 'woodcut-2d';
    const fill = print ? (light ? '#f4deb0' : '#32271f') : (light ? '#faf7ed' : '#202937');
    const edge = light ? (print ? '#32271f' : '#202937') : (print ? '#f4deb0' : '#faf7ed');
    const hatch = print ? `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(24)"><path d="M0 0v8" stroke="${edge}" stroke-width="1.4" opacity=".26"/></pattern></defs><g fill="url(#hatch)" stroke="none">${pieces[type]}</g>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 128 128"><style>.detail{fill:none;stroke:${edge};stroke-width:2.5}.eye{fill:${edge};stroke:none}</style><g fill="${fill}" stroke="${edge}" stroke-width="${print ? 3.4 : 3}" stroke-linejoin="${print ? 'miter' : 'round'}" stroke-linecap="round">${pieces[type]}</g>${hatch}</svg>`;
    await writeFile(resolve(sourceDir, `${name}.svg`), svg + '\n');
    const rendered = await sharp(Buffer.from(svg)).png().toBuffer();
    const trimmed = await sharp(rendered).trim({ background: '#00000000', threshold: 1 }).png().toBuffer();
    await saveSprite(style, name, trimmed);
  }
  console.log(`Exported ${style}: 12 original vector designs at 256 and 512`);
}
