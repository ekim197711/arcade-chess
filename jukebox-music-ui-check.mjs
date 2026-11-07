import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});
let browser;
try {
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/music/jukebox/'))requests.push(r.url());});
 await page.addInitScript(()=>{
  localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('neon-knights-sound-v1','off');
  localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');
  const NativeAudio=window.Audio;window.jukeboxElements=[];
  window.Audio=function(...args){const audio=new NativeAudio(...args);window.jukeboxElements.push(audio);return audio;};
 });
 await page.goto(server.resolvedUrls.local[0]+'#settings');
 const next=page.getByRole('button',{name:'Next song',exact:true});await next.waitFor();
 assert(await next.isDisabled());assert.equal(requests.length,0);
 await page.getByRole('button',{name:'Arcade music OFF',exact:true}).click();
 await page.waitForFunction(()=>window.jukeboxElements.some(a=>a.src.includes('/music/jukebox/')&&!a.paused&&a.currentTime>.05));
 const current=()=>page.evaluate(()=>{const a=window.jukeboxElements.find(a=>a.src.includes('/music/jukebox/'));return {src:a.src,paused:a.paused,time:a.currentTime,volume:a.volume,loop:a.loop};});
 const first=await current();assert.equal(first.loop,false);
 await next.click();await page.waitForFunction(first=>window.jukeboxElements.some(a=>a.src.includes('/music/jukebox/')&&a.src!==first&&!a.paused),first.src);
 const second=await current();assert.notEqual(first.src,second.src);
 await page.evaluate(()=>{const a=window.jukeboxElements.find(a=>a.src.includes('/music/jukebox/'));a.currentTime=a.duration-.1;});
 await page.waitForFunction(second=>window.jukeboxElements.some(a=>a.src===second&&!a.paused&&a.currentTime<5),first.src,{timeout:10000});
 assert.match(await page.locator('.jukebox-now-playing').textContent(),/Last Booth Blues|Neon After Midnight/);
 await page.getByRole('slider',{name:'Music volume',exact:true}).fill('30');
 assert(Math.abs((await current()).volume-.09)<.001);
 await page.getByRole('button',{name:'Arcade music ON',exact:true}).click();assert.equal((await current()).paused,true);assert(await next.isDisabled());
 const tracks=await page.evaluate(async()=>{
  const context=new AudioContext();const metadata=await(await fetch('/music/jukebox/manifest.json')).json();const results=[];
  for(const track of metadata){const response=await fetch(track.src);const buffer=await context.decodeAudioData(await response.arrayBuffer());let energy=0;const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i+=32)energy+=samples[i]**2;results.push({title:track.title,seconds:buffer.duration,channels:buffer.numberOfChannels,energy});}
  await context.close();return results;
 });
 assert.equal(tracks.length,6);assert(tracks.every(t=>t.seconds>75&&t.channels===2&&t.energy>10));
 for(const width of [390,1280]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);console.log('PASS browser MP3 decoding for six stereo songs, actual playback, end-of-song rotation, Next song, persisted volume, music mute independent of SFX, responsive settings and zero page errors.');
}finally{await browser?.close();await server.close();}
