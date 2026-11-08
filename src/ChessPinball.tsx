import { useEffect, useRef, useState } from "react";
import { createPinball, launchBall, stepPinball, TARGETS, type PinballState } from "./pinballPhysics";
import { drawPinball } from "./pinballCanvas";
import { usePinballScores } from "./usePinballScores";
import "./chessPinball.css";

export default function ChessPinball({accountId,onClose,onScore}:{accountId:string;onClose:()=>void;onScore:()=>void}){
  const scores=usePinballScores(accountId);
  const state=useRef<PinballState>(createPinball()),canvas=useRef<HTMLCanvasElement>(null);
  const keys=useRef({left:false,right:false});const pausedRef=useRef(false),[paused,setPaused]=useState(false);
  const [snapshot,setSnapshot]=useState(()=>({...state.current}));
  const record=useRef(scores.record);record.current=scores.record;const sound=useRef(onScore);sound.current=onScore;
  const checkpoint=useRef(scores.checkpoint);checkpoint.current=scores.checkpoint;
  const lastSaved=useRef(-1);
  function pause(value:boolean){pausedRef.current=value;setPaused(value);keys.current={left:false,right:false};}
  function launch(){if(!pausedRef.current){launchBall(state.current);setSnapshot({...state.current});canvas.current?.focus({preventScroll:true});}}
  function restart(){if(state.current.phase!=="over")return;state.current=createPinball();lastSaved.current=-1;pause(false);setSnapshot({...state.current});}
  useEffect(()=>{
    let frame=0,previous=0,accumulator=0,lastUi=0,lastSound=0;
    function tick(now:number){
      if(!previous)previous=now;const elapsed=Math.min((now-previous)/1000,.05);previous=now;
      if(!pausedRef.current){accumulator+=elapsed;const oldScore=state.current.score;
        while(accumulator>=1/120){stepPinball(state.current,1/120,keys.current.left,keys.current.right);accumulator-=1/120;}
        if(state.current.score>oldScore){checkpoint.current(state.current.score);if(now-lastSound>120){sound.current();lastSound=now;}}
      }else accumulator=0;
      const ctx=canvas.current?.getContext("2d");if(ctx)drawPinball(ctx,state.current);
      if(now-lastUi>90){setSnapshot({...state.current,captured:[...state.current.captured],balls:[...state.current.balls]});lastUi=now;}
      // Checkpoint each drained ball, including the final score, so leaving loses no completed ball.
      if(state.current.phase!=="playing"&&state.current.score!==lastSaved.current&&state.current.score>0){lastSaved.current=state.current.score;record.current(state.current.score);}
      frame=requestAnimationFrame(tick);
    }
    const key=(event:KeyboardEvent,down:boolean)=>{
      if(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select"))return;
      if(event.code==="ShiftLeft"||event.code==="ShiftRight"){event.preventDefault();keys.current[event.code==="ShiftLeft"?"left":"right"]=down&&!pausedRef.current;}
      if(down&&!event.repeat&&event.code==="Space"&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();launch();}
      if(down&&!event.repeat&&event.code==="KeyP"){event.preventDefault();pause(!pausedRef.current);}
    };
    const down=(e:KeyboardEvent)=>key(e,true),up=(e:KeyboardEvent)=>key(e,false);
    const blur=()=>{if(state.current.phase==="playing")pause(true);else keys.current={left:false,right:false};};
    const visibility=()=>{if(document.hidden)blur();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",blur);document.addEventListener("visibilitychange",visibility);
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  function leave(){if(state.current.score>0)scores.record(state.current.score);onClose();}
  return <section className="chess-pinball">
    <header className="pinball-heading"><div><small>CHESS ARCADE / THE ROYAL TABLE</small><h1>Chess <em>Pinball</em></h1></div><button onClick={leave}>Back to arcade</button></header>
    <div className="pinball-layout">
      <aside className="pinball-panel pinball-controls"><p className="section-kicker">SCORE</p><output className="pinball-score" aria-label="Pinball score">{snapshot.score.toLocaleString()}</output><p>Personal best <strong>{scores.best.toLocaleString()}</strong></p><div className="pinball-stats"><span>Ball <b>{snapshot.round} / 3</b></span><span>Captures <b>{snapshot.captures}</b></span><span>Mates <b>{snapshot.mates}</b></span></div>
        <div className="pinball-actions">{snapshot.phase==="over"?<button onClick={restart}>New game</button>:<button disabled={snapshot.phase!=="ready"||paused} onClick={launch}>Launch ball · Space</button>}<button onClick={()=>pause(!paused)}>{paused?"Resume":"Pause · P"}</button></div>
        <h2>The royal mission</h2><ol className="pinball-missions"><li>Hit the five piece bumpers to capture them.</li><li>Capture all five to light <strong>CHECK</strong>.</li><li>Hit the king: <strong>CHECKMATE</strong>, 5,000 points and three-ball <strong>MULTIBALL</strong>.</li></ol>
        <div className="pinball-captures" aria-label="Captured targets">{TARGETS.slice(1).map((target,i)=><span key={target.name} className={snapshot.captured.includes(i+1)?"captured":""} title={`${target.name}: ${target.points} points`} aria-label={`${target.name}${snapshot.captured.includes(i+1)?" captured":" remaining"}`}>{target.glyph}</span>)}</div><small>Left Shift / Right Shift: flippers.<br/>Space: launch · P: pause.<br/>Three balls per game. Multiball continues until every ball drains.</small>
      </aside>
      <div className="pinball-center"><div className="pinball-mobile-hud"><strong>{snapshot.score.toLocaleString()} points</strong><span>Ball {snapshot.round} / 3</span>{snapshot.phase==="over"?<button onClick={restart}>New game</button>:<button disabled={snapshot.phase!=="ready"||paused} onClick={launch}>Launch</button>}</div><div className="pinball-table"><canvas ref={canvas} width={480} height={720} tabIndex={0} aria-label="Chess pinball table. Left and right Shift control flippers. Space launches a ball. P pauses." data-phase={snapshot.phase} data-balls={snapshot.balls.length} data-left={snapshot.left>.5} data-right={snapshot.right>.5}/>{paused&&<div className="pinball-paused"><h2>PAUSED</h2><button onClick={()=>pause(false)}>Resume pinball</button></div>}</div><p className="pinball-message" role="status">{snapshot.message}</p>
        <div className="pinball-touch">{(["left","right"] as const).map(side=><button key={side} aria-label={`${side} flipper`} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);keys.current[side]=!pausedRef.current;}} onPointerUp={()=>{keys.current[side]=false;}} onPointerCancel={()=>{keys.current[side]=false;}} onLostPointerCapture={()=>{keys.current[side]=false;}} onKeyDown={event=>{if(event.code==="Enter"||event.code==="Space"){event.preventDefault();keys.current[side]=!pausedRef.current;}}} onKeyUp={()=>{keys.current[side]=false;}}>{side==="left"?"◀ Left flipper":"Right flipper ▶"}</button>)}</div>
      </div>
      <aside className="pinball-panel pinball-leaderboard"><p className="section-kicker">HIGH SCORES</p><h2>The grandmasters</h2>{scores.personal&&<p>Your rank: <strong>#{scores.personal.rank}</strong> · {scores.personal.score.toLocaleString()}</p>}<ol>{scores.entries.map(entry=><li key={entry.rank}><span>{entry.rank}. {entry.name}</span><strong>{entry.score.toLocaleString()}</strong></li>)}</ol>{!scores.entries.length&&<p>No scores loaded yet. Set the first high score!</p>}<button onClick={()=>void scores.refresh()}>Refresh leaderboard</button>
        {accountId!=="guest"?<><label>Leaderboard name<input maxLength={24} value={scores.name} onChange={event=>scores.changeName(event.target.value)}/></label><button disabled={scores.busy||!scores.name.trim()} onClick={()=>void scores.upload()}>{scores.busy?"Saving…":"Save name & score"}</button><small>Your chosen name and best score are public.</small></>:<p>Guest high scores save on this device. Sign in from the arcade to compare your score on the shared leaderboard.</p>}
        <p className="pinball-save" role="status">{scores.status}</p>
      </aside>
    </div>
  </section>;
}
