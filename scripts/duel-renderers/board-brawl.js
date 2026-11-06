import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Thirty-two original, articulated toy soldiers on a complete chessboard.
// The deterministic timeline is rendered to a real video by export_board_brawl.cjs.
const W=1280,H=720,DURATION=12;
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#101726');scene.fog=new T.Fog('#101726',22,45);
const camera=new T.OrthographicCamera(-7.45,7.45,4.19,-4.19,.1,80);
camera.position.set(6.0,11.8,14.4);camera.lookAt(0,.35,0);
scene.add(new T.HemisphereLight('#cbdfff','#3d3142',2.0));
function sun(color,intensity,x,y,z){const l=new T.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l);return l;}
const key=sun('#fff0d8',3.4,-6,11,9);key.castShadow=true;key.shadow.mapSize.set(1536,1536);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8});key.shadow.normalBias=.035;key.shadow.bias=-.0002;key.shadow.radius=3;
sun('#9fc5ff',2.2,8,6,-7);sun('#e1c3ff',1.2,-8,4,-5);
const mat=(color,roughness=.35,metalness=.12)=>new T.MeshStandardMaterial({color,roughness,metalness});
const ivory=mat('#f5f0e5',.28,.12),ivoryEdge=mat('#c1c5c6',.4,.12),obsidian=mat('#1a1e27',.26,.28),obsidianEdge=mat('#495160',.3,.3),silver=mat('#b9c5d1',.24,.72),ink=mat('#151922',.4),eye=mat('#fffbef',.3),gold=mat('#dcb76f',.32,.48),pale=mat('#e1e8df',.38),dark=mat('#475365',.4,.18),wood=mat('#252234',.35,.25),groundMat=mat('#151b2a',.65);
const sphereGeo=new T.SphereGeometry(1,18,12),boxGeo=new T.BoxGeometry(1,1,1),coneGeo=new T.ConeGeometry(1,1,20),cylGeo=new T.CylinderGeometry(1,1,1,24),torusGeo=new T.TorusGeometry(1,.07,8,32);
function mesh(parent,geo,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function box(p,m,x,y,z,w,h,d){return mesh(p,boxGeo,m,x,y,z,w,h,d)}
function ball(p,m,x,y,z,r,sx=1,sy=1,sz=1){return mesh(p,sphereGeo,m,x,y,z,r*sx,r*sy,r*sz)}
function cyl(p,m,x,y,z,r,h){return mesh(p,cylGeo,m,x,y,z,r,h,r)}
function cone(p,m,x,y,z,r,h){return mesh(p,coneGeo,m,x,y,z,r,h,r)}
function ring(p,m,x,y,z,r){const o=mesh(p,torusGeo,m,x,y,z,r,r,r);o.rotation.x=Math.PI/2;return o}
function rod(p,m,a,b,r){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);const o=cyl(p,m,0,0,0,r,delta.length());o.position.copy(start.add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
function flatten(g){
 // Merge fixed details by material so a crowded scene stays quick to render.
 g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),buckets=new Map();
 g.traverse(o=>{if(!o.isMesh)return;const b=buckets.get(o.material)||[];const geom=o.geometry.clone();geom.applyMatrix4(inv.clone().multiply(o.matrixWorld));b.push(geom);buckets.set(o.material,b)});
 const result=new T.Group();for(const [m,geometries] of buckets){const merged=mergeGeometries(geometries);const o=new T.Mesh(merged,m);o.castShadow=true;o.receiveShadow=true;result.add(o);for(const geometry of geometries)geometry.dispose()}
 return result;
}

// The full 8 × 8 board, framed by a carved metallic rim.
const board=new T.Group();scene.add(board);box(board,wood,0,-.16,0,8.8,.34,8.8);box(board,silver,0,.025,0,8.52,.07,8.52);box(board,wood,0,.075,0,8.3,.06,8.3);
for(let x=0;x<8;x++)for(let z=0;z<8;z++)box(board,(x+z)%2?pale:dark,x-3.5,.115,z-3.5,.992,.035,.992);
for(let x of [-4.28,4.28])for(let z=-4;z<=4;z+=1)ball(board,gold,x,.045,z,.035);
for(let z of [-4.28,4.28])for(let x=-4;x<=4;x+=1)ball(board,gold,x,.045,z,.035);
const ground=mesh(scene,new T.PlaneGeometry(100,100),groundMat,0,-.34,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
// Low stylized battlements and distant glow make the board feel like an arena.
const castle=mat('#293247',.75);box(scene,castle,0,.4,-7,17,1.5,.4);
for(let x=-8;x<=8;x+=.8)box(scene,castle,x,1.3,-7,.48,.4,.45);
for(let x of [-7.5,7.5]){cyl(scene,castle,x,1.6,-7,1,3.9);for(let i=0;i<8;i++){const a=i*Math.PI/4;box(scene,castle,x+Math.sin(a)*.78,3.7,-7+Math.cos(a)*.78,.45,.45,.4)}}

function createTemplate(type,side){
 const main=side==='white'?ivory:obsidian,edge=side==='white'?ivoryEdge:obsidianEdge,contrast=side==='white'?ink:eye;
 const root=new T.Group(),body=new T.Group();root.add(body);
 // Pedestal, short legs, breastplate, face and eyes are miniature chess men.
 cyl(body,main,0,.10,0,.43,.15);cyl(body,edge,0,.19,0,.36,.055);ring(body,silver,0,.17,0,.37);
 for(const s of [-1,1]){cyl(body,edge,s*.15,.30,0,.07,.19);ball(body,main,s*.15,.22,.08,.11,1,.55,1.35)}
 cyl(body,main,0,.53,0,.27,.46);ball(body,main,0,.65,0,.27,1,.8,.72);cyl(body,edge,0,.42,0,.285,.065);box(body,silver,0,.42,.282,.12,.08,.03);
 ball(body,main,0,1.00,.01,.255,1,1.05,.9);ball(body,main,0,.97,.25,.06,1,.8,.9);
 for(const s of [-1,1]){ball(body,main,s*.245,.99,0,.065,.7,1,.75);ball(body,eye,s*.092,1.055,.222,.064,.8,1,.45);ball(body,ink,s*.092+.012,1.05,.255,.027,.8,1,.5);const brow=box(body,contrast,s*.09,1.135,.23,.1,.022,.025);brow.rotation.z=-s*.15;}
 rod(body,contrast,[-.065,.915,.226],[.065,.915,.226],.012);
 const helm=new T.Group();helm.position.set(0,1.16,0);body.add(helm);
 if(type==='pawn'){
   ball(helm,main,0,.02,0,.265,1,.64,1);ring(helm,edge,0,.0,0,.26);cyl(helm,edge,0,.18,0,.06,.06);ball(helm,main,0,.25,0,.09);
 } else if(type==='rook'){
   cyl(helm,main,0,.12,0,.28,.29);ring(helm,silver,0,-.01,0,.28);cyl(helm,ink,0,.27,0,.2,.012);
   for(let i=0;i<8;i++){const a=i*Math.PI/4, tooth=box(helm,edge,Math.sin(a)*.22,.32,Math.cos(a)*.22,.12,.16,.10);tooth.rotation.y=a}
 } else if(type==='bishop'){
   cone(helm,main,0,.19,0,.27,.46);ring(helm,edge,0,.0,0,.27);ball(helm,silver,0,.43,0,.065);box(helm,edge,0,.23,.23,.04,.22,.04);
 } else if(type==='knight'){
   // A horse-head crest atop a human knight's helmet, including ears and mane.
   ball(helm,main,0,.02,0,.27,1,.65,1);ring(helm,edge,0,0,0,.27);ball(helm,edge,0,.22,0,.16,.68,1.15,.8);
   ball(helm,edge,0,.27,.13,.10,.65,.65,1.1);cone(helm,edge,-.055,.38,0,.045,.15);cone(helm,edge,.055,.38,0,.045,.15);
   for(let y=.12;y<.35;y+=.07)ball(helm,main,0,y,-.14,.06);
 } else {
   // Royal crowns use five points; only the king has the chess king's cross.
   cyl(helm,main,0,.11,0,.27,.23);ring(helm,gold,0,0,0,.27);
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7;cone(helm,edge,Math.sin(a)*.22,.27,Math.cos(a)*.22,.08,.20);ball(helm,gold,Math.sin(a)*.22,.37,Math.cos(a)*.22,.035)}
   if(type==='king'){box(helm,silver,0,.49,0,.055,.27,.055);box(helm,silver,0,.52,0,.17,.05,.06)}
   else ball(helm,gold,0,.40,0,.075);
 }
 const torso=flatten(body);
 const arm=new T.Group(),armArt=new T.Group();arm.position.set(.26,.73,0);root.add(arm);
 ball(armArt,main,0,0,0,.12);rod(armArt,edge,[0,0,0],[.17,-.16,.03],.065);ball(armArt,main,.17,-.16,.03,.07);rod(armArt,edge,[.17,-.16,.03],[.30,-.08,.09],.06);ball(armArt,main,.30,-.08,.09,.075);
 const w=new T.Group();w.position.set(.3,-.08,.09);armArt.add(w);
 if(type==='rook'){
   rod(w,edge,[0,-.10,0],[0,.48,0],.035);box(w,main,0,.48,0,.43,.23,.21);for(const x of [-.13,.13])box(w,silver,x,.48,0,.035,.24,.22);
 } else if(type==='bishop'){
   rod(w,edge,[0,-.08,0],[0,.60,0],.028);ball(w,gold,0,.62,0,.09);ring(w,silver,0,.59,0,.10);
 } else if(type==='queen'){
   rod(w,edge,[0,-.08,0],[0,.53,0],.032);ball(w,gold,0,.57,0,.10);for(let i=0;i<4;i++){const a=i*Math.PI/2;ball(w,silver,Math.sin(a)*.1,.59,Math.cos(a)*.1,.04)}
 } else {
   rod(w,edge,[0,-.1,0],[0,.08,0],.035);box(w,gold,0,.08,0,.24,.035,.06);box(w,silver,0,.34,0,.075,.5,.035);cone(w,silver,0,.625,0,.038,.1);
 }
 arm.add(flatten(armArt));
 const shield=new T.Group(),shieldArt=new T.Group();shield.position.set(-.26,.72,.05);root.add(shield);ball(shieldArt,main,0,0,0,.11);rod(shieldArt,edge,[0,0,0],[-.10,-.15,.08],.065);
 ball(shieldArt,edge,-.14,-.17,.16,.20,.8,1.15,.25);ball(shieldArt,main,-.14,-.17,.21,.15,.8,1.1,.15);ball(shieldArt,silver,-.14,-.17,.235,.045,.8,1,.4);shield.add(flatten(shieldArt));
 root.add(torso);return root;
}
const templates={};for(const side of ['white','black'])for(const type of ['pawn','rook','knight','bishop','queen','king'])templates[side+type]=createTemplate(type,side);
const ranks=['rook','knight','bishop','queen','king','bishop','knight','rook'],fighters=[];
for(const side of ['white','black'])for(let row=0;row<2;row++)for(let file=0;file<8;file++){
 const type=row===0?ranks[file]:'pawn',figure=templates[side+type].clone();scene.add(figure);
 const sign=side==='white'?1:-1;fighters.push({figure,arm:figure.children[0],shield:figure.children[1],side,type,file,row,sign,startX:file-3.5,startZ:sign*(row===0?3.5:2.5),index:fighters.length});
}
// Comic impact bursts are separate 3D objects, appearing at staggered impacts.
const bursts=[];for(let k=0;k<6;k++){const g=new T.Group();for(let i=0;i<8;i++){const a=i*Math.PI/4;const ray=box(g,i%2?eye:gold,Math.cos(a)*.25,Math.sin(a)*.25,0,.17,.045,.04);ray.rotation.z=a}scene.add(g);bursts.push(g)}
function sprite(message){const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d');ctx.font='900 62px Arial';ctx.textAlign='center';ctx.lineWidth=12;ctx.strokeStyle='#101726';ctx.strokeText(message,512,110);ctx.fillStyle='#fff2cc';ctx.fillText(message,512,110);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false}));s.scale.set(5.2,.98,1);s.renderOrder=20;scene.add(s);return s;}
const title=sprite('THE GREAT CHESS BRAWL!'),ending=sprite('EVERYONE WINS... SORT OF.');
const bonk=sprite('BONK!'),clang=sprite('CLANG!');bonk.scale.set(1.5,.45,1);clang.scale.set(1.75,.5,1);
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v)},ramp=(t,a,b)=>smooth((t-a)/(b-a));
function draw(t){
 t%=DURATION;const charge=ramp(t,1.15,2.7),fight=ramp(t,2.4,3.0)*(1-ramp(t,9.0,9.8)),returnHome=ramp(t,10.65,11.9);
 for(const f of fighters){
   const {figure,arm,shield,sign,file,row,type,index}=f,phase=file*.73+row*1.4+(sign>0?0:1.4),amplitude=(1-returnHome);
   const forward=(row===1?1.95:1.45)*charge*amplitude;
   let x=f.startX+Math.sin(t*2.6+phase)*.12*fight,z=f.startZ-sign*forward;
   const attack=(.5+.5*Math.sin(t*5+phase))*fight;
   z-=sign*attack*.18;
   const step=(Math.abs(Math.sin(t*8+phase))*.10*(charge*(1-ramp(t,9.3,10))));
   const leap=type==='knight'?Math.pow(Math.max(0,Math.sin(t*3.5+phase)),4)*.42*fight:0;
   const knock=(index%5===2 || index%9===4)?ramp(t,5.0+(file%3)*.5,5.5+(file%3)*.5)*(1-ramp(t,9.5,10.5)):0;
   figure.position.set(x,.135+step+leap,z);figure.scale.setScalar(.72);
   figure.rotation.set(knock*sign*1.22,sign>0?Math.PI:.0,Math.sin(t*4+phase)*.12*fight+knock*(file%2?-.12:.12));
   arm.rotation.z=(Math.sin(t*6+phase)*.85-.20)*fight;arm.rotation.x=(sign>0?-1:1)*(.6+attack*.7)*fight;
   shield.rotation.z=-Math.sin(t*5+phase)*.38*fight;shield.rotation.x=.35*fight;
 }
 for(let i=0;i<bursts.length;i++){
   const b=bursts[i],phase=(t-3.05-i*.32)%2.1;b.visible=phase>=0&&phase<.30&&fight>.1;
   b.position.set(-2.8+i*1.1,1.05+(i%2)*.35,(i%2?-.45:.45));b.rotation.set(0,0,t*4+i);b.scale.setScalar(1+Math.max(0,phase)*1.2);
 }
 title.visible=t<1.6;title.position.set(0,3.1,-2.0);ending.visible=t>9.1&&t<10.6;ending.position.set(0,3.1,-2.0);
 bonk.visible=t>3.0&&t<3.65||t>6.6&&t<7.15;bonk.position.set(-2.5,1.7,0);clang.visible=t>4.2&&t<4.9||t>7.6&&t<8.2;clang.position.set(2.1,1.8,0);
 camera.position.set(6+Math.sin(t*.33)*.3,11.8,14.4);camera.lookAt(0,.35,0);renderer.render(scene,camera);
}
window.drawBoardBrawl=t=>{draw(t);return renderer.domElement.toDataURL('image/png').split(',')[1]};window.brawlReady=true;draw(0);
if(!location.search.includes('export')){const start=performance.now();function tick(now){draw((now-start)/1000);requestAnimationFrame(tick)}requestAnimationFrame(tick)}
