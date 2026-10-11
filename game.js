(() => {
  const MAP = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '     #.##### ## #####.#     ',
    '     #.##          ##.#     ',
    '     #.## ###--### ##.#     ',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '     #.## ######## ##.#     ',
    '     #.##          ##.#     ',
    '     #.## ######## ##.#     ',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
  ];
  const COLS = 28, ROWS = 31, T = 16, TOP = 40, BOTTOM = 34;
  const CW = COLS * T, CH = ROWS * T + TOP + BOTTOM;
  const TUNNEL_ROW = 14;
  const STEP = 1 / 120;

  const NONE = { x: 0, y: 0 }, UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const opposite = (a, b) => a.x === -b.x && a.y === -b.y && (a.x || a.y);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const wrapEl = document.getElementById('wrap');
  let scale = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    scale = Math.min(wrapEl.clientWidth / CW, wrapEl.clientHeight / CH) || 1;
    canvas.style.width = Math.floor(CW * scale) + 'px';
    canvas.style.height = Math.floor(CH * scale) + 'px';
    canvas.width = Math.round(CW * scale * dpr);
    canvas.height = Math.round(CH * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Maze ----------
  let grid, dotsLeft;
  function resetDots() {
    grid = MAP.map(r => r.split(''));
    dotsLeft = 0;
    for (const row of grid) for (const c of row) if (c === '.' || c === 'o') dotsLeft++;
  }
  function cell(tx, ty) {
    if (ty === TUNNEL_ROW && (tx < 0 || tx >= COLS)) return ' ';
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return '#';
    return grid[ty][tx];
  }
  const blocked = (tx, ty) => { const c = cell(tx, ty); return c === '#' || c === '-'; };

  const wallPath = new Path2D();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] !== '#') continue;
      const wallAt = (nx, ny) => {
        if (ny === TUNNEL_ROW && (nx < 0 || nx >= COLS)) return false;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return true;
        return MAP[ny][nx] === '#';
      };
      const x0 = x * T, y0 = TOP + y * T;
      if (!wallAt(x, y - 1)) { wallPath.moveTo(x0, y0); wallPath.lineTo(x0 + T, y0); }
      if (!wallAt(x, y + 1)) { wallPath.moveTo(x0, y0 + T); wallPath.lineTo(x0 + T, y0 + T); }
      if (!wallAt(x - 1, y)) { wallPath.moveTo(x0, y0); wallPath.lineTo(x0, y0 + T); }
      if (!wallAt(x + 1, y)) { wallPath.moveTo(x0 + T, y0); wallPath.lineTo(x0 + T, y0 + T); }
    }
  }

  // ---------- Sound ----------
  let actx = null, soundOn = true;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(f1, f2, dur, type = 'square', vol = 0.04, delay = 0) {
    if (!soundOn || !actx) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  let waka = 0;
  const sfx = {
    dot() { waka ^= 1; tone(waka ? 220 : 440, waka ? 440 : 220, 0.08, 'triangle', 0.08); },
    power() { tone(120, 600, 0.25, 'sawtooth', 0.03); },
    ghost() { tone(200, 1200, 0.18, 'square', 0.04); },
    death() { tone(900, 80, 1.2, 'sawtooth', 0.04); },
    life() { [880, 1100, 1320].forEach((f, i) => tone(f, f, 0.1, 'square', 0.03, i * 0.1)); },
    start() {
      [494, 988, 740, 622, 988, 740, 622, 523, 1046, 784, 659, 1046, 784, 659]
        .forEach((f, i) => tone(f, f, 0.11, 'square', 0.03, i * 0.13));
    },
  };

  // ---------- Entities ----------
  const pac = { x: 13.5, y: 23, dir: LEFT, want: LEFT, mouth: 0 };
  const GHOSTS = [
    { name: 'blinky', color: '#ff0000', home: 13.5, corner: { x: 25, y: -3 }, dots: 0 },
    { name: 'pinky', color: '#ffb8ff', home: 13.5, corner: { x: 2, y: -3 }, dots: 0 },
    { name: 'inky', color: '#00ffff', home: 11.5, corner: { x: 27, y: 31 }, dots: 30 },
    { name: 'clyde', color: '#ffb852', home: 15.5, corner: { x: 0, y: 31 }, dots: 60 },
  ];
  const ghosts = GHOSTS.map(g => ({ ...g }));

  // ---------- Game state ----------
  let state = 'title', stateTime = 0, time = 0;
  let score = 0, high = 0, lives = 3, level = 1, extraGiven = false;
  let dotsEaten = 0, sinceDot = 0, sinceRelease = 0;
  let modeIndex = 0, modeTime = 0, frightTime = 0, combo = 0;
  let popup = null;
  const MODES = [7, 20, 7, 20, 5, 20, 5, Infinity]; // scatter, chase, scatter...
  try { high = parseInt(localStorage.getItem('pacman-high') || '0', 10) || 0; } catch (e) {}

  const pacSpeed = () => Math.min(9.5, 7.6 * (1 + 0.04 * (level - 1)));
  const ghostSpeed = () => Math.min(9.3, 7.1 * (1 + 0.05 * (level - 1)));
  const frightDuration = () => Math.max(1.5, 6.5 - (level - 1));

  function resetPositions() {
    Object.assign(pac, { x: 13.5, y: 23, dir: LEFT, want: LEFT, mouth: 0 });
    ghosts.forEach((g, i) => {
      g.fright = false;
      g.path = null;
      if (i === 0) { Object.assign(g, { x: 13.5, y: 11, dir: LEFT, state: 'active' }); }
      else { Object.assign(g, { x: g.home, y: 14, dir: i === 1 ? DOWN : UP, state: 'house' }); }
    });
    modeIndex = 0; modeTime = 0; frightTime = 0; sinceRelease = 0; sinceDot = 0;
  }

  function newGame() {
    score = 0; lives = 3; level = 1; extraGiven = false;
    startLevel();
    sfx.start();
  }
  function startLevel() {
    resetDots();
    dotsEaten = 0;
    resetPositions();
    setState('ready');
  }
  function setState(s) { state = s; stateTime = 0; }

  function addScore(n) {
    score += n;
    if (!extraGiven && score >= 10000) { extraGiven = true; lives++; sfx.life(); }
    if (score > high) { high = score; try { localStorage.setItem('pacman-high', String(high)); } catch (e) {} }
  }

  // ---------- Movement ----------
  function wrapX(e) {
    if (e.x < -1) e.x += COLS + 1;
    else if (e.x > COLS) e.x -= COLS + 1;
  }
  function advance(e, dist, onCenter) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 8) {
      const cx = Math.round(e.x), cy = Math.round(e.y);
      const atCenter = Math.abs(e.x - cx) < 1e-6 && Math.abs(e.y - cy) < 1e-6;
      if (atCenter) {
        e.x = cx; e.y = cy;
        onCenter(e, cx, cy);
        if (same(e.dir, NONE) || e.path) return;
        if (blocked(cx + e.dir.x, cy + e.dir.y)) { e.stopped = true; return; }
      }
      e.stopped = false;
      let tx = e.x, ty = e.y;
      if (e.dir.x) tx = atCenter ? cx + e.dir.x : (e.dir.x > 0 ? Math.ceil(e.x) : Math.floor(e.x));
      else ty = atCenter ? cy + e.dir.y : (e.dir.y > 0 ? Math.ceil(e.y) : Math.floor(e.y));
      const rem = Math.abs(tx - e.x) + Math.abs(ty - e.y);
      const step = Math.min(dist, rem);
      e.x += e.dir.x * step; e.y += e.dir.y * step; dist -= step;
      if (step === rem) { e.x = tx; e.y = ty; }
      wrapX(e);
    }
  }

  // Scripted moves through the ghost house door.
  function followPath(g, dist) {
    while (dist > 1e-9 && g.path) {
      const p = g.path[0];
      const dx = p.x - g.x, dy = p.y - g.y;
      const rem = Math.abs(dx) + Math.abs(dy);
      if (rem < 1e-9) {
        g.path.shift();
        if (!g.path.length) { g.path = null; g.onArrive(); }
        continue;
      }
      if (Math.abs(dx) > 1e-9) g.dir = dx > 0 ? RIGHT : LEFT; else g.dir = dy > 0 ? DOWN : UP;
      const step = Math.min(dist, rem);
      if (Math.abs(dx) > 1e-9) g.x += Math.sign(dx) * Math.min(step, Math.abs(dx));
      else g.y += Math.sign(dy) * Math.min(step, Math.abs(dy));
      dist -= step;
    }
  }

  function leaveHouse(g) {
    g.state = 'leaving';
    g.path = [{ x: 13.5, y: g.y }, { x: 13.5, y: 11 }];
    g.onArrive = () => { g.state = 'active'; g.dir = LEFT; };
  }
  function enterHouse(g) {
    g.state = 'entering';
    g.path = [{ x: 13.5, y: 11 }, { x: 13.5, y: 14 }];
    g.onArrive = () => { g.fright = false; leaveHouse(g); };
  }

  function ghostTarget(g) {
    if (g.state === 'eaten') return { x: 13, y: 11 };
    const chase = modeIndex % 2 === 1;
    if (!chase) return g.corner;
    const px = Math.round(pac.x), py = Math.round(pac.y);
    switch (g.name) {
      case 'blinky': return { x: px, y: py };
      case 'pinky': return { x: px + pac.dir.x * 4, y: py + pac.dir.y * 4 };
      case 'inky': {
        const b = ghosts[0];
        const vx = px + pac.dir.x * 2, vy = py + pac.dir.y * 2;
        return { x: vx * 2 - Math.round(b.x), y: vy * 2 - Math.round(b.y) };
      }
      default: {
        const d = Math.hypot(g.x - pac.x, g.y - pac.y);
        return d > 8 ? { x: px, y: py } : g.corner;
      }
    }
  }

  function ghostOnCenter(g, cx, cy) {
    if (g.state === 'eaten' && cx === 13 && cy === 11) { enterHouse(g); return; }
    const opts = [UP, LEFT, DOWN, RIGHT].filter(d => !opposite(d, g.dir) && !blocked(cx + d.x, cy + d.y));
    if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
    if (g.fright && g.state === 'active') { g.dir = opts[Math.floor(Math.random() * opts.length)]; return; }
    const t = ghostTarget(g);
    let best = opts[0], bestD = Infinity;
    for (const d of opts) {
      const dd = (cx + d.x - t.x) ** 2 + (cy + d.y - t.y) ** 2;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    g.dir = best;
  }

  function pacOnCenter(e, cx, cy) {
    if (!same(e.want, NONE) && !blocked(cx + e.want.x, cy + e.want.y)) e.dir = e.want;
  }

  function reverseActive() {
    for (const g of ghosts) if (g.state === 'active') g.dir = { x: -g.dir.x, y: -g.dir.y };
  }

  // ---------- Update ----------
  function update(dt) {
    time += dt;
    stateTime += dt;
    if (state === 'ready') { if (stateTime > 2.2) setState('play'); return; }
    if (state === 'freeze') { if (stateTime > 0.6) { popup = null; setState('play'); } return; }
    if (state === 'dying') {
      if (stateTime > 2) {
        lives--;
        if (lives <= 0) setState('over');
        else { resetPositions(); setState('ready'); }
      }
      return;
    }
    if (state === 'clear') {
      if (stateTime > 2.4) { level++; startLevel(); }
      return;
    }
    if (state !== 'play') return;

    // Modes
    if (frightTime > 0) {
      frightTime -= dt;
      if (frightTime <= 0) ghosts.forEach(g => { g.fright = false; });
    } else {
      modeTime += dt;
      if (modeTime >= MODES[modeIndex]) { modeTime = 0; modeIndex++; reverseActive(); }
    }

    // Release ghosts from the house
    sinceDot += dt; sinceRelease += dt;
    const waiting = ghosts.find(g => g.state === 'house');
    if (waiting && ((dotsEaten >= waiting.dots && sinceRelease > 0.8) || sinceDot > 4)) {
      leaveHouse(waiting); sinceRelease = 0; sinceDot = 0;
    }

    // Pac-Man
    if (opposite(pac.want, pac.dir)) pac.dir = pac.want;
    advance(pac, pacSpeed() * dt, pacOnCenter);
    if (!pac.stopped) pac.mouth += dt * 18;
    const tx = Math.round(pac.x), ty = Math.round(pac.y);
    if (tx >= 0 && tx < COLS) {
      const c = grid[ty][tx];
      if (c === '.' || c === 'o') {
        grid[ty][tx] = ' ';
        dotsLeft--; dotsEaten++; sinceDot = 0;
        if (c === '.') { addScore(10); sfx.dot(); }
        else {
          addScore(50); sfx.power();
          frightTime = frightDuration(); combo = 0;
          ghosts.forEach(g => { if (g.state !== 'eaten' && g.state !== 'entering') g.fright = true; });
          reverseActive();
        }
        if (dotsLeft === 0) { setState('clear'); return; }
      }
    }

    // Ghosts
    for (const g of ghosts) {
      if (g.state === 'house') {
        g.y = 14 + Math.sin(time * 5 + g.home) * 0.3;
        g.dir = Math.cos(time * 5 + g.home) > 0 ? DOWN : UP;
        continue;
      }
      let sp = ghostSpeed();
      if (g.state === 'eaten' || g.state === 'entering') sp = 16;
      else if (g.state === 'leaving') sp = 3.5;
      else if (g.fright) sp = 4.6;
      else if (Math.round(g.y) === TUNNEL_ROW && (g.x < 5.5 || g.x > 21.5)) sp = 4;
      if (g.path) followPath(g, sp * dt);
      else advance(g, sp * dt, ghostOnCenter);
    }

    // Collisions
    for (const g of ghosts) {
      if (g.state !== 'active') continue;
      if (Math.abs(g.x - pac.x) + Math.abs(g.y - pac.y) > 0.75) continue;
      if (g.fright) {
        const pts = 200 * 2 ** combo; combo = Math.min(combo + 1, 3);
        addScore(pts); sfx.ghost();
        g.fright = false; g.state = 'eaten';
        popup = { x: g.x, y: g.y, text: String(pts), ghost: g };
        setState('freeze');
        return;
      }
      setState('dying'); sfx.death();
      return;
    }
  }

  // ---------- Drawing ----------
  const px = x => x * T + T / 2;
  const py = y => TOP + y * T + T / 2;
  const FONT = '"Press Start 2P", monospace';
  const TAP = window.matchMedia && matchMedia('(pointer: coarse)').matches ? 'TAP' : 'CLICK';

  function text(str, x, y, color, size = 12, align = 'center') {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawMaze() {
    const flash = state === 'clear' && stateTime > 0.6 && Math.floor(stateTime * 5) % 2 === 0;
    ctx.strokeStyle = flash ? '#ffffff' : '#2a4bff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke(wallPath);
    ctx.fillStyle = '#ffb8ff';
    ctx.fillRect(13 * T, TOP + 12 * T + T / 2 - 1.5, 2 * T, 3);

    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      if (c === '.') { ctx.fillStyle = '#ffb897'; ctx.fillRect(px(x) - 1.5, py(y) - 1.5, 3, 3); }
      else if (c === 'o' && (state !== 'play' || Math.floor(time * 4) % 2 === 0)) {
        ctx.fillStyle = '#ffb897'; ctx.beginPath(); ctx.arc(px(x), py(y), 5.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPac() {
    if (state === 'freeze') return;
    const x = px(pac.x), y = py(pac.y), r = T * 0.72;
    let angle = Math.atan2(pac.dir.y, pac.dir.x);
    let mouth = (Math.sin(pac.mouth) + 1) / 2 * 0.8 + 0.05;
    if (state === 'ready' || state === 'title') mouth = 0.35;
    if (state === 'dying') {
      if (stateTime < 0.5) mouth = 0.35;
      else { mouth = Math.min(Math.PI, 0.35 + (stateTime - 0.5) * 2.6); angle = -Math.PI / 2; }
      if (mouth >= Math.PI) return;
    }
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
  }

  function drawGhost(g) {
    if (popup && popup.ghost === g) return;
    const x = px(g.x), y = py(g.y), r = T * 0.72;
    const eyesOnly = g.state === 'eaten' || g.state === 'entering';
    if (!eyesOnly) {
      let color = g.color;
      if (g.fright) {
        const blink = frightTime < 2 && Math.floor(time * 8) % 2 === 0;
        color = blink ? '#ffffff' : '#2121ff';
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r, Math.PI, 0);
      const bottom = y + r * 0.9;
      ctx.lineTo(x + r, bottom);
      const phase = Math.floor(time * 8) % 2, w = (2 * r) / 6;
      for (let i = 1; i <= 6; i++) ctx.lineTo(x + r - i * w, (i + phase) % 2 ? bottom - r * 0.28 : bottom);
      ctx.closePath();
      ctx.fill();
    }
    if (g.fright && !eyesOnly) {
      const blink = frightTime < 2 && Math.floor(time * 8) % 2 === 0;
      ctx.fillStyle = blink ? '#ff0000' : '#ffb897';
      ctx.fillRect(x - r * 0.4, y - r * 0.35, 3, 3);
      ctx.fillRect(x + r * 0.4 - 3, y - r * 0.35, 3, 3);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const mx = x - r * 0.6 + i * (r * 1.2 / 6), my = y + r * 0.3 + (i % 2 ? -2 : 1);
        i ? ctx.lineTo(mx, my) : ctx.moveTo(mx, my);
      }
      ctx.stroke();
      return;
    }
    for (const s of [-1, 1]) {
      const ex = x + s * r * 0.38, ey = y - r * 0.25;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex + g.dir.x * 1.5, ey + g.dir.y * 1.5, r * 0.28, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2121ff';
      ctx.beginPath(); ctx.arc(ex + g.dir.x * r * 0.18, ey + g.dir.y * r * 0.2, r * 0.15, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHud() {
    text('SCORE', 8, 12, '#fff', 9, 'left');
    text(String(score), 8, 28, '#fff', 11, 'left');
    text('HIGH', CW - 8, 12, '#fff', 9, 'right');
    text(String(high), CW - 8, 28, '#fff', 11, 'right');
    text('LEVEL ' + level, CW / 2, 20, '#ffe600', 9);
    const by = TOP + ROWS * T + BOTTOM / 2;
    for (let i = 0; i < Math.min(lives - (state === 'title' ? 0 : 1), 6); i++) {
      const lx = 18 + i * 22;
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.moveTo(lx, by); ctx.arc(lx, by, 8, Math.PI + 0.6, Math.PI * 3 - 0.6); ctx.closePath(); ctx.fill();
    }
    text(soundOn ? 'SOUND ON' : 'SOUND OFF', CW - 8, by, soundOn ? '#fff' : '#777', 8, 'right');
  }

  function overlay(lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, py(9.5), CW, 10 * T);
    lines.forEach(([str, color, size], i) => text(str, CW / 2, py(11.5) + i * 28, color, size));
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CW, CH);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, TOP, CW, ROWS * T); ctx.clip();
    drawMaze();
    if (state !== 'dying' || stateTime < 0.5) ghosts.forEach(g => { if (state !== 'clear') drawGhost(g); });
    drawPac();
    ctx.restore();
    if (popup) text(popup.text, px(popup.x), py(popup.y), '#00ffff', 9);
    drawHud();

    if (state === 'ready') text('READY!', CW / 2, py(17), '#ffe600', 14);
    if (state === 'title') {
      overlay([
        ['PAC-MAN', '#ffe600', 26],
        ['', '#fff', 10],
        [Math.floor(time * 2) % 2 ? '' : TAP + ' TO PLAY', '#fff', 12],
        ['ARROWS / WASD / SWIPE', '#999', 8],
      ]);
    }
    if (state === 'over') {
      overlay([
        ['GAME OVER', '#ff0000', 20],
        ['SCORE ' + score, '#fff', 11],
        ['', '#fff', 10],
        [Math.floor(time * 2) % 2 ? '' : TAP + ' TO PLAY AGAIN', '#fff', 10],
      ]);
    }
  }

  // ---------- Input ----------
  function setWant(d) { pac.want = d; }
  const KEYS = {
    ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
    KeyW: UP, KeyS: DOWN, KeyA: LEFT, KeyD: RIGHT,
  };
  function startIfIdle() {
    audio();
    if (state === 'title' || state === 'over') { newGame(); return true; }
    return false;
  }
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { soundOn = !soundOn; return; }
    const d = KEYS[e.code];
    if (d) { e.preventDefault(); if (!startIfIdle()) setWant(d); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startIfIdle(); }
  });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  let touch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.focus();
    const p = toCanvas(e);
    if (p.y > TOP + ROWS * T && p.x > CW - 100) { soundOn = !soundOn; audio(); return; }
    if (startIfIdle()) return;
    touch = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  canvas.addEventListener('pointermove', e => {
    if (!touch || touch.id !== e.pointerId) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
    setWant(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
    touch.x = e.clientX; touch.y = e.clientY;
  });
  const endTouch = () => { touch = null; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  // ---------- Loop ----------
  resetDots();
  resetPositions();
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.load) document.fonts.load(`12px ${FONT}`);

  // Exposed for automated checks.
  window.__pac = { get state() { return state; }, get score() { return score; }, pac, ghosts, get dotsLeft() { return dotsLeft; } };
})();
