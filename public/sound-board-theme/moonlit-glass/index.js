// Keep this module beside its WAV files when copying the theme.
export const sounds = {
  'select': new URL('./select.wav', import.meta.url).href,
  'move': new URL('./move.wav', import.meta.url).href,
  'check': new URL('./check.wav', import.meta.url).href,
  'checkmate': new URL('./checkmate.wav', import.meta.url).href,
  'capture-opponent': new URL('./capture-opponent.wav', import.meta.url).href,
  'piece-lost': new URL('./piece-lost.wav', import.meta.url).href,
  'en-passant': new URL('./en-passant.wav', import.meta.url).href,
  'castle': new URL('./castle.wav', import.meta.url).href,
  'timeout': new URL('./timeout.wav', import.meta.url).href,
};
export default sounds;
