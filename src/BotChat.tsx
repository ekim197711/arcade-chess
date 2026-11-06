import { ChatEmojiPicker, EmojiChatBody } from "./ChatEmoji";
import { useEffect, useRef, useState } from "react";

export type BotChatMessage = {id:string;author:string;body:string;kind:"chat"|"emoji"};
export type BotChatInput = Omit<BotChatMessage,"id">;

export function BotChat({ name, messages, onMessages, emojisEnabled }: { name:string;messages:BotChatMessage[];onMessages:(messages:BotChatInput[])=>void;emojisEnabled:boolean }) {
  const [draft, setDraft] = useState("");
  const visible=messages.filter(message=>message.kind!=="emoji"||emojisEnabled);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages,emojisEnabled]);
  return <>
    <p className="review-note">{name} is a bot with short preset replies. This conversation stays on this device during this game.</p>
    <div className="social-chat-log" role="log" aria-label={`Chat with ${name}`} ref={log}>
      {!visible.length && <p>Say hello or wish your opponent good luck!</p>}
      {visible.map(message => <p key={message.id} className={message.author === "You" ? "social-message-own" : undefined}><strong>{message.author}</strong><EmojiChatBody body={message.body}/></p>)}
    </div>
    <form className="social-chat-form" onSubmit={event => {
      event.preventDefault(); const body = draft.trim(); if (!body) return;
      const reply = /good game|\bgg\b/i.test(body) ? "Good game! Thanks for playing." : /hello|\bhi\b|hey/i.test(body) ? "Hello! Good luck and have fun." : /thanks|thank you/i.test(body) ? "You're welcome. Let's keep playing!" : /luck|\bgl\b/i.test(body) ? "Good luck to you too!" : /nice|well played/i.test(body) ? "Thanks! You're keeping me on my toes." : "I'm focused on the board. Let's see your next move!";
      onMessages([{author:"You",body,kind:"chat"},{author:name,body:reply,kind:"chat"}]);setDraft("");
    }}><label>Message<input maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} autoComplete="off" placeholder="Say hello…" /></label><button disabled={!draft.trim()}>Send</button>{emojisEnabled&&<ChatEmojiPicker draftLength={draft.length} onPick={emoji=>setDraft(value=>value+emoji)}/>}</form>
  </>;
}
