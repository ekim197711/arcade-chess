import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});
let browser;
try {
  await server.listen(); browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage(); page.on('pageerror', e=>console.log(e.message)); page.on('console', m=>{if(m.type()==='error')console.log(m.text());});
  await page.route('**/src/supabase.ts',route=>route.fulfill({contentType:'application/javascript',body:`
    export const supabase={rpc:async(name,args)=>{
      const owner=window.owner; window.calls.push({owner,args});
      await new Promise(resolve=>setTimeout(resolve,150));
      if(window.offline)return {error:{message:'offline'},data:null};
      const old=window.cloud[owner]??{repaired:0,launched:false};
      const data={repaired:Math.max(old.repaired,args.p_repaired),launched:old.launched||args.p_launched};
      window.cloud[owner]=data; return {data,error:null};
    }};
  `}));
  await page.route('**/__starship_save',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import {useStarshipSave} from '/src/useStarshipSave.ts';
    window.owner='a'; window.calls=[]; window.cloud={a:{repaired:4,launched:false}};
    window.offline=true;
    localStorage.setItem('arcade-starship-v1:guest',JSON.stringify({repaired:2,launched:false}));
    function Harness(){const api=useStarshipSave(window.owner);window.api=api;return React.createElement('p',null,api.status);}
    const root=ReactDOM.createRoot(document.getElementById('root'));
    window.mount=owner=>{window.owner=owner;root.render(React.createElement(Harness,{key:owner}));};
    window.mount('a');
  </script>`}));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__starship_save`);
  await page.waitForFunction(()=>window.api?.status.includes('pending'));
  assert.equal(await page.evaluate(()=>window.api.save.repaired),2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-starship-v1:guest')),null);
  await page.evaluate(()=>{window.offline=false;void window.api.retry();});
  await page.waitForFunction(()=>window.api?.save.repaired===4);
  await page.evaluate(()=>{window.api.commit({repaired:5,launched:false});window.api.commit({repaired:6,launched:true});});
  await page.waitForFunction(()=>window.cloud.a.launched===true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcade-starship-v1:a')).launched),true);
  await page.evaluate(()=>window.mount('b'));
  await page.waitForFunction(()=>window.cloud.b?.repaired===0);
  assert.equal(await page.evaluate(()=>window.api.save.repaired),0);
  assert.equal(await page.evaluate(()=>window.cloud.a.repaired),6);
  await page.evaluate(()=>window.mount('a'));
  await page.waitForFunction(()=>window.api.save.launched);
  console.log('PASS: offline durability, guest claiming, cloud merge, in-flight save queue, launch sync and account switching.');
} finally {await browser?.close();await server.close();}
