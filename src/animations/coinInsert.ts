/* Dependency-free, responsive cartoon animation. Animation runs independently of audio availability. */
const variants = {
  bounce: { duration: .95, impact: .32, body: '#8656ef', accent: '#55e8df', title: 'BOUNCE & BANK', symbol: '♙' },
  flip: { duration: 1, impact: .36, body: '#f06eaa', accent: '#ffd477', title: 'KNIGHT FLIP', symbol: '♞' },
  rocket: { duration: .85, impact: .25, body: '#41bcb9', accent: '#ff8bba', title: 'TURBO SLIDE', symbol: '♜' },
};
const base = "/animations/coin-insert/";
export type CoinVariant = keyof typeof variants;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, t: number) => a+(b-a)*t;
export class CoinInsert extends HTMLElement {
  audio: HTMLAudioElement;
  frame = 0;
  run = 0;
  private _cancel: (() => void) | null = null;
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.audio = new Audio();
    this.audio.preload = 'auto';
  }
  connectedCallback() { this.render(); }
  disconnectedCallback() { this.stop(); }
  get variant(): CoinVariant {
    const value = this.getAttribute('variant') as CoinVariant;
    return Object.hasOwn(variants, value) ? value : 'bounce';
  }
  render() {
    const v = variants[this.variant];
    this.audio.src = `${base}${this.variant}.wav?v=comic-3`;
    this.shadowRoot!.innerHTML = `
      <style>:host{display:block}svg{width:100%;height:auto;display:block}text{font-family:Georgia,serif;font-weight:900}.ink{stroke:#211731;stroke-width:5;stroke-linejoin:round}</style>
      <svg viewBox="0 0 520 440" role="img" aria-label="Close-up of a shiny chess coin and arcade coin slot">
      <defs>
        <linearGradient id="panel" x2="1" y2="1"><stop stop-color="${v.body}"/><stop offset="1" stop-color="#241c3c"/></linearGradient>
        <linearGradient id="chrome" x2="1" y2=".7"><stop stop-color="#f7f4ff"/><stop offset=".22" stop-color="#aca4c4"/><stop offset=".48" stop-color="#fdfaff"/><stop offset=".55" stop-color="#807894"/><stop offset="1" stop-color="#c6c0d7"/></linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3b3"/><stop offset=".27" stop-color="#ffd35b"/><stop offset=".48" stop-color="#fff7c5"/><stop offset=".57" stop-color="#e9a62e"/><stop offset="1" stop-color="#ffcf59"/></linearGradient>
        <linearGradient id="rim" x2="0" y2="1"><stop stop-color="#fff5bb"/><stop offset=".4" stop-color="#e6a32b"/><stop offset="1" stop-color="#9e541a"/></linearGradient>
        <clipPath id="entrance"><rect x="0" y="0" width="390" height="440"/></clipPath>
        <clipPath id="face"><circle r="66"/></clipPath>
      </defs>
      <path d="M293 -8 H530 V448 H293 Q271 220 293 -8" fill="url(#panel)" stroke="#211731" stroke-width="6"/>
      <path d="M302 0 Q281 220 302 440" fill="none" stroke="${v.accent}" stroke-width="5" opacity=".4"/>
      <rect x="314" y="67" width="158" height="312" rx="35" fill="#151023" opacity=".4"/>
      <rect x="307" y="57" width="158" height="312" rx="32" fill="url(#chrome)" class="ink"/>
      <rect x="321" y="71" width="130" height="284" rx="23" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
      ${[92,334].map(y=>`<circle cx="386" cy="${y}" r="8" fill="#706981" stroke="#ede9f5" stroke-width="2"/><path d="M382 ${y+3} L390 ${y-3}" stroke="#322b44" stroke-width="3"/>`).join('')}
      <rect id="lamp" x="365" y="112" width="44" height="7" rx="3.5" fill="${v.accent}"/>
      <rect x="364" y="132" width="46" height="177" rx="20" fill="#6b607d" stroke="#fff9ff" stroke-width="3"/>
      <rect x="375" y="139" width="25" height="163" rx="11" fill="#100c1c" stroke="#30263e" stroke-width="4"/>
      <path d="M402 152 V288" stroke="#e3ddef" stroke-width="3" stroke-linecap="round"/>
      <ellipse id="coinShadow" cx="150" cy="354" rx="73" ry="14" fill="#100c22" opacity=".28"/>
      <g clip-path="url(#entrance)">
        <g id="trail" stroke="${v.accent}" stroke-width="6" stroke-linecap="round" opacity="0"><path d="M-130 -24 H-95 M-147 0 H-100 M-130 24 H-95"/></g>
        <g id="coin">
          <circle cx="7" cy="3" r="80" fill="url(#rim)" stroke="#6e3b23" stroke-width="5"/>
          ${Array.from({length:19},(_,i)=>{const y=-68+i*7.5;const x=Math.sqrt(Math.max(0,80*80-y*y));return `<path d="M${x-2} ${y} l9 3" stroke="#8d511c" stroke-width="2"/>`;}).join('')}
          <circle r="78" fill="url(#gold)" stroke="#784620" stroke-width="4"/>
          <circle r="68" fill="none" stroke="#fff1ac" stroke-width="5"/>
          <circle r="61" fill="none" stroke="#ba7a26" stroke-width="2"/>
          <text x="1" y="34" text-anchor="middle" font-size="100" fill="#a56720" stroke="#fff1ac" stroke-width="1.5">${v.symbol}</text>
          <g clip-path="url(#face)"><path id="shine" d="M-115 -85 L-85 -85 L-5 85 L-35 85 Z" fill="#fff" opacity=".55"/></g>
          <path d="M-58 -35 A67 67 0 0 1 -23 -62" fill="none" stroke="#fffbe0" stroke-width="6" stroke-linecap="round"/>
          <path id="sparkle" d="M-51 -77 L-47 -63 L-33 -59 L-47 -55 L-51 -41 L-55 -55 L-69 -59 L-55 -63 Z" fill="#fffbe6"/>
        </g>
      </g>
      <g id="burst" stroke="${v.accent}" stroke-width="4" stroke-linecap="round" opacity="0"><path d="M355 149 l-10 -13 M418 149 l10 -13 M350 220 h-15 M422 220 h15 M355 291 l-10 13 M418 291 l10 13"/></g>
      <g id="bubble" opacity="0">
        <path d="M59 30 Q43 30 43 49 V105 Q43 123 63 123 H183 L219 150 L212 123 H250 Q267 123 267 104 V49 Q267 30 247 30 Z" fill="#fff5c9" stroke="#211731" stroke-width="6"/>
        <text id="bubbleText" x="155" y="91" text-anchor="middle" fill="#65254f" style="font:900 italic 34px system-ui,sans-serif;letter-spacing:-1px">CLIIINK!</text>
      </g>
      </svg>`;
    this.draw(0);
  }
  stop() {
    this._cancel?.();
    this._cancel = null;
    this.run++;
    cancelAnimationFrame(this.frame);
    this.audio.pause();
    this.audio.currentTime = 0;
  }
  /** Every click restarts immediately; interrupted runs resolve false. */
  play({ volume = .55, muted = false } = {}) {
    this.stop();
    const run = this.run, started = performance.now();
    this.audio.volume = clamp(volume);
    this.audio.muted = muted;
    this.draw(0);
    // Never let missing audio, browser audio policy, or loading stall the motion.
    this.audio.play().catch(error => {
      if(run===this.run && error.name!=='AbortError')
        this.dispatchEvent(new CustomEvent('coin-insert-audio-error', {detail:error}));
    });
    return new Promise<boolean>(resolve => {
      this._cancel = () => resolve(false);
      const tick = (now: number) => {
        if(run!==this.run) { resolve(false); return; }
        const elapsed=(now-started)/1000;
        this.draw(elapsed);
        if(elapsed>=variants[this.variant].duration) {
          this._cancel=null;
          this.dispatchEvent(new CustomEvent('coin-insert-complete', {bubbles:true, composed:true, detail:{variant:this.variant}}));
          resolve(true);
        } else this.frame=requestAnimationFrame(tick);
      };
      this.frame=requestAnimationFrame(tick);
    });
  }
  draw(time: number) {
    const v = variants[this.variant], p = clamp(time/v.impact), after = time-v.impact;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (id: string) => this.shadowRoot!.querySelector<SVGElement>(`#${id}`)!;
    // The large coin turns edge-on before slipping behind the slot's right lip.
    const approach=clamp(p/.73), enter=clamp((p-.73)/.27);
    const ease=approach*approach*(3-2*approach);
    let x=mix(145,383,ease)+enter*23, y=220, rotation=0;
    let sx=mix(1,.13,ease), sy=1;
    if(this.variant==='bounce') {
      y-=Math.sin(approach*Math.PI)*40;
      rotation=-12*Math.sin(approach*Math.PI);
    } else if(this.variant==='flip') {
      sx=(.15+.85*Math.abs(Math.cos(approach*Math.PI*2)))*(1-ease*.87);
      y-=Math.sin(approach*Math.PI)*22;
    } else {
      x=mix(145,383,approach*approach)+enter*23;
      rotation=8*Math.sin(approach*Math.PI);
    }
    if(reduced) { y=220; rotation=0; }
    $('coin').setAttribute('transform',`translate(${x} ${y}) rotate(${rotation}) scale(${sx} ${sy})`);
    $('coin').style.opacity=after>=0?'0':'1';
    $('coinShadow').setAttribute('cx',String(x));
    $('coinShadow').setAttribute('rx',String(73*sx));
    $('coinShadow').style.opacity=after>=0?'0':String(.28*(1-enter));
    $('shine').setAttribute('transform',`translate(${p*190} 0)`);
    $('sparkle').style.opacity=String(.5+.5*Math.cos(p*Math.PI*5));
    $('trail').setAttribute('transform',`translate(${x} ${y})`);
    $('trail').style.opacity=this.variant==='rocket'&&p>0&&p<.73?String(Math.sin(approach*Math.PI)):'0';
    $('burst').style.opacity=after>=0?String(1-clamp(after/.3)):'0';
    $('lamp').setAttribute('fill',after>=0&&after<.4?'#fff5bc':v.accent);
    const words=['CLIIINK!','BLING!','BLING!','DING!','DING!'];
    const beat=Math.floor((after+.015)/.105);
    const visible=beat>=0 && beat<words.length && time<v.duration;
    $('bubble').style.opacity=visible?'1':'0';
    $('bubbleText').textContent=words[Math.max(0,Math.min(4,beat))];
    const phase=((after+.015)/.105)-beat;
    const pop=reduced?1:.88+.16*Math.sin(clamp(phase)*Math.PI);
    $('bubble').setAttribute('transform',`translate(155 83) scale(${pop}) rotate(${reduced?0:beat%2?3:-3}) translate(-155 -83)`);
    if(reduced) { $('burst').style.opacity='0'; $('trail').style.opacity='0'; }
    this.shadowRoot!.querySelector('svg')!.setAttribute('aria-label',after>=0?'Shiny chess coin inserted into the slot.':'Close-up of a shiny chess coin approaching the coin slot');
  }
}
if (!customElements.get('coin-insert')) customElements.define('coin-insert', CoinInsert);
