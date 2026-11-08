import { TABLE, TARGETS, RAILS, flipper, type PinballState } from "./pinballPhysics";
export function drawPinball(ctx: CanvasRenderingContext2D, state: PinballState) {
  const {width:w,height:h}=TABLE;
  ctx.clearRect(0,0,w,h);
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#162c42");bg.addColorStop(1,"#080e1d");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(let row=0;row<12;row++)for(let col=0;col<8;col++){ctx.fillStyle=(row+col)%2?"#243b4a33":"#a0c6c008";ctx.fillRect(30+col*52.5,40+row*52.5,52.5,52.5);}
  ctx.lineWidth=8;ctx.strokeStyle="#4e90a2";ctx.beginPath();ctx.moveTo(30,708);ctx.lineTo(30,70);ctx.quadraticCurveTo(30,30,70,30);ctx.lineTo(410,30);ctx.quadraticCurveTo(450,30,450,70);ctx.lineTo(450,708);ctx.stroke();
  ctx.textAlign="center";ctx.fillStyle="#d9e5d8";ctx.font="bold 15px monospace";ctx.fillText("THE ROYAL TABLE",240,61);
  ctx.font="bold 11px monospace";ctx.fillStyle=state.captured.length===5?"#ffda88":"#96b8c7";ctx.fillText(state.captured.length===5?"CHECK · STRIKE THE KING":"CAPTURE FIVE · CHALLENGE THE KING",240,455);
  for(const [i,target] of TARGETS.entries()){
    const lit=i===0?state.captured.length===5:state.captured.includes(i);
    ctx.shadowColor=lit?"#f6d385":"#83d9e2";ctx.shadowBlur=state.hits[i]>0?25:lit?12:0;
    ctx.beginPath();ctx.arc(target.x,target.y,target.r+5,0,Math.PI*2);ctx.fillStyle=lit?"#f6d385":"#48768b";ctx.fill();
    ctx.shadowBlur=0;ctx.beginPath();ctx.arc(target.x,target.y,target.r,0,Math.PI*2);ctx.fillStyle=state.hits[i]>0?"#dfe5c7":lit?"#564322":"#142a42";ctx.fill();
    ctx.fillStyle=state.hits[i]>0?"#132334":"#edf1d9";ctx.font=`${target.r*1.45}px Georgia`;ctx.fillText(target.glyph,target.x,target.y+target.r*.5);
    ctx.font="bold 10px monospace";ctx.fillStyle=lit?"#ffda88":"#bad0d8";ctx.fillText(i===0?"CHECKMATE":target.name.toUpperCase(),target.x,target.y+target.r+21);
  }
  ctx.strokeStyle="#c1a17a";ctx.lineWidth=10;ctx.lineCap="round";
  for(const [x1,y1,x2,y2] of RAILS){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  for(const [left,amount] of [[true,state.left],[false,state.right]] as const){const f=flipper(left,amount);ctx.strokeStyle=amount>.5?"#f3d58c":"#94d7d4";ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.tipX,f.tipY);ctx.stroke();ctx.fillStyle="#223e53";ctx.beginPath();ctx.arc(f.x,f.y,5,0,Math.PI*2);ctx.fill();}
  for(const ball of state.balls){const fill=ctx.createRadialGradient(ball.x-3,ball.y-3,1,ball.x,ball.y,10);fill.addColorStop(0,"#fff");fill.addColorStop(.5,"#d0e8ef");fill.addColorStop(1,"#4f7d91");ctx.fillStyle=fill;ctx.shadowColor="#8be7ff";ctx.shadowBlur=12;ctx.beginPath();ctx.arc(ball.x,ball.y,TABLE.radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  if(state.flash>0){ctx.fillStyle="#12293eea";ctx.fillRect(65,477,350,47);ctx.fillStyle="#ffda88";ctx.font="bold 22px monospace";ctx.fillText("CHECKMATE · MULTIBALL",240,507);}
  ctx.font="11px monospace";ctx.fillStyle="#b4cbd3";ctx.fillText("LEFT SHIFT",111,687);ctx.fillText("RIGHT SHIFT",369,687);
  if(state.phase!=="playing"){ctx.fillStyle="#071321dd";ctx.fillRect(80,480,320,64);ctx.fillStyle="#f1edda";ctx.font="bold 22px monospace";ctx.fillText(state.phase==="over"?"GAME OVER":"SPACE TO LAUNCH",240,509);ctx.font="12px monospace";ctx.fillText(`BALL ${state.round} / 3`,240,530);}
}
