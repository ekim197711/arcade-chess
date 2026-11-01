import * as T from 'three';

// Sculpted, articulated chess miniatures; all surfaces are real 3D geometry.
const W=768,H=432;
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#101520');scene.fog=new T.Fog('#101520',15,29);
const camera=new T.PerspectiveCamera(34,W/H,.1,80);camera.position.set(4.4,4.0,11.8);camera.lookAt(0,1.18,0);
scene.add(new T.HemisphereLight('#dfeaff','#333044',2.1));
function light(color,power,x,y,z){const l=new T.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l);return l;}
const key=light('#fff1dc',4,-3,8,6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.025;key.shadow.bias=-.0001;key.shadow.radius=4;
light('#a2c9ff',3,5,5,-4);light('#c5b7ef',1.2,-5,3,-3);
const mat=(color,roughness=.28,metalness=.12)=>new T.MeshStandardMaterial({color,roughness,metalness});
const ivory=mat('#f6f1e5',.24,.12),ivoryDark=mat('#c9c5bb',.35,.1),black=mat('#20232b',.23,.28),blackEdge=mat('#3a404b',.3,.35),silver=mat('#aebdce',.22,.78),ink=mat('#151722',.4),white=mat('#fff8e7',.2),floorMat=mat('#151a28',.55,.15);
function mesh(geo,material,parent,x=0,y=0,z=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function sphere(parent,m,x,y,z,r,sx=1,sy=1,sz=1){const o=mesh(new T.SphereGeometry(r,28,20),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
function cylinder(parent,m,x,y,z,top,bottom,height,segments=48){return mesh(new T.CylinderGeometry(top,bottom,height,segments),m,parent,x,y,z);}
function box(parent,m,x,y,z,w,h,d,round=0){return mesh(new T.BoxGeometry(w,h,d),m,parent,x,y,z);}
function torus(parent,m,x,y,z,r,tube){const o=mesh(new T.TorusGeometry(r,tube,12,56),m,parent,x,y,z);o.rotation.x=Math.PI/2;return o;}
function rod(parent,m,a,b,r){const start=new T.Vector3(...a),end=new T.Vector3(...b);const o=cylinder(parent,m,0,0,0,r,r,start.distanceTo(end),20);o.position.copy(start.add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...b).sub(new T.Vector3(...a)).normalize());return o;}
function lathe(parent,m,pts,y=0){return mesh(new T.LatheGeometry(pts.map(p=>new T.Vector2(...p)),64),m,parent,0,y);}
function textTexture(lines){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.clearRect(0,0,1024,256);ctx.textAlign='center';lines.forEach(({text,y,size,color})=>{ctx.font=`800 ${size}px Arial,sans-serif`;ctx.fillStyle=color;ctx.fillText(text,512,y)});const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}
function caption(text,sub){const tex=textTexture([{text,y:105,size:60,color:'#fff5df'},{text:sub,y:174,size:28,color:'#bfcddd'}]);const o=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false}));o.scale.set(6,1.5,1);o.position.set(0,3.65,0);o.renderOrder=10;scene.add(o);return o;}
// Floating display board; bevel rings and checkered marble-like tiles.
const stage=new T.Group();scene.add(stage);
box(stage,mat('#090d16',.3,.5),0,-.2,0,8.6,.28,4.6);
box(stage,silver,0,-.08,0,8.45,.07,4.45);
for(let x=0;x<10;x++)for(let z=0;z<5;z++)box(stage,(x+z)%2?mat('#3d4859',.32,.25):mat('#b9c3c8',.34,.1),(x-4.5)*.82,-.015,(z-2)*.82,.812,.08,.812);
const ground=mesh(new T.PlaneGeometry(100,100),floorMat,scene,0,-.38,0);ground.rotation.x=-Math.PI/2;

function pawnSymbol(parent,m,y,z,scale=1){const g=new T.Group();g.position.set(0,y,z);g.scale.setScalar(scale);parent.add(g);sphere(g,m,0,.1,0,.065);cylinder(g,m,0,-.025,0,.035,.07,.15,20);cylinder(g,m,0,-.11,0,.1,.105,.035,24);return g;}
function rookSymbol(parent,m,y,z,scale=1){const g=new T.Group();g.position.set(0,y,z);g.scale.setScalar(scale);parent.add(g);box(g,m,0,0,0,.16,.18,.045);for(let i=-1;i<=1;i++)box(g,m,i*.065,.12,0,.04,.07,.045);box(g,m,0,-.12,0,.21,.04,.055);return g;}

function knight(rook){
 const root=new T.Group(),body=new T.Group();scene.add(root);root.add(body);const main=rook?black:ivory,edge=rook?blackEdge:ivoryDark,contrast=rook?ivory:ink;
 // Iconic round chess base, small boots and articulated legs.
 lathe(body,main,[[0,0],[.48,0],[.53,.06],[.53,.12],[.47,.18],[.4,.2],[0,.2]]);
 torus(body,edge,0,.14,0,.48,.024);
 const legs=[];for(let side of [-1,1]){const leg=new T.Group();leg.position.set(side*.18,.61,0);body.add(leg);rod(leg,edge,[0,0,0],[0,-.3,0],.095);sphere(leg,main,0,-.12,.035,.12,1,.85,1);sphere(leg,main,0,-.34,.12,.14,1, .62,1.7);legs.push(leg);}
 // A bell-shaped medieval tabard echoes the stem of a pawn / tower of a rook.
 lathe(body,main,[[0,0],[.28,0],[.36,.08],[.29,.36],[.27,.57],[.19,.67],[0,.67]],.56);
 torus(body,edge,0,.82,0,.29,.035);box(body,silver,0,.83,.29,.12,.09,.035);
 (rook?rookSymbol:pawnSymbol)(body,edge,1.13,.27,1.15);
 const head=new T.Group();head.position.y=1.62;body.add(head);
 sphere(head,main,0,0,0,.36,1,1.02,.94);
 for(const side of [-1,1])sphere(head,main,side*.34,-.025,0,.095,.65,1,.7);
 sphere(head,main,0,-.035,.35,.09,.8,.75,1.3);
 // Contrasting eyeballs and pupils provide comic expression at small sizes.
 const eyes=[];for(const side of [-1,1]){sphere(head,white,side*.135,.065,.299,.095,.82,1.1,.45);const pupil=sphere(head,ink,side*.135+.025,.065,.342,.037,.8,1,.4);eyes.push(pupil);const brow=box(head,contrast,side*.135,.178,.315,.17,.035,.04);brow.rotation.z=side*.12;}
 const mouth=mesh(new T.TorusGeometry(.095,.018,8,28,Math.PI),contrast,head,0,-.13,.326);mouth.rotation.z=Math.PI;
 if(rook){sphere(head,edge,0,-.255,.16,.2,1,.55,.65);for(let i=-1;i<=1;i++)sphere(head,main,i*.07,-.16,.31,.07,1,.35,.5);}
 const helm=new T.Group();helm.position.y=.16;head.add(helm);
 if(rook){
   cylinder(helm,main,0,.16,0,.43,.41,.35);
   torus(helm,silver,0,-.015,0,.412,.035);torus(helm,edge,0,.3,0,.43,.025);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;const tooth=box(helm,edge,Math.sin(a)*.35,.42,Math.cos(a)*.35,.18,.24,.16);tooth.rotation.y=a;}
   // Dark open crown makes the battlement unmistakably a rook.
   cylinder(helm,ink,0,.335,0,.3,.3,.015);
 }else{
   mesh(new T.SphereGeometry(.405,40,24,0,Math.PI*2,0,Math.PI/2),main,helm,0,.005,0);
   torus(helm,edge,0,.005,0,.405,.038);cylinder(helm,edge,0,.405,0,.08,.14,.08);sphere(helm,main,0,.52,0,.145);
   // Reinforced nasal strip and chin straps suggest a medieval foot soldier.
   for(const side of [-1,1])box(head,edge,side*.29,-.02,.2,.045,.32,.07);
 }
 const arm=new T.Group();arm.position.set(.32,1.2,0);body.add(arm);
 sphere(arm,main,0,0,0,.19,1.1,.8,1.1);rod(arm,edge,[.02,-.02,0],[.2,-.22,.04],.09);sphere(arm,main,.2,-.22,.04,.105);rod(arm,edge,[.2,-.22,.04],[.38,-.14,.13],.085);sphere(arm,main,.38,-.14,.13,.115);
 const weapon=new T.Group();weapon.position.set(.38,-.14,.13);arm.add(weapon);
 if(rook){rod(weapon,edge,[0,-.12,0],[0,.66,0],.055);box(weapon,main,0,.65,0,.66,.35,.32);for(let s of [-1,1])box(weapon,silver,s*.2,.65,0,.055,.365,.335);}
 else{rod(weapon,edge,[0,-.14,0],[0,.06,0],.045);box(weapon,silver,0,.065,0,.32,.05,.075);const blade=new T.Shape();blade.moveTo(-.065,.09);blade.lineTo(-.065,.71);blade.lineTo(0,.88);blade.lineTo(.065,.71);blade.lineTo(.065,.09);const b=mesh(new T.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1}),silver,weapon,0,0,-.02);b.castShadow=true;sphere(weapon,main,0,-.17,0,.06);}
 const shieldArm=new T.Group();shieldArm.position.set(-.34,1.2,0);body.add(shieldArm);sphere(shieldArm,main,0,0,0,.18);rod(shieldArm,edge,[0,0,0],[-.08,-.3,.12],.1);
 const shield=new T.Shape();shield.moveTo(-.25,.24);shield.quadraticCurveTo(0,.34,.25,.24);shield.lineTo(.23,-.12);shield.quadraticCurveTo(.16,-.33,0,-.44);shield.quadraticCurveTo(-.2,-.3,-.24,-.12);shield.closePath();
 const plate=mesh(new T.ExtrudeGeometry(shield,{depth:.07,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:3}),edge,shieldArm,-.07,-.25,.17);plate.rotation.y=-.12;
 const badge=new T.Group();badge.position.set(-.07,-.25,.28);shieldArm.add(badge);(rook?rookSymbol:pawnSymbol)(badge,main,0,0,1.2);
 if(rook)root.scale.setScalar(1.15);
 return {root,body,head,helm,arm,shieldArm,legs,mouth,eyes,rook};
}
const pawn=knight(false),rook=knight(true);
const stars=[];for(let i=0;i<5;i++){const shape=new T.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5,r=j%2?.05:.11;const x=Math.sin(a)*r,y=Math.cos(a)*r;j?shape.lineTo(x,y):shape.moveTo(x,y)}shape.closePath();stars.push(mesh(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false}),silver,scene));}
const impact=new T.Group();scene.add(impact);for(let i=0;i<9;i++){const a=i*Math.PI*2/9;const bar=box(impact,white,Math.cos(a)*.3,Math.sin(a)*.3,0,.15,.035,.035);bar.rotation.z=a;}
const winPawn=caption('SMALL PIECE. BIG ATTITUDE.','PAWN WINS'),winRook=caption('ROOK. SOLID.','ROOK WINS');
const startTitle=caption('IVORY vs OBSIDIAN','THE PAWN & THE ROOK');
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},ramp=(t,a,b)=>smooth((t-a)/(b-a)),lerp=(a,b,t)=>a+(b-a)*t;
function pose(k,x,y,rz,arm,face,squash=1){k.root.position.set(x,y,0);k.root.rotation.set(0,k.rook?-.22:.22,rz);k.body.scale.set(k.rook?-squash:squash,1/squash,1);k.arm.rotation.z=arm;k.helm.position.y=.16;k.helm.rotation.z=0;k.head.rotation.z=0;k.shieldArm.rotation.z=0;k.legs.forEach(l=>l.rotation.z=0);k.mouth.scale.set(1,face==='shock'?2:1,1);k.eyes.forEach(e=>e.scale.y=face==='dazed'?.2:1);}
window.drawDuel3D=(t,pawnWins=true)=>{
 t%=7.2;const approach=ramp(t,.55,1.65),fall=ramp(t,3.55,4.25),reset=ramp(t,6.35,7.2);
 let p={x:lerp(-2.1,-.83,approach),y:.04,angle:0,arm:-.22,face:'normal',squash:1};
 let r={x:lerp(2.05,.85,approach),y:.04,angle:0,arm:-.25,face:'normal',squash:1};
 if(pawnWins){
  r.arm=-.25+1.3*ramp(t,1.7,2.1)-2.7*ramp(t,2.1,2.65)+1.4*ramp(t,2.9,3.25);
  const duck=ramp(t,2.05,2.4)*(1-ramp(t,3.1,3.5));p.squash=1+duck*.32;
  const poke=ramp(t,2.7,3.15)*(1-ramp(t,3.4,3.8));p.arm=-.22-1.55*poke;p.x+=poke*.35;p.y-=poke*.05;
  const hop=Math.sin(clamp((t-3.25)/.7)*Math.PI);r.y+=hop*.75;r.face=t>3.2?'shock':'normal';r.x+=fall*.55;r.angle=-fall*Math.PI*.47;
  if(t>4.3){r.face='dazed';p.y+=Math.abs(Math.sin((t-4.3)*6))*.12*(1-reset);p.arm=-.22+Math.sin(t*7)*.12;}
 }else{
  const jab=ramp(t,1.7,2.1)*(1-ramp(t,2.35,2.6));p.arm=-.22-1.4*jab;p.x+=jab*.24;
  r.arm=-.25+1.3*ramp(t,2.45,2.95)-2.7*ramp(t,2.95,3.45)+1.4*ramp(t,3.65,4.1);
  p.x-=fall*.5;p.y+=Math.sin(fall*Math.PI)*.8;p.angle=fall*Math.PI*2.47;p.face=t>3.35?'shock':'normal';if(t>4.25)p.face='dazed';
 }
 for(const [k,a] of [[pawn,p],[rook,r]]){a.x=lerp(a.x,k.rook?2.05:-2.1,reset);a.y=lerp(a.y,.04,reset);a.angle*=1-reset;a.arm=lerp(a.arm,-.22,reset);a.squash=lerp(a.squash,1,reset);if(reset>.5)a.face='normal';pose(k,a.x,a.y,a.angle,a.arm,a.face,a.squash);if(t>.55&&t<1.65){k.root.position.y+=Math.abs(Math.sin(t*14))*.07;k.legs.forEach((l,i)=>l.rotation.z=Math.sin(t*14+i*Math.PI)*.18);}}
 if(pawnWins&&t>3.25&&t<4.2){rook.helm.position.y+=Math.sin((t-3.25)/.95*Math.PI)*.3;rook.helm.rotation.z=Math.sin(t*15)*.14;}
 if(t>4.3&&t<6.35){const winner=pawnWins?pawn:rook;winner.head.rotation.z=Math.sin(t*5)*.08;}
 const down=pawnWins?rook:pawn;const head=down.head.getWorldPosition(new T.Vector3());
 stars.forEach((s,i)=>{s.visible=t>4.25&&t<6.35;const a=t*3+i*2*Math.PI/5;s.position.set(head.x+Math.cos(a)*.38,head.y+.55+Math.sin(a)*.07,head.z+Math.sin(a)*.24);s.rotation.set(.1,t*3+i,.1)});
 impact.visible=t>3.2&&t<3.55;impact.position.set(pawnWins?.85:-.75,pawnWins?.45:1.7,.5);impact.scale.setScalar(1+(t-3.2)*2);impact.rotation.z=t*3;
 winPawn.visible=pawnWins&&t>4.4&&t<6.35;winRook.visible=!pawnWins&&t>4.4&&t<6.35;startTitle.visible=t<1.5||t>6.65;
 const push=Math.sin(clamp((t-1.4)/3.8)*Math.PI);camera.position.set(4.4-push*.55,4.0-push*.3,11.8-push*.3);camera.lookAt(0,1.18,0);
 renderer.render(scene,camera);
 return renderer.domElement.toDataURL('image/png').split(',')[1];
};
window.drawDuel3D(0,true);window.duelReady=true;
if(!location.search.includes('export')){const start=performance.now();function tick(now){drawDuel3D((now-start)/1000,!location.search.includes('rook'));requestAnimationFrame(tick)}requestAnimationFrame(tick)}
