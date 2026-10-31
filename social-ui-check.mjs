import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const uid = '11111111-1111-4111-8111-111111111111', peer = '22222222-2222-4222-8222-222222222222';
await mkdir('.tmp', { recursive: true });
await writeFile('.tmp/social-fixture.html', '<div id="root"></div><script type="module" src="/./.tmp/social-fixture.tsx"></script>');
await writeFile('.tmp/social-fixture.tsx', `import React from 'react'; import { createRoot } from 'react-dom/client';
import { OnlineSocial, EmojiReactionSettings } from '../src/OnlineSocial';
const params = new URLSearchParams(location.search);
const initialGame = params.has('lobby') ? undefined : { id:'33333333-3333-4333-8333-333333333333', white_id:'${uid}', black_id:params.has('bot') ? null : '${peer}', white_name:'Alice', black_name:'Bob', is_bot:params.has('bot'), pgn:'', ply_count:0, result:null };
function Fixture() { const [game,setGame] = React.useState(initialGame); (window as any).updateBotGame = (patch:any) => setGame(current => ({...current!,...patch})); return params.has('settings') ? <EmojiReactionSettings userId={params.has('guest') ? undefined : '${uid}'} /> : <OnlineSocial userId="${uid}" game={game as any} />; }
createRoot(document.getElementById('root')!).render(<Fixture />);`);
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://social-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host:'127.0.0.1', port:0, open:false } });
let browser;
try {
  await server.listen();
  const { EMOJI_REACTIONS } = await server.ssrLoadModule('/src/emojiReactions.ts');
  browser = await chromium.launch({ channel:'msedge', headless:true });
  const page = await browser.newPage();
  let friend = null, messages = [], reactions = [], enabled = true, failure = false, requests = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://social-check.supabase.co/**', async route => {
    requests++;
    assert.match(route.request().url(), /\/rpc\/online_social$/);
    const { p_action: action, p_body: body, p_enabled: preference } = route.request().postDataJSON();
    if (failure) { failure = false; return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Test connection failure'})}); }
    if (action === 'request') friend = { user_id:peer, name:'Bob', requested_by:uid, accepted:false };
    if (action === 'accept') friend.accepted = true;
    if (action === 'remove') { friend = null; messages = []; }
    if (action === 'preferences') { enabled = preference; reactions = []; }
    if (action === 'chat') messages.push({id:messages.length+1,sender_id:uid,body,created_at:new Date().toISOString()});
    if (action === 'emoji') reactions = [{id:1,sender_id:uid,body,created_at:new Date().toISOString()}];
    return route.fulfill({contentType:'application/json',body:JSON.stringify({friends:friend ? [friend] : [],messages,reactions:enabled ? reactions : [],emojis_enabled:enabled,peer_emojis_enabled:true})});
  });
  const url = server.resolvedUrls.local[0]+'.tmp/social-fixture.html';
  await page.goto(url);
  await page.getByRole('button',{name:'Add friend',exact:true}).click();
  await page.getByText('Friend request sent.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Message',exact:true}).count(),1,'match chat is available before friendship');
  friend.requested_by = peer;
  await page.reload();
  await page.getByRole('button',{name:'Accept friend request'}).click();
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('<script>window.injected=true</script>');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('<script>window.injected=true</script>',{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => window.injected),undefined);
  await page.getByRole('tab',{name:'Emojis',exact:true}).click();
  await page.getByRole('button',{name:'Send thumbs up',exact:true}).click();
  await page.getByText('You: 👍',{exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).uncheck();
  await page.getByText('Emojis are hidden.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('group',{name:'Send an emoji reaction'}).count(),0);
  await page.reload();
  await page.getByRole('tab',{name:'Emojis',exact:true}).click();
  assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).isChecked(),false);
  for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    assert(await page.locator('.online-social').evaluate(el => el.scrollWidth <= el.clientWidth+1));
  }
  await page.screenshot({path:'.tmp/social-mobile.png',fullPage:true});
  await page.goto(url+'?lobby');
  await page.getByRole('button',{name:'Bob · Chat'}).click();
  await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).count(),0,'no emoji toggle before a game, including friend chat');
  await page.getByText('Manage friendship',{exact:true}).click();
  await page.getByRole('button',{name:'Remove friend & clear chat'}).click();
  await page.getByText('Meet players in human matches',{exact:false}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Message',exact:true}).count(),0);
  failure = true;
  await page.reload();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByText('Meet players in human matches',{exact:false}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).count(),0);
  await page.goto(url+'?settings');
  const settingsToggle = page.getByRole('checkbox',{name:'Emoji reactions enabled'});
  await settingsToggle.waitFor();
  assert.equal(await settingsToggle.isChecked(),false,'Settings reads the same saved preference as games');
  const initialSettingsRequests = requests;
  await page.waitForTimeout(3500);
  assert.equal(requests,initialSettingsRequests,'Settings does not poll social data');
  await settingsToggle.check();
  await page.waitForFunction(() => !document.querySelector('input[type=checkbox]').disabled);
  assert.equal(enabled,true);
  failure=true;
  await settingsToggle.uncheck();
  await page.getByRole('alert').waitFor();
  assert.equal(await settingsToggle.isChecked(),true,'failed Settings changes restore the saved preference');
  await settingsToggle.uncheck();
  await page.waitForFunction(() => !document.querySelector('input[type=checkbox]').disabled);
  assert.equal(enabled,false);
  await page.goto(url+'?settings&guest');
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).waitFor();
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).uncheck();
  await page.reload();
  assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).isChecked(),false,'guest preference persists on this device');
  await page.goto(url+'?bot');
  await page.getByRole('heading',{name:'Practice bot reactions'}).waitFor();
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('Hello');
  const beforeBotChat = requests;
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('Hello! Good luck and have fun.',{exact:true}).waitFor();
  assert.equal(requests,beforeBotChat,'preset bot chat makes no server calls');
  await page.getByRole('tab',{name:'Emojis',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Add friend',exact:true}).count(),0);
  assert.equal(await page.getByRole('group',{name:'Send an emoji reaction'}).count(),0,'saved mute hides bot-game reaction buttons');
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).check();
  await page.waitForFunction(() => document.querySelector('.online-social')?.textContent.includes('The practice bot reacts'));
  await page.evaluate(() => window.updateBotGame({pgn:'1. e4 d5 2. exd5',ply_count:3}));
  await page.getByLabel('Bot reaction',{exact:true}).getByText('You captured my pawn!',{exact:false}).waitFor();
  await page.evaluate(() => window.updateBotGame({pgn:'1. e4 d5 2. exd5 Qxd5',ply_count:4}));
  assert.match(await page.getByLabel('Bot reaction',{exact:true}).innerText(),/my pawn/,'rapid consecutive events respect cooldown');
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).uncheck();
  await page.getByText('Bot emojis are hidden.',{exact:false}).waitFor();
  assert.equal((await page.getByLabel('Bot reaction',{exact:true}).innerText()).trim(),'');
  await page.reload();
  await page.getByRole('tab',{name:'Emojis',exact:true}).click();
  await page.getByText('Bot emojis are hidden.',{exact:false}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).isChecked(),false);
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).check();
  await page.getByText('The practice bot reacts',{exact:false}).waitFor();
  await page.clock.install();
  const reactionButtons = page.getByRole('group',{name:'Send an emoji reaction'}).getByRole('button');
  assert.equal(await reactionButtons.count(),EMOJI_REACTIONS.length);
  assert(EMOJI_REACTIONS.length>=40);
  for (const label of ['thumbs up','surprised','angry','laughing','applause','good game']) {
    await page.getByRole('button',{name:`Send ${label}`,exact:true}).click();
    assert.match(await page.getByLabel('Your reaction',{exact:true}).innerText(),/^You:/);
    assert.equal(await reactionButtons.first().isDisabled(),true);
    await page.clock.fastForward(2100);
  }
  await page.getByRole('button',{name:'Send good game',exact:true}).click();
  await page.clock.fastForward(2100);
  await page.getByRole('button',{name:'Send good game',exact:true}).click();
  await page.clock.fastForward(6100);
  assert.equal((await page.getByLabel('Your reaction',{exact:true}).innerText()).trim(),'','same-emoji repeat refreshes and expires');
  assert.equal(await reactionButtons.first().isDisabled(),false);
  await page.getByRole('button',{name:'Send thumbs up',exact:true}).click();
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).uncheck();
  assert.equal(await page.getByRole('group',{name:'Send an emoji reaction'}).count(),0);
  assert.equal(await page.getByLabel('Your reaction',{exact:true}).count(),0);
  await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).check();
  assert.equal((await page.getByLabel('Your reaction',{exact:true}).innerText()).trim(),'','unmuting does not replay a sent emoji');
  await page.evaluate(() => window.updateBotGame({pgn:'1. e4 d5 2. exd5',ply_count:3}));
  await page.getByLabel('Bot reaction',{exact:true}).getByText('You captured my pawn!',{exact:false}).waitFor();
  await page.clock.fastForward(6500);
  assert.equal((await page.getByLabel('Bot reaction',{exact:true}).innerText()).trim(),'','bot reactions expire');
  await page.clock.fastForward(2000);
  await page.evaluate(() => window.updateBotGame({pgn:'1. e4 d5 2. exd5 Qxd5',ply_count:4}));
  await page.getByLabel('Bot reaction',{exact:true}).getByText('I captured your pawn.',{exact:false}).waitFor();
  await page.evaluate(() => window.updateBotGame({pgn:'1. f3 e5 2. g4 Qh4#',ply_count:4,result:'0-1'}));
  await page.getByLabel('Bot reaction',{exact:true}).getByText('Good game!',{exact:false}).waitFor();
  await page.clock.fastForward(6500);
  assert.equal((await page.getByLabel('Bot reaction',{exact:true}).innerText()).trim(),'');
  await page.evaluate(() => window.updateBotGame({version:100}));
  assert.equal((await page.getByLabel('Bot reaction',{exact:true}).innerText()).trim(),'','heartbeat updates do not replay result reactions');
  for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    assert(await page.locator('.online-social').evaluate(el => el.scrollWidth <= el.clientWidth+1));
  }
  await page.screenshot({path:'.tmp/bot-reaction-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Social UI passed: immediate match chat, requests/acceptance, escaped messages, 48 emojis, tabs, shared/guest settings, preset bot chat, cooldown/muting/results and desktop/mobile layouts.');
} finally {
  await browser?.close(); await server.close();
  await rm('.tmp/social-fixture.html',{force:true}); await rm('.tmp/social-fixture.tsx',{force:true});
}
