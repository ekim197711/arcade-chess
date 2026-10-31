import { useEffect, useRef, useState } from "react";

export function BotChat({ name }: { name: string }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ author: string; body: string }[]>([]);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages]);
  return <>
    <p className="review-note">{name} is a bot with short preset replies. This conversation stays on this device during this game.</p>
    <div className="social-chat-log" role="log" aria-label={`Chat with ${name}`} ref={log}>
      {!messages.length && <p>Say hello or wish your opponent good luck!</p>}
      {messages.map((message, index) => <p key={index} className={message.author === "You" ? "social-message-own" : undefined}><strong>{message.author}</strong><span>{message.body}</span></p>)}
    </div>
    <form className="social-chat-form" onSubmit={event => {
      event.preventDefault(); const body = draft.trim(); if (!body) return;
      const reply = /good game|\bgg\b/i.test(body) ? "Good game! Thanks for playing." : /hello|\bhi\b|hey/i.test(body) ? "Hello! Good luck and have fun." : /thanks|thank you/i.test(body) ? "You're welcome. Let's keep playing!" : /luck|\bgl\b/i.test(body) ? "Good luck to you too!" : /nice|well played/i.test(body) ? "Thanks! You're keeping me on my toes." : "I'm focused on the board. Let's see your next move!";
      setMessages(previous => [...previous, {author:"You",body}, {author:name,body:reply}].slice(-50));setDraft("");
    }}><label>Message<input maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} autoComplete="off" placeholder="Say hello…" /></label><button disabled={!draft.trim()}>Send</button></form>
  </>;
}
