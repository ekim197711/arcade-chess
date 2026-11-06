// Requires Three.js, Playwright and ffmpeg. NODE_PATH can point to a separate tools install.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../public/animations/medieval-duels');
const source=path.resolve(__dirname,'duel-renderers');
const build=path.dirname(require.resolve('three'));
const addons=path.resolve(build,'../examples/jsm');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let file;
 if(url.pathname.startsWith('/vendor/')) file=path.join(build,path.basename(url.pathname));
 else if(url.pathname==='/addons/utils/BufferGeometryUtils.js') file=path.join(addons,'utils/BufferGeometryUtils.js');
 else file=path.join(source,path.basename(url.pathname));
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.render')?'text/html':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>console.error(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/board-brawl.render?export`);await page.waitForFunction(()=>window.brawlReady,{timeout:30000});
  if(process.argv.includes('--stills')){
   for(const t of [0,2,3.5,5.5,7.5,9.5]){const data=await page.evaluate(t=>drawBoardBrawl(t),t);fs.writeFileSync(path.join(os.tmpdir(),`board-brawl-${t}.png`),Buffer.from(data,'base64'));}
   console.log(`Preview frames saved in ${os.tmpdir()}`);return;
  }
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-brawl-'));
  for(let i=0;i<288;i++){
   const data=await page.evaluate(t=>drawBoardBrawl(t),i/24);fs.writeFileSync(path.join(temp,`${String(i).padStart(4,'0')}.png`),Buffer.from(data,'base64'));
   if(i%48===0)console.log(`Rendered ${i}/288 frames`);
  }
  fs.copyFileSync(path.join(temp,'0000.png'),path.join(out,'board-brawl-poster.png'));
  for(const ext of ['mp4','webm']){
   const codec=ext==='mp4'?['-c:v','libx264','-crf','24','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart']:['-c:v','libvpx-vp9','-crf','35','-b:v','0','-pix_fmt','yuv420p'];
   const result=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','24','-i',path.join(temp,'%04d.png'),'-an',...codec,path.join(out,`board-brawl.${ext}`)],{encoding:'utf8'});
   if(result.status!==0)throw new Error(result.stderr);console.log(`Exported board-brawl.${ext}`);
  }
  for (const args of [
   ['-i',path.join(out,'board-brawl.mp4'),'-vf','scale=640:-2:flags=lanczos','-c:v','libx264','-crf','29','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(out,'board-brawl-small.mp4')],
   ['-i',path.join(out,'board-brawl-poster.png'),'-vf','scale=640:-2:flags=lanczos','-q:v','3','-frames:v','1',path.join(out,'board-brawl-small-poster.jpg')],
  ]) { const result=spawnSync('ffmpeg',['-y','-loglevel','error',...args],{encoding:'utf8'}); if(result.status!==0)throw new Error(result.stderr); }
  console.log('Exported compact front-page video and poster');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
