import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
export const pinballScoreKey = (owner: string) => `arcade-pinball-v1:${owner}`;
export function safePinballScore(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value >= 0 ? Math.min(2_000_000_000, value) : 0; }
function read(owner: string) { try { return safePinballScore(JSON.parse(localStorage.getItem(pinballScoreKey(owner)) ?? "0")); } catch { return 0; } }
type Entry = { rank: number; score: number; name: string };
export function usePinballScores(owner: string) {
  const [best,setBest]=useState(()=>read(owner));const bestRef=useRef(best);
  const [name,setName]=useState(()=>{try{return localStorage.getItem(`${pinballScoreKey(owner)}:name`) || "Arcade pilot";}catch{return "Arcade pilot";}});
  const [entries,setEntries]=useState<Entry[]>([]),[personal,setPersonal]=useState<Entry|null>(null);
  const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);const alive=useRef(true),running=useRef(false),pending=useRef(false),nameRef=useRef(name);nameRef.current=name;
  function store(score:number){const next=Math.max(bestRef.current,read(owner),safePinballScore(score));bestRef.current=next;setBest(next);try{localStorage.setItem(pinballScoreKey(owner),JSON.stringify(next));return true;}catch{setStatus("Score kept for this session; device storage is unavailable.");return false;}}
  async function refresh(){
    if(!supabase){setStatus("Leaderboard unavailable. Your best score saves on this device.");return;}
    try{const {data,error}=await supabase.rpc("pinball_leaderboard");if(!alive.current)return;if(error)throw error;
      setEntries(data?.entries??[]);setPersonal(data?.personal??null);if(data?.personal)store(safePinballScore(data.personal.score));
    }catch{if(alive.current)setStatus("Leaderboard unavailable. Try Refresh leaderboard.");}
  }
  async function upload(){
    if(owner==="guest"||!supabase)return;
    if(running.current){pending.current=true;return;}running.current=true;setBusy(true);
    try{do{pending.current=false;const {data,error}=await supabase.rpc("save_pinball_score",{p_score:bestRef.current,p_name:nameRef.current.trim().slice(0,24)||"Arcade pilot"});
      if(!alive.current)return;if(error)throw error;const stored=store(safePinballScore(data));setStatus(stored?"Best score saved locally and to the leaderboard.":"Best score saved to the leaderboard; device storage unavailable.");
    }while(pending.current);await refresh();}catch{if(alive.current)setStatus("Cloud score pending. Retry with Save name & score; your local best is kept.");}
    finally{running.current=false;if(alive.current)setBusy(false);}
  }
  useEffect(()=>{alive.current=true;
    if(owner!=="guest"){const guest=read("guest");if(guest>0&&store(guest)){try{localStorage.removeItem(pinballScoreKey("guest"));}catch{/* Claimed score is safe. */}}}
    if(owner!=="guest"&&bestRef.current>0)void upload();else void refresh();return()=>{alive.current=false;};
  },[owner]);
  function record(score:number){const stored=store(score);if(stored)setStatus(owner==="guest"?"Personal best saved on this device. Sign in to join the leaderboard.":"Personal best saved on this device.");void upload();}
  function changeName(value:string){setName(value);try{localStorage.setItem(`${pinballScoreKey(owner)}:name`,value);}catch{/* Name remains usable this session. */}}
  return{best,name,changeName,entries,personal,status,busy,record,checkpoint:store,upload,refresh};
}
