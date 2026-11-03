type Scenario = {pgn:string};
type Gambit = {id:string;name:string;scenarios:Scenario[]};

// Teaching order, not an assessment of the opening's objective chess strength.
const INTRODUCTIONS: Record<string,{rank:number;reason:string}> = {
 "queen-s-gambit":{rank:0,reason:"A short introduction to central control: offer the c-pawn, develop your pieces and learn when to recover it."},
 "scotch-game-scotch-gambit":{rank:1,reason:"Learn quick development and pressure on f7 through a familiar open-game setup."},
 "bishop-s-opening-urusov-gambit":{rank:2,reason:"Practice developing your pieces quickly while the opponent spends time taking a central pawn."},
 "italian-game-evans-gambit":{rank:3,reason:"Learn how a pawn offer can gain time against a bishop and help you build a strong centre."},
 "danish-gambit":{rank:4,reason:"A clear lesson in opening bishop diagonals and developing quickly after offering central pawns."},
 "vienna-game-vienna-gambit":{rank:5,reason:"Practice challenging the centre with f4 while developing and protecting your king."},
};
function lineDifficulty(pgn:string) {
 const moves=pgn.replace(/\d+\.(?:\.\.)?/g,'').trim().split(/\s+/).filter(Boolean);
 return moves.length + moves.filter(move=>/[+#]/.test(move)).length*4 + moves.filter(move=>move.includes('x')).length*2 + moves.filter(move=>move.startsWith('Q')||move.includes('=')).length*3;
}
export function suggestGambit<T extends Gambit>(catalog:readonly T[],played:readonly string[],completed:readonly string[]) {
 const tried=new Set([...played,...completed.map(value=>value.split(':')[0])]);
 let best:{gambit:T;scenarioIndex:number;score:number;reason:string}|null=null;
 for(const gambit of catalog){
  if(tried.has(gambit.id)||!gambit.scenarios.length)continue;
  let scenarioIndex=0,complexity=Infinity;
  gambit.scenarios.forEach((scenario,index)=>{const score=lineDifficulty(scenario.pgn);if(score<complexity){complexity=score;scenarioIndex=index;}});
  const intro=INTRODUCTIONS[gambit.id];
  const score=intro?-1000+intro.rank:complexity;
  if(!best||score<best.score||(score===best.score&&gambit.name.localeCompare(best.gambit.name)<0))best={gambit,scenarioIndex,score,reason:intro?.reason??"Start with a short opening line with fewer captures, checks and early queen moves, then practice the ideas behind the sacrifice."};
 }
 return best;
}
