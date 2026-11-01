const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../public/animations/medieval-duels');
const source=path.resolve(__dirname,'duel-renderers');
const three=path.dirname(require.resolve('three'));
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');const file=url.pathname.startsWith('/vendor/')?path.join(three,path.basename(url.pathname)):path.join(source,path.basename(url.pathname));
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.render')?'text/html':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:768,height:432}});page.on('pageerror',e=>console.error(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/three-duels.render?export`);await page.waitForFunction(()=>window.duelReady);
 if(process.argv.includes('--stills')){
  for(const [name,pawn] of [['pawn-wins',true],['rook-wins',false]])for(const t of [0,2.5,3.4,4.8]){const data=await page.evaluate(({t,pawn})=>drawDuel3D(t,pawn),{t,pawn});fs.writeFileSync(path.join(out,`3d-${name}-${t}.png`),Buffer.from(data,'base64'));}
  console.log('3D preview stills ready');return;
 }
 for(const [name,pawn] of [['pawn-wins',true],['rook-wins',false]]){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-3d-'));
  for(let i=0;i<216;i++){const data=await page.evaluate(({t,pawn})=>drawDuel3D(t,pawn),{t:i/30,pawn});fs.writeFileSync(path.join(temp,`${String(i).padStart(4,'0')}.png`),Buffer.from(data,'base64'));if(i%60===0)console.log(`${name}: ${i}/216 frames`);}
  fs.copyFileSync(path.join(temp,'0000.png'),path.join(out,`${name}-3d-poster.png`));
  for(const ext of ['mp4','webm']){const args=['-y','-loglevel','error','-framerate','30','-i',path.join(temp,'%04d.png'),'-an',...(ext==='mp4'?['-c:v','libx264','-crf','23','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart']:['-c:v','libvpx-vp9','-crf','34','-b:v','0','-pix_fmt','yuv420p']),path.join(out,`${name}-3d.${ext}`)];const r=spawnSync('ffmpeg',args,{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}
  console.log(`Exported ${name}-3d`);
 }
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
