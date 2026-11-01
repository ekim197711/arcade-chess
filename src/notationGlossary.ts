export const PIECE_NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
export const NOTATION_PATTERN = /(?<![A-Za-z0-9])(?:O-O(?:-O)?[+#]?|[KQRBN](?:[a-h][1-8]?|[1-8])?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]*|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?[!?]*|[KQRBN](?:\.{3})?|\d+\.{1,3})(?![A-Za-z0-9])/g;
export function explainNotation(token: string): string {
 const turn = token.match(/^(\d+)(\.{1,3})$/);
 if (turn) return `Move number ${turn[1]}. ${turn[2].length === 3 ? 'Three dots mean Black is moving.' : 'One dot means White is moving.'}`;
 if (/^[KQRBN](\.{3})?$/.test(token)) return `${token[0]} stands for the ${PIECE_NAMES[token[0]]}.${token.endsWith('...') ? ' The dots here stand for the rest of a move, such as Nf3: knight to f3.' : ''} Pawns have no piece letter. N is used for knight because K means king.`;
 const suffix = `${token.includes('+') ? ' + means check: the opposing king is attacked.' : ''}${token.includes('#') ? ' # means checkmate: the king is in check with no legal escape.' : ''}${token.includes('!') ? ' ! marks a move the annotator considers good.' : ''}${token.includes('?') ? ' ? marks a move the annotator considers questionable.' : ''}`;
 if (token.startsWith('O-O')) return `${token.startsWith('O-O-O') ? 'Queenside (long)' : 'Kingside (short)'} castling: the king and rook move together in one turn.${suffix}`;
 const square = token.match(/([a-h][1-8])(?:=[QRBN])?[+#]?[!?]*$/)?.[1];
 if (!square) return 'Chess uses algebraic notation to describe moves.';
 const coordinate = `${square} is the square on file ${square[0]} (a vertical column) and rank ${square[1]} (a horizontal row). Files run a to h from White\'s left; ranks run 1 to 8 from White\'s side. These names stay the same when the board is flipped.`;
 if (/^[a-h][1-8]$/.test(token)) return `${coordinate} As a move, ${token} means a pawn moves to that square.`;
 const piece = PIECE_NAMES[token[0]];
 const origin = piece ? token.slice(1, token.lastIndexOf(square)).replace('x', '') : token.includes('x') ? token[0] : '';
 const originText = origin ? ` The ${origin.length === 2 ? `starting square is ${origin}` : /^[a-h]$/.test(origin) ? `piece starts on file ${origin}` : `piece starts on rank ${origin}`}; this identifies which piece moves.` : '';
 const promotion = token.match(/=([QRBN])/);
 return `${piece ? `${token[0]} means ${piece}.` : 'No piece letter means a pawn.'} ${token.includes('x') ? 'x means capture: ' : ''}Move the ${piece ?? 'pawn'} to ${square}${token.includes('x') ? ', capturing the opposing piece there (or the adjacent pawn for en passant)' : ''}.${originText}${promotion ? ` =${promotion[1]} means promote the pawn to a ${PIECE_NAMES[promotion[1]]}.` : ''}${suffix} ${coordinate}`;
}
