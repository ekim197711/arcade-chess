import { EMOJI_REACTIONS } from "./emojiReactions";

export function ChatEmojiPicker({onPick,disabled=false,draftLength=0}: {onPick:(emoji:string)=>void;disabled?:boolean;draftLength?:number}) {
 return <details className="chat-emoji-picker"><summary>Add emoji</summary><div className="social-emojis" role="group" aria-label="Add an emoji to message">{EMOJI_REACTIONS.map(([emoji,label])=><button key={emoji} type="button" title={label} aria-label={`Insert ${label.toLowerCase()}`} disabled={disabled||draftLength+emoji.length>500} onClick={()=>onPick(emoji)}>{emoji}</button>)}</div></details>;
}
export function EmojiChatBody({body}: {body:string}) {
 const reaction=EMOJI_REACTIONS.find(([emoji])=>body===emoji||body.startsWith(emoji+" "));
 if(!reaction)return <span>{body}</span>;
 return <span><span className="social-chat-emoji" role="img" aria-label={reaction[1]}>{reaction[0]}</span>{body.length>reaction[0].length&&<span className="social-chat-emoji-caption">{body.slice(reaction[0].length).trimStart()}</span>}</span>;
}
