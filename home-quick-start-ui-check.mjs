import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, firefox } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{},user_metadata:{full_name:'Test Player',arcade_plan:'very-free'},created_at:'2026-01-01T00:00:00Z'};
const progress={wins:4,losses:0,streak:1,bestStreak:1,bossesDefeated:3,freestyleBossesDefeated:1,progressionVersion:3};
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':JSON.stringify('https://quick-check.supabase.co'),'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test'),'import.meta.env.VITE_GA_MEASUREMENT_ID':'""'},server:{host:'127.0.0.1',port:0,open:false,watch:null}});
let browser;
try {
 await server.listen();browser=await (process.env.CHECK_FIREFOX ? firefox.launch({headless:true}) : chromium.launch({channel:'msedge',headless:true}));const page=await browser.newPage({viewport:{width:1440,height:1080}});const calls=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://quick-check.supabase.co/**',async route=>{
  const u=new URL(route.request().url());let data=null;
  if(u.pathname.endsWith('/app_heartbeat'))data='player';
  else if(u.pathname.endsWith('/user'))data=user;
  else if(u.pathname.endsWith('/player_progress'))data={progress};
  else if(u.pathname.endsWith('/online_players'))data={rating:1200,rated_games:0};
  else if(u.pathname.endsWith('/player_games'))data=[];
  else if(u.pathname.endsWith('/online_games'))data=u.searchParams.get('result')==='is.null'?null:[];
  else if(u.pathname.endsWith('/online_matchmake')){const body=route.request().postDataJSON();calls.push(body);data={queued:!body.p_cancel,game:null,server_now:new Date().toISOString(),fallback_at:new Date(Date.now()+20000).toISOString()};}
  else if(u.pathname.endsWith('/online_social'))data={friends:[],messages:[],reactions:[],emojis_enabled:true};
  else throw new Error(`Unexpected API ${u.pathname}`);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.addInitScript(({user,progress})=>{localStorage.setItem('sb-quick-check-auth-token',JSON.stringify({access_token:'fake',refresh_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));localStorage.setItem(`neon-knights-progress-v1:${user.id}`,JSON.stringify(progress));localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');}, {user,progress});
 await page.goto(server.resolvedUrls.local[0]);
 const first=page.getByRole('button',{name:'Start 3 minute Standard game against a human',exact:true});await first.waitFor();await page.waitForFunction(()=>!document.querySelector('.online-quick-times button').disabled);
 assert.equal(calls.length,0);assert.equal(await page.locator('.online-quick-times button').count(),8);
 const human=await page.locator('.online-home-card').boundingBox(),boss=await page.locator('.boss-run-card').boundingBox(),stats=await page.locator('.home-stats-panel').boundingBox(),options=await page.locator('.home-options-panel').boundingBox();
 assert(human.x>stats.x+stats.width && human.x+human.width<options.x);assert(boss.y>=human.y+human.height);
 const names=await page.locator('.boss-run-label b').allTextContents();assert.notEqual(names[0],names[1]);
 assert.deepEqual(await page.locator('.boss-run-label small').allTextContents(),['250 Elo','150 Elo']);
 await page.waitForFunction(()=>[...document.querySelectorAll('.boss-run-portrait')].every(i=>i.complete&&i.naturalWidth===112));
 const comic=page.frameLocator('.home-comic-strip');
 await comic.getByRole('button',{name:'Pause comic strip',exact:true}).click();
 assert(!await comic.locator('body').evaluate(el=>el.classList.contains('playing')));
 await page.emulateMedia({reducedMotion:'reduce'});assert(!await comic.locator('body').evaluate(el=>el.classList.contains('playing')));
 await page.emulateMedia({reducedMotion:'no-preference'});await comic.getByRole('button',{name:'Pause comic strip',exact:true}).waitFor();
 await page.screenshot({path:'.tmp/home-quick-start-desktop.png',fullPage:true});
 for(const mode of ['Standard','Freestyle'])for(const minutes of [3,5,10,15]){
   await page.getByRole('button',{name:`Start ${minutes} minute ${mode} game against a human`,exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.online-lobby')?.textContent.includes('Cancel search'));
   const join=calls.filter(c=>!c.p_cancel).at(-1);assert.equal(join.p_minutes,minutes);assert.equal(join.p_mode??'standard',mode.toLowerCase());
   await page.getByRole('button',{name:'Cancel search',exact:true}).click();await page.getByRole('button',{name:'Back to home',exact:true}).click();await first.waitFor();
 }
 for(const width of [390,768,1024]){await page.setViewportSize({width,height:900});await page.screenshot({path:`.tmp/home-quick-start-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no horizontal overflow at ${width}`);}
 assert.deepEqual(errors,[]);console.log('PASS centered cards, independent boss portraits, eight single-click matchmaking routes, selected clock/style, mobile/tablet layout, zero automatic matchmaking on home.');
}finally{await browser?.close();await server.close();}
