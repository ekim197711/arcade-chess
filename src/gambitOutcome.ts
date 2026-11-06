import { Chess, type Color, type Square } from "./chess";
import { gambitBriefing } from "./gambitBriefing";

const VALUE = {p:1,n:3,b:3,r:5,q:9,k:0};
export function gambitOutcome(name: string, basePgn: string, pgn: string, playerSide: Color) {
 const briefing = gambitBriefing(name, basePgn);
 const game = new Chess(); game.loadPgn(pgn);
 const offering = briefing.offeringSide;
 const attacking = playerSide === offering;
 const totals = {w:0,b:0};
 for (const row of game.board()) for (const piece of row) if (piece) totals[piece.color] += VALUE[piece.type];
 const balance = totals[offering] - totals[offering === "w" ? "b" : "w"];
 const offeringName = offering === "w" ? "White" : "Black";
 const material = balance < 0
  ? `${offeringName} is currently ${-balance} ${balance === -1 ? "pawn-point" : "pawn-points"} behind in material (pawn 1, knight/bishop 3, rook 5, queen 9). The next task is to turn activity into concrete threats before the defender consolidates.`
  : balance === 0
   ? "Material is currently equal. This line has reached the gambit setup without a net material deficit; the offer may still be on the board, may have been declined, or material may have been recovered. You have learned the setup, not won the game."
   : `${offeringName} is currently ${balance} pawn-points ahead in material. Keep developing and protect the king rather than assuming that the opening has decided the game.`;
 const homeRank = playerSide === "w" ? "1" : "8";
 const undeveloped = (["b","c","f","g"] as const).map(file=>`${file}${homeRank}` as Square).filter(square=>{
  const piece=game.get(square);return piece?.color === playerSide && (piece.type === "n" || piece.type === "b");
 });
 const openFiles: string[] = [], semiOpenFiles: string[] = [];
 for (const file of "abcdefgh") {
  const pawns = Array.from({length:8},(_,i)=>game.get((file+(i+1)) as Square)).filter(piece=>piece?.type === "p");
  if (!pawns.length) openFiles.push(file);
  else if (!pawns.some(piece=>piece?.color === offering)) semiOpenFiles.push(file);
 }
 const activity = openFiles.length || semiOpenFiles.length
  ? ` In this position, ${openFiles.length ? `the ${openFiles.join(", ")} file(s) have no pawns` : ""}${openFiles.length && semiOpenFiles.length ? "; " : ""}${semiOpenFiles.length ? `the ${semiOpenFiles.join(", ")} file(s) have no ${offeringName.toLowerCase()} pawns` : ""}. These may become routes for rooks once they can use the files safely.`
  : " All files still contain pawns from the gambit side, so rook activity on open files still has to be created; work on development and central tension first.";
 const turn = game.turn() === "w" ? "White" : "Black";
 const next = game.isGameOver()
  ? `This scenario ends in ${game.isCheckmate() ? "checkmate" : "a draw"}; there is no continuation from this position. Try another scenario or switch sides.`
  : `${turn} moves next. ${attacking ? briefing.attack : briefing.defense}${undeveloped.length ? ` Your minor pieces on ${undeveloped.join(", ")} are still on their starting squares; look for safe ways to bring them into play.` : " Keep your active pieces coordinated and look for a useful central pawn break."} ${game.isCheck() ? "The side to move is in check and must answer it legally." : "Before every move, check the opponent's checks, captures and threats."}`;
 return {
  material: material + activity,
  next,
  benefit: `${briefing.idea} That is the reason to try this gambit: you learn to balance material against time and activity. The intended benefit still has to be earned over the board; completing the move order does not prove an advantage.`,
  opponent: attacking ? `Expect the defender to try to neutralize your initiative: ${briefing.defense}` : `Expect the gambit player to pursue active play: ${briefing.attack}`,
  transition: "Play on against Stockfish continues from this exact position with unrestricted replies. The move-by-move guide ends here, so use these plans to choose your own moves.",
 };
}
