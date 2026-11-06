(() => {
  const matchups = [
    ['pawn', 'rook'],
    ['knight', 'bishop'],
    ['queen', 'king'],
    ['rook', 'pawn'],
    ['bishop', 'knight'],
    ['king', 'queen'],
  ];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, playing = !motion.matches, timer;
  const panels = document.querySelector('#panels');
  const pause = document.querySelector('#pause');
  function actor(side, piece) {
    const img = document.createElement('img');
    img.className = 'actor' + (side === 'black' ? ' enemy' : '');
    img.src = `${side}-${piece}.webp`;
    img.alt = `${side === 'white' ? 'White' : 'Black'}-side ${piece} fighter`;
    img.width = 384; img.height = 384;
    img.draggable = false;
    return img;
  }
  function render() {
    const [white, black] = matchups[index];
    panels.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'panel clash';
    panel.append(actor('white', white), actor('black', black));
    panels.append(panel);
  }
  function sync() {
    clearInterval(timer);
    document.body.classList.toggle('playing', playing && !document.hidden);
    pause.textContent = playing ? 'Ⅱ' : '▶';
    pause.setAttribute('aria-label', playing ? 'Pause comic strip' : 'Play comic strip');
    if (playing && !document.hidden) timer = setInterval(() => { index = (index + 1) % matchups.length; render(); }, 10000);
  }
  pause.onclick = () => { playing = !playing; sync(); };
  document.querySelector('#previous').onclick = () => { index = (index + 5) % 6; render(); sync(); };
  document.querySelector('#next').onclick = () => { index = (index + 1) % 6; render(); sync(); };
  motion.addEventListener('change', () => { playing = !motion.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  render(); sync();
})();
