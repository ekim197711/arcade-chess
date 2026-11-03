import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');});
 await page.goto(server.resolvedUrls.local[0]+'#settings');const section=page.getByRole('region',{name:'Emoji reactions',exact:true});await section.getByRole('checkbox').waitFor();
 async function contrast(){return await section.evaluate(el=>{const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);const lum=value=>rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const bg=getComputedStyle(el.closest('.settings-card')).backgroundColor;return [...el.querySelectorAll('h2,p,label')].map(item=>{const fg=getComputedStyle(item).color;const a=lum(fg),b=lum(bg);return {text:item.textContent,color:fg,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});});}
 for(const theme of ['standard','freestyle']){await page.locator('.app-shell').evaluate((el,theme)=>el.classList.toggle('app-shell-freestyle',theme==='freestyle'),theme);for(const result of await contrast())assert(result.ratio>=4.5,`${theme}: ${JSON.stringify(result)}`);}
 await page.locator('.app-shell').evaluate(el=>{el.classList.remove('app-shell-freestyle');el.style.setProperty('--text-secondary','#dce6f5');el.style.setProperty('--panel','#17223a');});
 assert.equal(await section.locator('p').first().evaluate(el=>getComputedStyle(el).color),'rgb(220, 230, 245)');assert.equal(await section.evaluate(el=>getComputedStyle(el.closest('.settings-card')).backgroundColor),'rgb(23, 34, 58)');for(const result of await contrast())assert(result.ratio>=4.5);
 await page.locator('.app-shell').evaluate(el=>el.removeAttribute('style'));
 await section.getByRole('checkbox').uncheck();assert.equal(await section.getByRole('checkbox').isChecked(),false);await section.getByRole('checkbox').check();
 for(const width of [390,1280]){await page.setViewportSize({width,height:1000});await section.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await section.locator('..').screenshot({path:`.tmp/settings-emoji-palette-${width}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS readable emoji settings (4.5:1+), standard/Freestyle contrast, live palette overrides, checkbox behavior and mobile layout');
}finally{await browser?.close();await server.close();}
