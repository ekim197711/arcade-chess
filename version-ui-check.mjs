import assert from 'node:assert/strict';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
await mkdir('.tmp',{recursive:true});
await writeFile('.tmp/version-fixture.html','<style>*{box-sizing:border-box}body{margin:0;background:#07101e;font-family:Arial}</style><div id="root"></div><script type="module" src="/./.tmp/version-fixture.tsx"></script>');
await writeFile('.tmp/version-fixture.tsx',`import React from 'react';import {createRoot} from 'react-dom/client';import {Administration} from '../src/Administration';const role=new URLSearchParams(location.search).get('role')==='user'?'user':'administrator';createRoot(document.getElementById('root')!).render(<Administration userId="11111111-1111-4111-8111-111111111111" role={role}/>);`);
const server=await createServer({define:{'import.meta.env.DEV':'false','import.meta.env.VITE_SUPABASE_PROD_URL':JSON.stringify('https://version-ui.supabase.co'),'import.meta.env.VITE_SUPABASE_PROD_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test')},server:{host:'127.0.0.1',port:0,open:false}});
let browser,page;
try{
  await server.listen();const loaded=JSON.parse(server.config.define.__APP_BUILD__);
  let record={...loaded,environment:'production',deployedAt:new Date(Date.parse(loaded.builtAt)+60000).toISOString()},mode='ok',requests=0;
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://version-ui.supabase.co/**',route=>{
    const stats=route.request().url().endsWith('/admin_statistics');
    return route.fulfill({contentType:'application/json',body:JSON.stringify(stats?{users:3,online:1,games:{today:2,hour:1,week:2,month:2},asOf:new Date().toISOString()}:[])});
  });
  await page.route('https://version-ui.example/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/deployment.json'){
      requests++;
      return route.fulfill({contentType:mode==='html'?'text/html':'application/json',body:mode==='html'?'<html>SPA fallback</html>':JSON.stringify(mode==='invalid'?{version:'1.0.0'}:record)});
    }
    try{const response=await route.fetch({url:server.resolvedUrls.local[0].replace(/\/$/,'')+url.pathname+url.search});await route.fulfill({response});}catch{await route.abort().catch(()=>{});}
  });
  await page.clock.install();
  const url='https://version-ui.example/.tmp/version-fixture.html';await page.goto(url);
  const panel=page.getByRole('region',{name:'Version & deployment',exact:true});await panel.waitFor();
  const value=term=>panel.locator('dt').filter({hasText:new RegExp('^'+term+'$')}).locator('..').locator('dd');
  await value('Deployed').waitFor();assert.equal(requests,1);assert.equal(await value('Loaded version').innerText(),'v'+loaded.version);
  assert.equal(await value('Deployed').locator('time').getAttribute('datetime'),record.deployedAt);
  await page.clock.runFor(60000);assert.equal(requests,1,'statistics refresh must not poll deployment metadata');
  record={...record,version:'9.8.7',buildId:crypto.randomUUID(),dirty:false};
  await panel.getByRole('button',{name:'Refresh deployment info',exact:true}).click();
  await panel.getByRole('button',{name:'Reload app',exact:true}).waitFor();assert.equal(await value('Live version').innerText(),'v9.8.7');assert.equal(await value('Loaded version').innerText(),'v'+loaded.version);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1100});assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
  await page.screenshot({path:'.tmp/version-admin-mobile.png',fullPage:true});
  mode='html';await panel.getByRole('button',{name:'Refresh deployment info',exact:true}).click();await panel.getByText('Deployment details are unavailable.',{exact:false}).waitFor();assert.equal(await panel.locator('dt').filter({hasText:/^Deployed$/}).count(),0,'build time must never be presented as deployment time');
  mode='invalid';await panel.getByRole('button',{name:'Refresh deployment info',exact:true}).click();await panel.getByText('Deployment details are unavailable.',{exact:false}).waitFor();
  const before=requests;await page.goto(url+'?role=user');await page.getByText('Administrator access is required to view this page.',{exact:true}).waitFor();assert.equal(await page.locator('.admin-release').count(),0);assert.equal(requests,before,'regular users do not fetch admin release metadata');
  await page.goto(server.resolvedUrls.local[0]+'.tmp/version-fixture.html');await page.getByText('Development preview',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Refresh deployment info',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS version UI: admin-only visibility, actual deployment/build distinction, stale-tab warning, explicit refresh/no idle polling, missing/malformed manifest, local preview and desktop/mobile layout.');
}finally{await page?.unrouteAll({behavior:'wait'});await browser?.close();await server.close();for(const file of ['version-fixture.html','version-fixture.tsx'])await rm('.tmp/'+file,{force:true});}
