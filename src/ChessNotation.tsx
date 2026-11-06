import { Fragment, useId } from "react";
import { explainNotation, NOTATION_PATTERN } from "./notationGlossary";
import "./chessNotation.css";

export function NotationToken({token}: {token: string}) {
 const id = useId();
 return <><button type="button" className="chess-notation-token" popoverTarget={id} aria-label={`Explain ${token}`} title={`Explain ${token}`}>{token}</button><span id={id} popover="auto" role="dialog" aria-label={`Chess notation: ${token}`} className="chess-notation-help"><strong>{token}</strong><span>{explainNotation(token)}</span><button type="button" popoverTarget={id} popoverTargetAction="hide">Close explanation</button></span></>;
}
export function NotationText({text}: {text: string}) {
 const parts = []; let end = 0;
 for (const match of text.matchAll(new RegExp(NOTATION_PATTERN))) {
  parts.push(<Fragment key={`text-${match.index}`}>{text.slice(end,match.index)}</Fragment>);
  parts.push(<NotationToken key={`token-${match.index}`} token={match[0]}/>);
  end = match.index + match[0].length;
 }
 parts.push(<Fragment key="tail">{text.slice(end)}</Fragment>);
 return <>{parts}</>;
}
