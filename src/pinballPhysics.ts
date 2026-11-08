export const TABLE = { width: 480, height: 720, radius: 9 };
export const TARGETS = [
  { x: 240, y: 100, r: 29, name: "King", glyph: "♚", points: 5000 },
  { x: 133, y: 198, r: 25, name: "Pawn", glyph: "♟", points: 100 },
  { x: 347, y: 198, r: 25, name: "Knight", glyph: "♞", points: 300 },
  { x: 240, y: 284, r: 27, name: "Bishop", glyph: "♝", points: 300 },
  { x: 112, y: 373, r: 24, name: "Rook", glyph: "♜", points: 500 },
  { x: 368, y: 373, r: 24, name: "Queen", glyph: "♛", points: 900 },
] as const;
export const RAILS = [[30, 460, 105, 562], [105, 562, 145, 600], [450, 460, 375, 562], [375, 562, 335, 600]] as const;
export type Ball = { x: number; y: number; vx: number; vy: number; cooldown: number; launching?: boolean };
export type PinballState = {
  balls: Ball[]; score: number; round: number; phase: "ready" | "playing" | "over";
  captured: number[]; mates: number; captures: number; message: string; flash: number; clock: number;
  left: number; right: number; hits: number[];
};
export const createPinball = (): PinballState => ({ balls: [], score: 0, round: 1, phase: "ready", captured: [], mates: 0, captures: 0, message: "Launch ball · Space", flash: 0, clock: 0, left: 0, right: 0, hits: Array(6).fill(0) });
export function launchBall(state: PinballState) {
  if (state.phase !== "ready") return;
  state.balls.push({ x: 432, y: 648, vx: 0, vy: -950, cooldown: .3, launching: true });
  state.phase = "playing"; state.message = "Capture all five pieces to light CHECK";
}
export function hitTarget(state: PinballState, index: number) {
  if (state.phase !== "playing" || !TARGETS[index]) return;
  state.hits[index] = .3;
  if (index === 0) {
    if (state.captured.length === 5) {
      state.score += 5000; state.mates++; state.captured = [];
      state.message = "CHECKMATE! +5,000 · MULTIBALL"; state.flash = 3;
      while (state.balls.length < 3) {
        const sign = state.balls.length % 2 ? -1 : 1;
        state.balls.push({ x: 240 + sign * 52, y: 135, vx: sign * 210, vy: 120, cooldown: .7 });
      }
    } else { state.score += 50; state.message = "King guarded · capture the other five pieces"; }
  } else if (!state.captured.includes(index)) {
    state.captured.push(index); state.captures++; state.score += TARGETS[index].points;
    state.message = state.captured.length === 5 ? "CHECK! Hit the king for CHECKMATE + MULTIBALL" : `${TARGETS[index].name.toUpperCase()} CAPTURED +${TARGETS[index].points}`;
  } else { state.score += 25; state.message = "Ricochet +25"; }
  state.score = Math.min(2_000_000_000, state.score);
}
export function flipper(left: boolean, amount: number) {
  const x = left ? 145 : 335, y = 617;
  const angle = .35 - amount * .95;
  return { x, y, tipX: x + (left ? 1 : -1) * Math.cos(angle) * 90, tipY: y + Math.sin(angle) * 90 };
}
function segment(ball: Ball, x1: number, y1: number, x2: number, y2: number, radius: number, kick = 0) {
  const dx=x2-x1,dy=y2-y1, t=Math.max(0,Math.min(1,((ball.x-x1)*dx+(ball.y-y1)*dy)/(dx*dx+dy*dy)));
  const nx=ball.x-(x1+t*dx),ny=ball.y-(y1+t*dy), distance=Math.hypot(nx,ny);
  if(distance>=radius || distance<.001)return false;
  const ux=nx/distance,uy=ny/distance;
  ball.x+=ux*(radius-distance);ball.y+=uy*(radius-distance);
  const dot=ball.vx*ux+ball.vy*uy;
  if(dot<0){ball.vx-=1.8*dot*ux;ball.vy-=1.8*dot*uy;}
  if(kick>0 && ball.y < y1+12) {ball.vy=-Math.max(500+kick*230,Math.abs(ball.vy));ball.vx+=(x1<240?1:-1)*(80+t*150);}
  return true;
}
export function stepPinball(state: PinballState, dt: number, left: boolean, right: boolean) {
  dt=Math.min(Math.max(dt,0),1/60);
  state.clock+=dt;state.flash=Math.max(0,state.flash-dt);state.hits=state.hits.map(t=>Math.max(0,t-dt));
  const beforeLeft=state.left,beforeRight=state.right;
  state.left+=Math.max(-dt*12,Math.min(dt*12,(left?1:0)-state.left));
  state.right+=Math.max(-dt*12,Math.min(dt*12,(right?1:0)-state.right));
  if(state.phase!=="playing")return;
  const activeBalls=[...state.balls];
  for(const ball of activeBalls){
    ball.cooldown=Math.max(0,ball.cooldown-dt);ball.vy+=540*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    if(ball.x<39){ball.x=39;ball.vx=Math.abs(ball.vx)*.85;}
    if(ball.x>441){ball.x=441;ball.vx=-Math.abs(ball.vx)*.85;}
    if(ball.y<39){ball.y=39;ball.vy=Math.abs(ball.vy)*.85;}
    // The shooter lane carries a new ball past the right return rail.
    if(ball.launching){if(ball.y>410)continue;ball.launching=false;ball.vx=-240;}
    for(const [i,target] of TARGETS.entries()){
      const dx=ball.x-target.x,dy=ball.y-target.y,d=Math.hypot(dx,dy),r=target.r+TABLE.radius;
      if(d<r){const ux=d?dx/d:0,uy=d?dy/d:1;ball.x=target.x+ux*(r+1);ball.y=target.y+uy*(r+1);const dot=ball.vx*ux+ball.vy*uy; if(dot<0){ball.vx-=2*dot*ux;ball.vy-=2*dot*uy;} ball.vx+=ux*130;ball.vy+=uy*130;
        if(ball.cooldown===0){hitTarget(state,i);ball.cooldown=.1;}
      }
    }
    for(const [x1,y1,x2,y2] of RAILS)segment(ball,x1,y1,x2,y2,14);
    for(const [isLeft,amount,previous] of [[true,state.left,beforeLeft],[false,state.right,beforeRight]] as const){const f=flipper(isLeft,amount);segment(ball,f.x,f.y,f.tipX,f.tipY,18,amount>previous?1:amount>.8?.35:0);}
    const speed=Math.hypot(ball.vx,ball.vy);if(speed>1050){ball.vx*=1050/speed;ball.vy*=1050/speed;}
  }
  state.balls=state.balls.filter(ball=>ball.y<750);
  if(state.balls.length===0){
    if(state.round===3){state.phase="over";state.message="GAME OVER · Your score is saved";}
    else {state.round++;state.phase="ready";state.message=`Ball ${state.round} of 3 · Space to launch`;}
  }
}
