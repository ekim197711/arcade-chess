import assert from 'node:assert/strict';
import {createPinball,launchBall,hitTarget,stepPinball,flipper,TARGETS} from './src/pinballPhysics.ts';
const s=createPinball();launchBall(s);launchBall(s);assert.equal(s.balls.length,1);
hitTarget(s,0);assert.equal(s.mates,0);
for(let i=1;i<6;i++)hitTarget(s,i);
assert.equal(s.captured.length,5);assert(s.message.includes('CHECK!'));
const before=s.score;hitTarget(s,0);assert.equal(s.score,before+5000);assert.equal(s.mates,1);assert.equal(s.balls.length,3);assert.equal(s.captured.length,0);
for(let i=1;i<6;i++)hitTarget(s,i);hitTarget(s,0);assert.equal(s.balls.length,3,'multiball never grows past three');
s.balls[0].y=800;stepPinball(s,1/120,false,false);assert.equal(s.round,1,'a multiball drain does not spend a new ball');
for(let round=1;round<=3;round++){s.balls.forEach(b=>b.y=800);stepPinball(s,1/120,false,false);assert.equal(s.phase,round===3?'over':'ready');if(round<3)launchBall(s);}
const score=s.score;hitTarget(s,1);launchBall(s);assert.equal(s.score,score);assert.equal(s.balls.length,0);
assert(flipper(true,1).tipY<flipper(true,0).tipY);assert(flipper(false,1).tipY<flipper(false,0).tipY);
for(let trial=0;trial<20;trial++){
 const game=createPinball();launchBall(game);
 for(let frame=0;frame<120*180&&game.phase==='playing';frame++){
   stepPinball(game,1/120,(frame+trial*13)%130<65,(frame+trial*19)%170<85);
   for(const ball of game.balls){assert(Number.isFinite(ball.x+ball.y+ball.vx+ball.vy));assert(Math.hypot(ball.vx,ball.vy)<=1050.01);}
 }
 assert(game.score>0,'launched ball reaches targets');
}
const collision=createPinball();launchBall(collision);collision.balls[0]={x:TARGETS[1].x,y:TARGETS[1].y-30,vx:0,vy:100,cooldown:0};stepPinball(collision,1/120,false,false);assert(collision.captured.includes(1));
console.log('PASS captures, check, checkmate, three-ball multiball, drain accounting, legal phase transitions and 20 deterministic physics simulations.');
