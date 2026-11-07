import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJukebox } from './src/jukeboxMusic.ts';
import { JUKEBOX_TRACKS } from './src/jukeboxTracks.ts';

const metadata=JSON.parse(readFileSync('public/music/jukebox/manifest.json','utf8'));
assert.equal(metadata.length,6);
for (const track of JUKEBOX_TRACKS) {
 const file=metadata.find(item=>item.id===track.id);
 assert.equal(file.title,track.title); assert.equal(file.scene,track.scene);
 assert(file.duration>75 && file.duration<120);
 assert(file.peak<.95 && file.rms>.08);
 assert(readFileSync(`public${file.src}`).length>1000000);
}
let audio,hidden=false,creates=0,plays=0,paused=true,ended=false,src='',volume=0;
const events=new Map();
const player=createJukebox(()=>{
 creates++;
 audio={get paused(){return paused;},get ended(){return ended;},get src(){return src;},set src(value){src=value;},get volume(){return volume;},set volume(value){volume=value;},
  loop:true,preload:'',addEventListener:(name,cb)=>events.set(name,cb),pause(){paused=true;},load(){ended=false;},play(){plays++;paused=false;return Promise.resolve();}};
 return audio;
},()=>hidden,()=>0);
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));};
assert.equal(creates,0);player.setVolume(.5);assert.equal(creates,0);
player.start('home');await settle();assert.equal(audio.loop,false);assert.equal(volume,.15);
const first=src;const title=player.getTitle();
player.start('home');await settle();assert.equal(src,first);assert.equal(plays,1,'clicking the page must not restart music');
ended=true;paused=true;events.get('ended')();await settle();assert.notEqual(src,first);assert.notEqual(player.getTitle(),title);assert.equal(creates,1);
ended=true;paused=true;events.get('ended')();await settle();assert.equal(src,first,'playlist cycles without immediate repeats');
player.next();await settle();assert.notEqual(src,first);
player.start('roster');await settle();assert(src.includes('grease-stained-45'));assert.equal(creates,1);
player.start('battle');await settle();assert(src.includes('quarter-slot-shuffle'));
player.setVolume(0);assert.equal(volume,0);player.setVolume(3);assert.equal(volume,.3);
player.stop();const mutedPlays=plays;ended=true;events.get('ended')();await settle();assert.equal(plays,mutedPlays);assert.equal(player.isPlaying(),false);
hidden=true;player.start('home');await settle();assert.equal(plays,mutedPlays);
hidden=false;player.start('home');await settle();assert.equal(player.isPlaying(),true);
player.stop();
let blocked=true,attempts=0;
const retry=createJukebox(()=>({...audio,paused:true,ended:false,play(){attempts++;return blocked?Promise.reject(new Error('Autoplay blocked')):Promise.resolve();},pause(){},load(){},addEventListener(){}}),()=>false,()=>0);
retry.start('home');await settle();blocked=false;retry.start('home');await settle();assert.equal(attempts,2);retry.stop();
console.log('PASS six original assets, scene playlists, automatic advance, no repeated restarts, skip, mute, hidden-page handling, independent volume and autoplay retry.');
