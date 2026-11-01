import { writeFileSync } from 'node:fs';
const groups = new Map();
for (const letter of 'abcde') {
 const response = await fetch(`https://raw.githubusercontent.com/lichess-org/chess-openings/master/${letter}.tsv`);
 if (!response.ok) throw Error(response.status);
 for (const row of (await response.text()).trim().split('\n').slice(1)) {
  const [eco,name,pgn] = row.trim().split('\t');
  if (!/gambit/i.test(name)) continue;
  const family = name.match(/^.*?Gambit/i)[0];
  const lines = groups.get(family) ?? [];
  if (!lines.some(line => line.pgn === pgn)) lines.push({name,eco,pgn});
  groups.set(family,lines);
 }
}
const data = [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([name,lines],i)=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,boss:i%59,scenarios:lines.sort((a,b)=>a.pgn.length-b.pgn.length)}));
writeFileSync('src/gambits.json',JSON.stringify(data,null,2)+'\n');
console.log(data.length, 'gambits;',data.reduce((n,g)=>n+g.scenarios.length,0),'scenarios');
