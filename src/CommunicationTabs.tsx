import { useId, useState, useLayoutEffect, useRef, type ReactNode } from "react";

export function CommunicationTabs({ chat, emojis }: { chat: ReactNode; emojis: ReactNode }) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(tab===0)root.current?.querySelectorAll<HTMLElement>('[role="log"]').forEach(log=>{log.scrollTop=log.scrollHeight;});},[tab]);
  return <div className="communication-tabs" ref={root}>
    <div role="tablist" aria-label="Game communication" className="communication-tab-list">
      {["Chat", "Emojis"].map((label, index) => <button key={label} type="button" role="tab"
        id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === index}
        tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)}
        onKeyDown={event => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : ["ArrowLeft", "ArrowRight"].includes(event.key) ? 1 - index : null;
          if (next === null) return;
          event.preventDefault(); setTab(next); document.getElementById(`${id}-tab-${next}`)?.focus();
        }}>{label}</button>)}
    </div>
    {[chat, emojis].map((content, index) => <div key={index} role="tabpanel" id={`${id}-panel-${index}`}
      aria-labelledby={`${id}-tab-${index}`} hidden={tab !== index} tabIndex={0}>{content}</div>)}
  </div>;
}
