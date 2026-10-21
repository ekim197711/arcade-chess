// Folder identity is independent of which portraits have been supplied.
// Keep names/order stable: ladder saves refer to these roster indexes.
export const BOSS_CHARACTERS = [
  { name: "Blunder Benny", folder: "blunder-benny" },
  { name: "Pawnshop Penny", folder: "pawnshop-penny" },
  { name: "Forklift Frankie", folder: "forklift-frankie" },
  { name: "Rook'n'Roll Ricky", folder: "rook-n-roll-ricky" },
  { name: "Double-Step Dixie", folder: "double-step-dixie" },
  { name: "Checkers Chuck", folder: "checkers-chuck" },
  { name: "Gambit Gus", folder: "gambit-gus" },
  { name: "En Passant Eddie", folder: "en-passant-eddie" },
  { name: "Castle Crash Casey", folder: "castle-crash-casey" },
  { name: "Pinball Piper", folder: "pinball-piper" },
  { name: "Knight Shift Nate", folder: "knight-shift-nate" },
  { name: "Bishop Bop Beatrice", folder: "bishop-bop-beatrice" },
  { name: "Backrank Benny", folder: "backrank-benny" },
  { name: "Skewer Scooter", folder: "skewer-scooter" },
  { name: "Queen's Gambit Quinn", folder: "queens-gambit-quinn" },
  { name: "Fork Attack Freya", folder: "fork-attack-freya" },
  { name: "Battery Belle", folder: "battery-belle" },
  { name: "Tempo Tasha", folder: "tempo-tasha" },
  { name: "Rook Rocket Ruby", folder: "rook-rocket-ruby" },
  { name: "Sacrifice Sam", folder: "sacrifice-sam" },
  { name: "Counterpunch Cody", folder: "counterpunch-cody" },
  { name: "Outpost Ollie", folder: "outpost-ollie" },
  { name: "Promotion Polly", folder: "promotion-polly" },
  { name: "Mate-in-Two Milo", folder: "mate-in-two-milo" },
  { name: "Zwischen Zoe", folder: "zwischen-zoe" },
  { name: "Tactic-Tap Theo", folder: "tactic-tap-theo" },
  { name: "Pawn Storm Petra", folder: "pawn-storm-petra" },
  { name: "Pin-Prick Percy", folder: "pin-prick-percy" },
  { name: "Queen Sweep Queenie", folder: "queen-sweep-queenie" },
  { name: "Theoretical Terry", folder: "theoretical-terry" },
  { name: "Endgame Eddie", folder: "endgame-eddie" },
  { name: "Zugzwang Zelda", folder: "zugzwang-zelda" },
  { name: "Rook Lift Rufus", folder: "rook-lift-rufus" },
  { name: "Exchange Xander", folder: "exchange-xander" },
  { name: "Sicilian Sid", folder: "sicilian-sid" },
  { name: "King's Indian Kit", folder: "kings-indian-kit" },
  { name: "Nimzo Niko", folder: "nimzo-niko" },
  { name: "Catalan Cora", folder: "catalan-cora" },
  { name: "Alekhine Alice", folder: "alekhine-alice" },
  { name: "Grunfeld Greta", folder: "grunfeld-greta" },
  { name: "Maroczy Marla", folder: "maroczy-marla" },
  { name: "Blitz Baroness Bea", folder: "blitz-baroness-bea" },
  { name: "Grandmaster Gus", folder: "grandmaster-gus" },
  { name: "Vishy Victor", folder: "vishy-victor" },
  { name: "Deep Blue Deirdre", folder: "deep-blue-deirdre" },
  { name: "Opening Oracle Orion", folder: "opening-oracle-orion" },
  { name: "Engine Emmett", folder: "engine-emmett" },
  { name: "Checkpoint Celine", folder: "checkpoint-celine" },
  { name: "Clockwork Cormac", folder: "clockwork-cormac" },
  { name: "Mate-in-One Marnie", folder: "mate-in-one-marnie" },
  { name: "Endboss Evelyn", folder: "endboss-evelyn" },
  { name: "Crowncrusher Clara", folder: "crowncrusher-clara" },
  { name: "Royal Rumble Rafi", folder: "royal-rumble-rafi" },
  { name: "Check Raid Ramon", folder: "check-raid-ramon" },
  { name: "Mate Collector Mabel", folder: "mate-collector-mabel" },
  { name: "Fortress Fiona", folder: "fortress-fiona" },
  { name: "Tournament Titan Toby", folder: "tournament-titan-toby" },
  { name: "Matchpoint Max", folder: "matchpoint-max" },
  { name: "Checkmate Cindy", folder: "checkmate-cindy" },
] as const;

export const BOSS_NAMES = BOSS_CHARACTERS.map(character => character.name);
export type PortraitInventory = Record<string, readonly string[] | undefined>;

function normalizeName(name: string): string {
  return name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveBossCharacter(name: string, inventory: PortraitInventory): string | undefined {
  const mapped = BOSS_CHARACTERS.find(character => character.name === name)?.folder;
  if (mapped && Object.hasOwn(inventory, mapped)) return mapped;
  // Accept accents, apostrophes, spaces and hyphens without renaming artwork.
  const normalized = normalizeName(mapped ?? name);
  const matches = Object.keys(inventory).filter(folder => normalizeName(folder) === normalized);
  return matches.length === 1 ? matches[0] : mapped;
}

export function bossPortrait(character: string | undefined, inventory: PortraitInventory, expression = "focused"): string | undefined {
  if (!character) return undefined;
  const available = inventory[character] ?? [];
  const fallback = ["focused", "taunting", "angry", "won", "lost"].find(value => available.includes(value));
  const selected = available.includes(expression) ? expression : fallback ?? available[0];
  return selected ? `/characters/${encodeURIComponent(character)}/${encodeURIComponent(selected)}.png` : undefined;
}
