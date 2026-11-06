import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parsePgn, startingPosition } from 'chessops/pgn';
import { parseSan, makeSanAndPlay } from 'chessops/san';

// Import factual mainline scores, without third-party annotations or variations.
const source = 'https://www.pgnmentor.com/files.html';
const root = new URL('../public/legendary/', import.meta.url);
const cache = new URL('../.tmp/legendary-pgn/', import.meta.url);
await mkdir(root, { recursive: true });
await mkdir(cache, { recursive: true });
async function download(url) {
 for (let attempt = 0; attempt < 3; attempt++) {
  try {
   const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
   if (!response.ok) throw new Error(`${response.status}: ${url}`);
   return await response.text();
  } catch (error) { if (attempt === 2) throw error; }
 }
}
const html = await download(source);
const files = [...new Set([...html.matchAll(/href="(events\/[^"/]+\.pgn)"/g)].map(match => match[1]))];
const catalog = [], rejected = [], failures = [];
let cursor = 0;
async function worker() {
 while (cursor < files.length) {
  const file = files[cursor++], id = file.slice(7, -4).toLowerCase();
  const url = new URL(file, source).href;
  try {
   let raw;
   try { raw = await readFile(new URL(`${id}.pgn`, cache), 'utf8'); }
   catch { raw = await download(url); await writeFile(new URL(`${id}.pgn`, cache), raw); }
   const games = [], seen = new Set();
   // Some source files omit the blank separator before the next Event header.
   for (const game of raw.split(/(?=^\[Event\s)/m).filter(part=>part.trim()).flatMap(part=>parsePgn(part))) {
    const h = game.headers;
    try {
     if (!h.get('White') || !h.get('Black')) throw new Error('Missing players');
     const position = startingPosition(h).unwrap(), moves = [];
     for (const node of game.moves.mainline()) {
      const move = parseSan(position, node.san);
      if (!move) throw new Error(`Illegal move at ply ${moves.length + 1}: ${node.san}`);
      moves.push(makeSanAndPlay(position, move));
     }
     if (!moves.length) throw new Error('No played moves (e.g. forfeit)');
     const tags = ['Event','Site','Date','Round','White','Black','Result','ECO','WhiteElo','BlackElo','Opening','SetUp','FEN'];
     const headers = tags.filter(tag => h.has(tag)).map(tag => `[${tag} "${h.get(tag).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`).join('\n');
     const numbered = moves.map((san, index) => index % 2 ? san : `${Math.floor(index / 2) + 1}. ${san}`).join(' ');
     const pgn = `${headers}\n\n${numbered} ${h.get('Result') ?? '*'}`;
     const key = createHash('sha256').update(pgn).digest('hex').slice(0,16);
     if (seen.has(key)) continue;
     seen.add(key);
     games.push({ id: key, white: h.get('White'), black: h.get('Black'), event: h.get('Event') ?? file.slice(7,-4), date: h.get('Date') ?? '????.??.??', round: h.get('Round') ?? '?', result: h.get('Result') ?? '*', opening: h.get('Opening') ?? h.get('ECO') ?? '', plies: moves.length, pgn });
    } catch (error) { rejected.push({ file, white:h.get('White'), black:h.get('Black'), reason:error.message }); }
   }
   if (!games.length) throw new Error('No valid games');
   await writeFile(new URL(`${id}.json`, root), JSON.stringify(games));
   const year = Number(file.match(/\d{4}/)?.[0]) || 0;
   const labelMatch = html.match(new RegExp(`href="${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^]*?</td><td>([^<]+)`));
   const label = (labelMatch?.[1] ?? file.slice(7,-4).replace(/([a-z])([A-Z\d])/g,'$1 $2')).replace(/&amp;/g,'&').replace(/&#160;/g,' ');
   const title = file.includes('/WorldChamp') && !label.includes('World Championship') ? `World Championship ${year} · ${label}` : label;
   catalog.push({ id, title, year, count: games.length, source: url, players: [...new Set(games.flatMap(game=>[game.white,game.black]))].sort() });
   if (catalog.length % 25 === 0) console.log(`Imported ${catalog.length}/${files.length} events`);
  } catch (error) { failures.push({file,reason:error.message}); }
 }
}
await Promise.all(Array.from({length:4},worker));
catalog.sort((a,b)=>b.year-a.year || a.title.localeCompare(b.title));
const manifest = { source, importedAt: new Date().toISOString(), gameCount:catalog.reduce((sum,event)=>sum+event.count,0), events:catalog };
await writeFile(new URL('catalog.json',root),JSON.stringify(manifest));
await writeFile(new URL('import-report.json',root),JSON.stringify({source,importedAt:manifest.importedAt,files:files.length,events:catalog.length,games:manifest.gameCount,rejected,failures},null,2));
console.log(JSON.stringify({events:catalog.length,games:manifest.gameCount,rejected:rejected.length,failures}));
if (failures.length) process.exitCode = 1;
