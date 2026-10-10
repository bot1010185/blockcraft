/* Blockcraft 2D v2 (Mike) */
(() => {
'use strict';
const W = 400, H = 128, TS = 16, SAVE = 'blockcraft-world-v2';
// ---------- ids ----------
const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, LOG:4, LEAVES:5, PLANKS:6, COAL_ORE:7, IRON_ORE:8, GOLD_ORE:9, DIAMOND_ORE:10, SAND:11, BEDROCK:12, GLASS:13, COBBLE:14, TORCH:15, TABLE:16 };
const I = { STICK:100, WOOD_PICK:101, STONE_PICK:102, IRON_PICK:103, COAL:104, IRON:105, GOLD:106, DIAMOND:107, WOOD_SWORD:108, STONE_SWORD:109, DIAMOND_SWORD:110, APPLE:111, GOLDEN_APPLE:112 };
// h = seconds by hand, pick = needs a pickaxe tier (0 none,1 wood,2 stone,3 iron), drop
const BLK = {
  1:{n:'Grass',h:.6,drop:2}, 2:{n:'Dirt',h:.5}, 3:{n:'Stone',h:4,pick:1,drop:14}, 4:{n:'Oak Log',h:1.6}, 5:{n:'Leaves',h:.25,drop:0},
  6:{n:'Planks',h:1.4}, 7:{n:'Coal Ore',h:4.5,pick:1,drop:I.COAL}, 8:{n:'Iron Ore',h:5,pick:2,drop:I.IRON}, 9:{n:'Gold Ore',h:5,pick:3,drop:I.GOLD},
  10:{n:'Diamond Ore',h:6,pick:3,drop:I.DIAMOND}, 11:{n:'Sand',h:.5}, 12:{n:'Bedrock',h:Infinity}, 13:{n:'Glass',h:.4,drop:0}, 14:{n:'Cobblestone',h:4,pick:1},
  15:{n:'Torch',h:.05}, 16:{n:'Crafting Table',h:1.6}
};
const ITEM = {
  [I.APPLE]:{n:'Apple',heal:4}, [I.GOLDEN_APPLE]:{n:'Golden Apple',heal:20},
  [I.STICK]:{n:'Stick'}, [I.WOOD_PICK]:{n:'Wooden Pickaxe',tier:1,speed:2}, [I.STONE_PICK]:{n:'Stone Pickaxe',tier:2,speed:4}, [I.IRON_PICK]:{n:'Iron Pickaxe',tier:3,speed:6},
  [I.COAL]:{n:'Coal'}, [I.IRON]:{n:'Iron Ingot'}, [I.GOLD]:{n:'Gold Ingot'}, [I.DIAMOND]:{n:'Diamond'},
  [I.WOOD_SWORD]:{n:'Wooden Sword',dmg:3}, [I.STONE_SWORD]:{n:'Stone Sword',dmg:4}, [I.DIAMOND_SWORD]:{n:'Diamond Sword',dmg:7}
};
const name = id => (BLK[id] || ITEM[id] || {}).n || '?';
const placeable = id => id > 0 && id < 100;
const solid = v => v !== B.AIR && v !== B.LEAVES && v !== B.TORCH;
const RECIPES = [
  { out:B.PLANKS, n:4, cost:{[B.LOG]:1} },
  { out:I.STICK, n:4, cost:{[B.PLANKS]:2} },
  { out:B.TABLE, n:1, cost:{[B.PLANKS]:4} },
  { out:I.WOOD_PICK, n:1, cost:{[B.PLANKS]:3,[I.STICK]:2}, table:true },
  { out:I.WOOD_SWORD, n:1, cost:{[B.PLANKS]:2,[I.STICK]:1}, table:true },
  { out:B.TORCH, n:4, cost:{[I.COAL]:1,[I.STICK]:1} },
  { out:I.STONE_PICK, n:1, cost:{[B.COBBLE]:3,[I.STICK]:2}, table:true },
  { out:I.STONE_SWORD, n:1, cost:{[B.COBBLE]:2,[I.STICK]:1}, table:true },
  { out:I.IRON_PICK, n:1, cost:{[I.IRON]:3,[I.STICK]:2}, table:true },
  { out:I.DIAMOND_SWORD, n:1, cost:{[I.DIAMOND]:2,[I.STICK]:1}, table:true },
  { out:B.GLASS, n:1, cost:{[B.SAND]:1,[I.COAL]:1} },
  { out:I.GOLDEN_APPLE, n:1, cost:{[I.GOLD]:4,[I.APPLE]:1} },
];

// ---------- sound (synth, no files) ----------
const SFX = (() => { let ac = null, muted = (() => { try { return localStorage.getItem('blockcraft-muted') === '1'; } catch (e) { return false; } })(), master;
  const init = () => { if (ac) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .35; master.connect(ac.destination); } catch (e) {} };
  const noise = (dur, freq, q, vol, type = 'bandpass') => { if (!ac || muted) return; const n = ac.sampleRate * dur | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2; const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.value = vol; src.connect(f).connect(g).connect(master); src.start(); };
  const tone = (f0, f1, dur, vol, type = 'square', delay = 0) => { if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur); };
  const mat = id => [B.STONE, B.COBBLE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.BEDROCK].includes(id) ? 'stone' : [B.LOG, B.PLANKS, B.TABLE].includes(id) ? 'wood' : id === B.SAND ? 'sand' : id === B.GLASS ? 'glass' : [B.LEAVES].includes(id) ? 'leaf' : 'dirt';
  const M = { stone:[2400, 1.2, .9], wood:[700, 2, 1], dirt:[450, .8, 1], sand:[3000, .5, .6], leaf:[3500, .7, .5], glass:[5000, 4, .7] };
  return { init, toggle: () => { muted = !muted; try { localStorage.setItem('blockcraft-muted', muted ? '1' : '0'); } catch (e) {} return muted; },
    dig: id => { const [f, q, v] = M[mat(id)]; noise(.07, f * (.9 + Math.random() * .2), q, v * .6); },
    brk: id => { const [f, q, v] = M[mat(id)]; noise(.18, f, q, v); if (mat(id) === 'glass') { tone(2600, 1800, .15, .08, 'triangle'); tone(3400, 2000, .12, .06, 'triangle', .04); } },
    place: id => { const [f, q, v] = M[mat(id)]; noise(.1, f * .7, q, v); },
    hit: () => { noise(.08, 900, 1, .9); tone(180, 80, .1, .25); },
    hurt: () => { tone(330, 180, .18, .2, 'sawtooth'); noise(.08, 600, 1, .5); },
    groan: () => { tone(110, 70, .7, .12, 'sawtooth'); tone(116, 72, .7, .08, 'sawtooth'); },
    die: () => { tone(300, 60, .5, .2, 'sawtooth'); },
    eat: () => { for (let i = 0; i < 3; i++) setTimeout(() => noise(.06, 1800, 1, .6), i * 120); },
    craft: () => { tone(520, 780, .08, .12); tone(780, 1040, .08, .1, 'square', .07); },
    goal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .16, .12, 'square', i * .1)); },
    step: () => noise(.04, 500, 1, .25), jump: () => noise(.05, 700, 1, .3) };
})();
addEventListener('pointerdown', () => SFX.init(), { once: true }); addEventListener('keydown', () => SFX.init(), { once: true });

// ---------- random / noise ----------
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noise1 = (x, s) => { const i = Math.floor(x), f = x - i; return lerp(hash(i, 0, s), hash(i + 1, 0, s), sm(f)); };
const noise2 = (x, y, s) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
  return lerp(lerp(hash(ix, iy, s), hash(ix + 1, iy, s), fx), lerp(hash(ix, iy + 1, s), hash(ix + 1, iy + 1, s), fx), fy); };

// ---------- textures ----------
const tex = {};
const mk = (w = TS, h = TS) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function blockTex(id) {
  const c = mk(), g = c.getContext('2d'); seed = id * 9973 + 7;
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const sh = (b, v) => `rgb(${clamp(b[0] * (1 + v), 0, 255) | 0},${clamp(b[1] * (1 + v), 0, 255) | 0},${clamp(b[2] * (1 + v), 0, 255) | 0})`;
  const fill = (b, a) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, sh(b, (rnd() - .5) * a)); };
  const ore = (col, dark) => { fill([125,125,125], .3); for (let i = 0; i < 5; i++) { const x = 1 + (rnd() * 12) | 0, y = 1 + (rnd() * 12) | 0;
      px(x, y, col); px(x + 1, y, col); px(x, y + 1, dark); px(x + 1, y + 1, col); if (rnd() < .5) px(x + 2, y + 1, dark); } };
  switch (id) {
    case B.GRASS: fill([134,96,67], .3); for (let x = 0; x < TS; x++) { const d = 3 + (rnd() * 3 | 0); for (let y = 0; y < d; y++) px(x, y, sh([96,170,60], (rnd() - .5) * .3)); } break;
    case B.DIRT: fill([134,96,67], .3); break;
    case B.STONE: fill([125,125,125], .25); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 6; i++) g.fillRect(rnd() * 13 | 0, rnd() * 15 | 0, 3, 1); break;
    case B.COBBLE: fill([110,110,110], .45); g.fillStyle = 'rgba(0,0,0,.45)';
      [[0,4],[0,9],[0,13]].forEach(([x, y]) => g.fillRect(x, y, 16, 1)); [[5,0,4],[11,4,5],[3,9,4],[9,13,3]].forEach(([x, y, h]) => g.fillRect(x, y, 1, h)); break;
    case B.LOG: for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, sh([102,81,50], (x % 4 === 1 ? -.3 : 0) + (rnd() - .5) * .2)); break;
    case B.LEAVES: for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (rnd() > .14) px(x, y, sh([58,125,42], (rnd() - .5) * .55)); break;
    case B.PLANKS: for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, sh([180,144,90], (y % 4 === 3 ? -.35 : 0) + ((x + (y >> 2) * 5) % 8 === 0 && y % 4 !== 3 ? -.25 : 0) + (rnd() - .5) * .1)); break;
    case B.COAL_ORE: ore('#222', '#000'); break;
    case B.IRON_ORE: ore('#e0b89a', '#a07858'); break;
    case B.GOLD_ORE: ore('#fcee4b', '#c9a400'); break;
    case B.DIAMOND_ORE: ore('#6ff3f8', '#1fb0b8'); break;
    case B.SAND: fill([219,207,163], .12); break;
    case B.BEDROCK: fill([80,80,80], 1.3); break;
    case B.GLASS: g.fillStyle = 'rgba(200,235,255,.15)'; g.fillRect(0, 0, TS, TS); g.strokeStyle = '#e8f6ff'; g.strokeRect(.5, .5, 15, 15);
      for (let i = 0; i < 4; i++) { px(3 + i, 6 - i, '#fff'); px(8 + i, 12 - i, '#fff'); } break;
    case B.TORCH: g.fillStyle = '#7a5a30'; g.fillRect(7, 6, 2, 10); g.fillStyle = '#ffd84a'; g.fillRect(7, 4, 2, 2); g.fillStyle = '#ff8a1a'; g.fillRect(7, 5, 2, 1); g.fillStyle = '#fff6b0'; g.fillRect(7, 3, 1, 1); break;
    case B.TABLE: for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(x, y, sh([180,144,90], (rnd() - .5) * .12)); g.fillStyle = '#6b4423'; g.fillRect(0, 0, 16, 3);
      g.fillStyle = '#4a3018'; g.fillRect(2, 5, 5, 5); g.fillRect(9, 5, 5, 5); g.fillStyle = '#9a9a9a'; g.fillRect(3, 6, 1, 3); g.fillRect(4, 6, 2, 1); g.fillStyle = '#c69c6d'; g.fillRect(10, 6, 1, 3); break;
  }
  return c;
}
function gridTex(rows, pal) { const c = mk(rows[0].length, rows.length), g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); return c; }
// Pickaxe: T-shaped head (H body, L highlight, D shadow) across a brown handle (S, T shade), dark outline O. Sword: blade H/L/D, guard G, grip S, pommel P.
const PICK = [".ODLLLLOO.", "ODHHHHHHHO", ".ODDDOOHHO", "..OOOOSTHL", "....OSTOHL", "...OSTODHL", "..OSTOODHL", ".OSTO.ODHD", "OSTO...ODO", "STO.....O."];
const SWORD = [".......ODL", "......ODLL", ".....ODLDO", "....ODLDO.", ".O.ODLDO..", "OGODLDO...", ".OGLDO....", ".OSGGO....", "OSOOGO....", "PO..O....."];
for (const k in BLK) tex[k] = blockTex(+k);
tex[I.STICK] = gridTex(["..........", "........S.", ".......S..", "......S...", ".....S....", "....S.....", "...S......", "..S.......", ".S........", ".........."], { S:'#8b5a2b' });
const tool = (rows, H, L, D, more) => gridTex(rows, Object.assign({ H, L, D, S:'#8b5a2b', T:'#5a3a1c', P:'#5a3a1c', O:'#1e1e1e' }, more));
tex[I.WOOD_PICK] = tool(PICK, '#b08850', '#d6b47a', '#6e5030');
tex[I.STONE_PICK] = tool(PICK, '#8a8a8a', '#b8b8b8', '#555555');
tex[I.IRON_PICK] = tool(PICK, '#d8d8d8', '#ffffff', '#8a8a8a');
tex[I.WOOD_SWORD] = tool(SWORD, '#b08850', '#d6b47a', '#6e5030', { G:'#5a3a1c' });
tex[I.STONE_SWORD] = tool(SWORD, '#8a8a8a', '#b8b8b8', '#555555', { G:'#5a3a1c' });
tex[I.DIAMOND_SWORD] = tool(SWORD, '#33d6dc', '#b6fbfd', '#13868c', { G:'#d9a400' });
tex[I.COAL] = gridTex(["..........", "...KKK....", "..KKKKK...", ".KKGKKKK..", ".KKKKKGK..", "..KKKKKK..", "...KKKK...", "..........", "..........", ".........."], { K:'#222', G:'#555' });
const ingot = c => gridTex(["..........", "..........", "...LLLLL..", "..LCCCCL..", ".LCCCCCD..", ".DDDDDD...", "..........", "..........", "..........", ".........."], { L:'#fff', C:c, D:'#666' });
tex[I.IRON] = ingot('#d8d8d8'); tex[I.GOLD] = ingot('#fcd33a');
tex[I.DIAMOND] = gridTex(["..........", "...CCCC...", "..CLLCCC..", ".CLCCCCCC.", ".CCCCCCDC.", "..CCCCDC..", "...CCDC...", "....CC....", "..........", ".........."], { C:'#4ee1e6', L:'#dffcff', D:'#1a9aa0' });
tex[I.APPLE] = gridTex(["....S.....", "....SL....", "..RRSRR...", ".RWRRRRR..", ".RWRRRRR..", ".RRRRRRR..", ".RRRRRRD..", "..RRRRD...", "...RDD....", ".........."], { S:'#6b4423', L:'#3fa040', R:'#e02424', W:'#ff9a9a', D:'#9a1010' });
tex[I.GOLDEN_APPLE] = gridTex(["....S.....", "....SL....", "..GGSGG...", ".GWGGGGG..", ".GWGGGGG..", ".GGGGGGG..", ".GGGGGGD..", "..GGGGD...", "...GDD....", ".........."], { S:'#6b4423', L:'#3fa040', G:'#fcd33a', W:'#fff6b0', D:'#c99a00' });
const crack = []; for (let s = 0; s < 6; s++) { const c = mk(), g = c.getContext('2d'); seed = 99 + s; g.fillStyle = 'rgba(0,0,0,.65)';
  for (let i = 0; i < (s + 1) * 7; i++) g.fillRect(rnd() * TS | 0, rnd() * TS | 0, 1 + (rnd() * 2 | 0), 1); crack.push(c); }

// ---------- world ----------
const world = new Uint8Array(W * H), surface = new Int16Array(W), top = new Int16Array(W);
let worldSeed = 0;
const get = (x, y) => (x < 0 || x >= W || y < 0) ? B.AIR : y >= H ? B.BEDROCK : world[y * W + x];
const setRaw = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) world[y * W + x] = v; };
const lightBlocks = v => v !== B.AIR && v !== B.TORCH && v !== B.GLASS && v !== B.LEAVES && v !== B.LOG;
const calcTop = x => { let y = 0; while (y < H && !lightBlocks(get(x, y))) y++; top[x] = y; };
let torches = [];
const set = (x, y, v) => { const old = get(x, y); setRaw(x, y, v); calcTop(x);
  if (old === B.TORCH) torches = torches.filter(t => t.x !== x || t.y !== y); if (v === B.TORCH) torches.push({ x, y }); };

function generate(s) {
  worldSeed = s; world.fill(0); torches = [];
  for (let x = 0; x < W; x++) {
    const h = Math.round(52 + (noise1(x / 40, s) - .5) * 26 + (noise1(x / 12, s + 1) - .5) * 8 + (noise1(x / 120, s + 2) - .5) * 30);
    surface[x] = h; const sandy = noise1(x / 30, s + 3) > .72;
    for (let y = h; y < H; y++) {
      let b = y === h ? (sandy ? B.SAND : B.GRASS) : y < h + 4 ? (sandy ? B.SAND : B.DIRT) : B.STONE;
      if (b === B.STONE) { const r = hash(x, y, s + 9), d = y - h;
        if (r < .014) b = B.COAL_ORE; else if (d > 10 && r < .022) b = B.IRON_ORE; else if (d > 28 && r < .026) b = B.GOLD_ORE; }
      if (y > h + 6 && y < H - 3 && noise2(x / 14, y / 9, s + 5) > .66) b = B.AIR;
      if (y >= H - 2 || (y === H - 3 && hash(x, y, s) < .5)) b = B.BEDROCK;
      setRaw(x, y, b);
    }
  }
  // diamonds come in veins of 2 to 4 so one find is enough for a sword
  for (let y = 0; y < H - 3; y++) for (let x = 1; x < W - 1; x++) if (y - surface[x] > 34 && world[y * W + x] === B.STONE && hash(x, y, s + 11) < .0009) {
    world[y * W + x] = B.DIAMOND_ORE; const n = 1 + (hash(x, y, s + 12) * 3 | 0);
    for (let k = 0, tries = 0; k < n && tries < 12; tries++) { const xx = x + ((hash(x + tries, y, s + 13) * 3 | 0) - 1), yy = y + ((hash(x, y + tries, s + 14) * 3 | 0) - 1);
      if (get(xx, yy) === B.STONE || get(xx, yy) === B.COAL_ORE) { setRaw(xx, yy, B.DIAMOND_ORE); k++; } } }
  for (let x = 3; x < W - 3; x++) {
    if (get(x, surface[x]) === B.GRASS && hash(x, 0, s + 7) < .09 && get(x - 2, surface[x] - 1) === B.AIR) {
      const t = surface[x], th = 4 + (hash(x, 1, s) * 3 | 0);
      for (let i = 1; i <= th; i++) setRaw(x, t - i, B.LOG);
      for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = t - th + dy; if (Math.abs(dx) + Math.abs(dy) < 4 && get(x + dx, yy) === B.AIR) setRaw(x + dx, yy, B.LEAVES); }
      x += 3;
    }
  }
  for (let x = 0; x < W; x++) calcTop(x);
}

// ---------- entities ----------
const newEnt = (x, y, kind) => ({ kind, x, y, vx: 0, vy: 0, w: .6, h: 1.8, ground: false, face: 1, hp: kind === 'zombie' ? 10 : 20, fallStart: null, walk: 0, swing: 0, hurt: 0, atk: 0 });
const P = newEnt(W / 2, 0, 'player');
let mobs = [], parts = [];
let inv = {}, hot = Array(9).fill(0), sel = 0, time = .08, firstDay = true, goal = 0, won = false;
function treeNear(cx) { for (let d = 0; d < 40; d++) for (const x of [cx + d, cx - d]) if (x > 2 && x < W - 2 && get(x, surface[x] - 1) === B.LOG) return x; return -1; }
function plantTree(x) { const t = surface[x]; if (get(x, t) !== B.GRASS && get(x, t) !== B.DIRT) setRaw(x, t, B.GRASS); for (let i = 1; i <= 5; i++) setRaw(x, t - i, B.LOG);
  for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = t - 5 + dy; if (Math.abs(dx) + Math.abs(dy) < 4 && get(x + dx, yy) === B.AIR) setRaw(x + dx, yy, B.LEAVES); }
  for (let xx = x - 2; xx <= x + 2; xx++) calcTop(xx); }
function spawnPlayer() { let tx = treeNear(Math.floor(W / 2)); if (tx < 0) { tx = Math.floor(W / 2) + 3; plantTree(tx); }
  const x = tx + (get(tx - 2, surface[tx - 2] - 1) === B.AIR ? -2 : 2); let y = 0; while (y < H && !solid(get(x, y))) y++; Object.assign(P, { x: x + .5, y: y - .01, vx: 0, vy: 0, hp: 20, fallStart: null }); }
function fresh() { generate((Math.random() * 1e9) | 0); inv = {}; hot = Array(9).fill(0); sel = 0; time = .08; firstDay = true; goal = 0; won = false; mobs = []; spawnPlayer(); }
function give(id, n = 1, quiet = false) { inv[id] = (inv[id] || 0) + n; let onBar = hot.includes(id);
  if (!onBar) { const e = hot[sel] === 0 ? sel : hot.indexOf(0); if (e >= 0) { hot[e] = id; onBar = true; } else if (!quiet) toast(`${name(id)} added to inventory (C)`); }
  drawHud(); return onBar; }
function take(id, n = 1) { inv[id] -= n; if (inv[id] <= 0) { delete inv[id]; const i = hot.indexOf(id); if (i >= 0) hot[i] = 0; } drawHud(); }
const held = () => hot[sel] || 0;

// ---------- save ----------
const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function save() { try { localStorage.setItem(SAVE, JSON.stringify({ w: b64(world), s: worldSeed, sf: Array.from(surface), p: { x: P.x, y: P.y, hp: P.hp }, inv, hot, sel, time, firstDay, goal, won })); } catch (e) {} }
function load() { try { const d = JSON.parse(localStorage.getItem(SAVE)); if (!d) return false; const bin = atob(d.w); if (bin.length !== W * H) return false;
  for (let i = 0; i < bin.length; i++) world[i] = bin.charCodeAt(i); worldSeed = d.s; surface.set(d.sf); Object.assign(P, d.p);
  inv = d.inv; hot = d.hot; sel = d.sel; time = d.time; firstDay = d.firstDay ?? false; goal = d.goal; won = d.won;
  torches = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (world[y * W + x] === B.TORCH) torches.push({ x, y });
  for (let x = 0; x < W; x++) calcTop(x); return true; } catch (e) { return false; } }

// ---------- goals ----------
const GOALS = [
  { t:'Punch a tree to get wood', ok:() => inv[B.LOG] > 0 },
  { t:'Craft planks and a crafting table' + (matchMedia('(pointer: coarse)').matches ? '' : ' (C)'), ok:() => inv[B.TABLE] > 0 || nearTable() },
  { t:'Place the table and craft a wooden pickaxe', ok:() => has(I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK) },
  { t:'Mine stone to get cobblestone', ok:() => inv[B.COBBLE] > 0 || has(I.STONE_PICK, I.IRON_PICK) },
  { t:'Craft a stone pickaxe', ok:() => has(I.STONE_PICK, I.IRON_PICK) },
  { t:'Find coal and craft torches', ok:() => inv[B.TORCH] > 0 || torches.length > 0 },
  { t:'Mine 3 iron (below depth 10) and craft an iron pickaxe', ok:() => has(I.IRON_PICK) },
  { t:'Dig to depth 35+ and mine 2 diamonds', ok:() => inv[I.DIAMOND] >= 2 || has(I.DIAMOND_SWORD) },
  { t:'Craft a diamond sword', ok:() => has(I.DIAMOND_SWORD) },
];
const has = (...ids) => ids.some(i => inv[i] > 0);
const TABLE_RANGE = 8;
function nearTable() { for (let dy = -TABLE_RANGE; dy <= TABLE_RANGE; dy++) for (let dx = -TABLE_RANGE; dx <= TABLE_RANGE; dx++) if (get(Math.floor(P.x) + dx, Math.floor(P.y - 1) + dy) === B.TABLE) return true; return false; }

if (!load()) fresh();

// ---------- canvas & HUD ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let S = 32, VW = 0, VH = 0;
function resize() { cv.width = innerWidth; cv.height = innerHeight; S = innerWidth < 700 ? 28 : innerWidth < 1100 ? 36 : 40; VW = cv.width / S; VH = cv.height / S; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize); resize();
const $ = id => document.getElementById(id);
const hud = $('hud'), info = $('info'), hearts = $('hearts'), goalEl = $('goal'), craftEl = $('craft');
const slots = [];
for (let i = 0; i < 9; i++) { const d = document.createElement('button'); d.type = 'button'; d.className = 'slot'; const c = mk(32, 32), n = document.createElement('span'), k = document.createElement('i'); k.textContent = i + 1;
  d.append(c, n, k); d.onclick = () => { sel = i; drawHud(); }; hud.append(d); slots.push({ d, c, n }); }
function icon(c, id) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height); if (id && tex[id]) g.drawImage(tex[id], 0, 0, c.width, c.height); }
function drawHud() {
  slots.forEach((s, i) => { const id = hot[i]; s.d.classList.toggle('sel', i === sel); icon(s.c, id); s.n.textContent = id && inv[id] > 1 ? inv[id] : ''; s.d.title = id ? name(id) : 'Empty'; s.d.setAttribute('aria-label', `Slot ${i + 1}: ${id ? name(id) : 'empty'}`); });
  const hp = Math.ceil(P.hp); let h = ''; for (let i = 0; i < 10; i++) h += hp >= (i + 1) * 2 ? '❤' : hp === i * 2 + 1 ? '❥' : '♡'; hearts.textContent = h; hearts.setAttribute('aria-label', `Health ${hp} of 20`);
  goalEl.innerHTML = won ? '🏆 <b>You beat Blockcraft!</b> Keep building, or press R for a new world.' : `<b>Goal ${goal + 1}/${GOALS.length}:</b> ${GOALS[goal].t}`;
  if (craftEl.style.display !== 'none') drawCraft();
}
function canCraft(r) { if (r.table && !nearTable()) return false; return Object.entries(r.cost).every(([id, n]) => (inv[id] || 0) >= n); }
function drawCraft() {
  const list = $('recipes'); list.innerHTML = '';
  const table = nearTable();
  RECIPES.forEach(r => { const b = document.createElement('button'); b.type = 'button'; const ok = canCraft(r); b.className = 'recipe ' + (ok ? 'ok' : 'locked'); b.setAttribute('aria-disabled', !ok);
    const c = mk(32, 32); icon(c, r.out);
    // each ingredient shows have/need; missing ones are red
    const parts = Object.entries(r.cost).map(([id, n]) => { const have = inv[id] || 0, miss = have < n;
      return { miss, html: `<em class="${miss ? 'miss' : 'got'}">${name(+id)} ${Math.min(have, 99)}/${n}</em>`, txt: `${name(+id)} ${have}/${n}` }; });
    if (r.table) parts.push(table ? { miss: false, html: '<em class="got">crafting table ✓</em>' } : { miss: true, html: '<em class="miss">needs crafting table</em>', txt: 'a crafting table nearby' });
    const missing = parts.filter(x => x.miss).map(x => x.txt);
    b.append(c); b.insertAdjacentHTML('beforeend', `<span><b>${r.n > 1 ? r.n + '× ' : ''}${name(r.out)}</b><small>${parts.map(x => x.html).join(' ')}</small></span><i class="tag">${ok ? 'CRAFT' : ''}</i>`);
    b.title = ok ? 'Click to craft' : 'Missing: ' + missing.join(', '); b.setAttribute('aria-label', `${name(r.out)}${ok ? ', ready to craft' : ', missing ' + missing.join(', ')}`);
    b.onclick = () => { if (!canCraft(r)) { toast('Missing: ' + missing.join(', ')); return; } Object.entries(r.cost).forEach(([id, n]) => take(+id, n)); const onBar = give(r.out, r.n, true); toast('Crafted ' + name(r.out) + (onBar ? '' : ': hotbar full, it is in your inventory (C)')); SFX.craft(); };
    list.append(b); });
  const all = $('allinv'); all.innerHTML = '';
  Object.keys(inv).map(Number).forEach(id => { const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; const c = mk(32, 32); icon(c, id);
    const n = document.createElement('span'); n.textContent = inv[id] > 1 ? inv[id] : ''; b.append(c, n); b.title = `${name(id)}: put in slot ${sel + 1}`;
    b.setAttribute('aria-label', `${name(id)} ×${inv[id]}, put in selected hotbar slot`);
    b.onclick = () => { const j = hot.indexOf(id); if (j >= 0) hot[j] = hot[sel]; hot[sel] = id; drawHud(); }; all.append(b); });
}
function toggleCraft(open = craftEl.style.display === 'none') { craftEl.style.display = open ? '' : 'none'; if (open) drawCraft(); }

// ---------- input ----------
const keys = {}; let playing = false, mouse = { x: 0, y: 0, l: false }, touchMode = 'mine', touchSprint = false;
const help = $('help');
const hideHelp = () => { help.style.display = 'none'; playing = true; for (const k in keys) keys[k] = false; cv.focus(); };
$('start').onclick = hideHelp; if (location.hash === '#play') hideHelp();
$('craftBtn').onclick = () => toggleCraft(); $('craftClose').onclick = () => toggleCraft(false);
addEventListener('keydown', e => {
  const helpOpen = help.style.display !== 'none';
  if (e.key === '?' || (e.code === 'Escape' && helpOpen)) { if (helpOpen) hideHelp(); else { playing = false; help.style.display = ''; } e.preventDefault(); return; }
  if (!playing) return;
  if (e.code === 'KeyC' || e.code === 'KeyE' || (e.code === 'Escape' && craftEl.style.display !== 'none')) { toggleCraft(e.code === 'Escape' ? false : undefined); return; }
  keys[e.code] = true;
  if (e.code === 'KeyM') toast(SFX.toggle() ? 'Sound off' : 'Sound on');
  if (/^Digit[1-9]$/.test(e.code)) { sel = +e.code.slice(5) - 1; drawHud(); }
  if (e.code === 'KeyR' && confirm('Start a brand new world? Your current world will be lost.')) { fresh(); save(); drawHud(); }
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => { if (!playing) return; mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) { mouse.l = true; attack(); } if (e.button === 2) use(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { sel = (sel + (e.deltaY > 0 ? 1 : 8)) % 9; drawHud(); e.preventDefault(); }, { passive: false });
cv.addEventListener('touchstart', e => { if (!playing) return; const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; if (touchMode === 'mine') { mouse.l = true; attack(); } else use(); e.preventDefault(); }, { passive: false });
cv.addEventListener('touchend', () => mouse.l = false);
document.querySelectorAll('#touch button').forEach(b => { const k = b.dataset.k;
  if (k === 'mode') b.onclick = () => { touchMode = touchMode === 'mine' ? 'place' : 'mine'; b.textContent = touchMode === 'mine' ? '⛏' : '▣'; };
  else if (k === 'sprint') b.onclick = () => { touchSprint = !touchSprint; b.setAttribute('aria-pressed', touchSprint); b.title = touchSprint ? 'Sprint on' : 'Sprint off'; toast(touchSprint ? 'Sprint on' : 'Sprint off'); };
  else { b.ontouchstart = e => { keys['T' + k] = true; e.preventDefault(); }; b.ontouchend = b.ontouchcancel = () => keys['T' + k] = false; } });
// on touch screens, move Craft into the touch cluster (clear of the hotbar) and drop the keyboard hint
if (matchMedia('(pointer: coarse)').matches) { const cb = $('craftBtn'); cb.textContent = 'Craft'; $('touch').appendChild(cb); }
let toastMsg = '', toastT = 0; const toastQ = [];
// queue toasts so one shown in the same frame (e.g. 'added to inventory') isn't instantly overwritten by another (e.g. 'Goal complete')
const toast = m => { if (toastT > 0 && toastMsg !== m) { if (!toastQ.includes(m) && toastQ.length < 3) toastQ.push(m); } else { toastMsg = m; toastT = 2; } };

// ---------- targeting / actions ----------
let camX = P.x, camY = P.y;
const toWorld = () => ({ x: mouse.x / S + camX - VW / 2, y: mouse.y / S + camY - VH / 2 });
const target = () => { const w = toWorld(); return { x: Math.floor(w.x), y: Math.floor(w.y) }; };
const eyeY = () => P.y - 1.5;
const inReach = t => Math.hypot(t.x + .5 - P.x, t.y + .5 - eyeY()) <= 5;
const overlaps = (e, x, y) => x + 1 > e.x - e.w / 2 && x < e.x + e.w / 2 && y + 1 > e.y - e.h && y < e.y;
function use() { const t = target(), id = held(); P.swing = 1;
  if (ITEM[id] && ITEM[id].heal) { if (P.hp >= 20) { toast('You are already at full health'); return; } P.hp = Math.min(20, P.hp + ITEM[id].heal); take(id); SFX.eat(); toast(id === I.GOLDEN_APPLE ? 'Golden apple! Fully healed' : 'Ate an apple (+2 hearts)'); burst(P.x, P.y - 1.6, id === I.GOLDEN_APPLE ? '#fcd33a' : '#e02424', 8); drawHud(); return; }
  if (!placeable(id) || !inReach(t) || get(t.x, t.y) !== B.AIR || overlaps(P, t.x, t.y) || mobs.some(m => overlaps(m, t.x, t.y))) return;
  if (![[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => get(t.x + dx, t.y + dy) !== B.AIR)) return;
  if (id === B.TORCH && !solid(get(t.x, t.y + 1)) && !solid(get(t.x - 1, t.y)) && !solid(get(t.x + 1, t.y))) return;
  set(t.x, t.y, id); take(id); SFX.place(id); }
function attack() { const w = toWorld(); const m = mobs.find(m => w.x > m.x - .5 && w.x < m.x + .5 && w.y > m.y - m.h && w.y < m.y);
  if (!m || Math.hypot(m.x - P.x, m.y - P.y) > 3.5 || P.atk > 0) return false;
  const dmg = (ITEM[held()] || {}).dmg || 1; m.hp -= dmg; SFX.hit(); m.hurt = .3; m.vx = Math.sign(m.x - P.x) * 7; m.vy = -5; P.swing = 1; P.atk = .4; mouse.l = false;
  burst(m.x, m.y - 1, '#b02020', 6);
  if (m.hp <= 0) { SFX.die(); burst(m.x, m.y - 1, '#5a8a3a', 14); toast('Zombie defeated'); }
  return true; }
function burst(x, y, col, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - .5) * 6, vy: -Math.random() * 6, col, life: .6 + Math.random() * .4 }); }
let mining = null, tierHint = 0;

// ---------- physics ----------
function collide(e, axis) {
  const x0 = Math.floor(e.x - e.w / 2), x1 = Math.floor(e.x + e.w / 2 - 1e-6), y0 = Math.floor(e.y - e.h), y1 = Math.floor(e.y - 1e-6);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solid(get(x, y))) {
    if (axis === 'x') { if (e.vx > 0) e.x = x - e.w / 2; else if (e.vx < 0) e.x = x + 1 + e.w / 2; e.vx = 0; }
    else { if (e.vy > 0) { e.y = y; e.ground = true; } else if (e.vy < 0) e.y = y + 1 + e.h; e.vy = 0; }
    return true; }
  return false;
}
function move(e, ax, jump, dt, speed) {
  e.vx = lerp(e.vx, ax * speed, Math.min(1, dt * (e.ground ? 16 : 5)));
  if (jump && e.ground) { e.vy = -8.8; e.ground = false; }
  e.vy = Math.min(e.vy + 27 * dt, 30);
  e.x += e.vx * dt; const hitX = collide(e, 'x');
  e.ground = false; e.y += e.vy * dt; collide(e, 'y');
  if (!e.ground && e.vy > 0 && e.fallStart === null) e.fallStart = e.y;
  if (e.vy < 0) e.fallStart = null;
  let fall = 0; if (e.ground && e.fallStart !== null) { fall = e.y - e.fallStart; e.fallStart = null; }
  e.x = clamp(e.x, .5, W - .5);
  if (Math.abs(e.vx) > .3 && e.ground) e.walk += dt * Math.abs(e.vx) * 2.2; else e.walk *= .8;
  if (ax) e.face = ax;
  return { hitX, fall };
}
function hurtPlayer(d, msg) { if (P.hurt > 0) return; SFX.hurt(); P.hp -= d; P.hurt = 1; burst(P.x, P.y - 1, '#b02020', 5); if (msg) toast(msg); drawHud(); }
const daylight = () => clamp(.5 + Math.cos((time - .3) * Math.PI * 2) * .9, 0, 1);
const isNight = () => daylight() < .25;

function update(dt) {
  const left = keys.KeyA || keys.ArrowLeft || keys.Tleft, right = keys.KeyD || keys.ArrowRight || keys.Tright, jump = keys.KeyW || keys.Space || keys.ArrowUp || keys.Tjump;
  const sprint = keys.ShiftLeft || keys.ShiftRight || touchSprint; const wasGround = P.ground, stepBefore = Math.floor(P.walk / Math.PI);
  const r = move(P, (right ? 1 : 0) - (left ? 1 : 0), jump, dt, sprint ? 6.4 : 4.4);
  if (wasGround && !P.ground && P.vy < 0) SFX.jump(); if (P.ground && Math.floor(P.walk / Math.PI) !== stepBefore) SFX.step();
  if (r.fall > 3.5) hurtPlayer(Math.floor(r.fall - 3), 'Ouch!');
  if (P.y > H + 5) { P.hp = 0; }
  if (P.hp <= 0) { toast('You died! Respawning at spawn…'); spawnPlayer(); mobs = []; drawHud(); }
  P.hp = Math.min(20, P.hp + dt * .25); P.hurt = Math.max(0, P.hurt - dt); P.atk = Math.max(0, P.atk - dt); P.swing = Math.max(0, P.swing - dt * 4);
  // mining
  if (mouse.l && playing && craftEl.style.display === 'none') { const t = target(), id = get(t.x, t.y);
    if (id && inReach(t) && BLK[id].h !== Infinity) {
      if (!mining || mining.x !== t.x || mining.y !== t.y) mining = { x: t.x, y: t.y, p: 0 };
      const tool = ITEM[held()] || {}, need = BLK[id].pick || 0, tier = tool.tier || 0;
      let speed = 1; if (need) speed = tier >= need ? tool.speed : tier > 0 ? tool.speed * .25 : .3;
      const guard = need >= 2 && tier < need; // iron/gold/diamond: wrong pickaxe stalls at a crack stage instead of destroying the ore
      mining.p += dt * speed / BLK[id].h; if (guard && mining.p > .7) { mining.p = .7; if (performance.now() - tierHint > 2500) { tierHint = performance.now(); toast(`${BLK[id].n} needs ${['', 'a wooden', 'a stone', 'an iron'][need]} pickaxe`); } } if ((mining.tick = (mining.tick || 0) + dt) > .22) { mining.tick = 0; SFX.dig(id); } P.swing = Math.max(P.swing, .6 + .4 * Math.sin(performance.now() / 60));
      if (Math.random() < dt * 8) parts.push({ x: t.x + .5, y: t.y + .5, vx: (Math.random() - .5) * 3, vy: -Math.random() * 3, col: avgCol(id), life: .4 });
      if (mining.p >= 1) {
        set(t.x, t.y, B.AIR); SFX.brk(id); burst(t.x + .5, t.y + .5, avgCol(id), 10);
        if (need && tier < need) { toast(`${BLK[id].n} needs ${['', 'a wooden', 'a stone', 'an iron'][need]} pickaxe to drop anything`); }
        else { const drop = BLK[id].drop ?? id; if (drop) give(drop); }
        if (id === B.LEAVES && Math.random() < .15) give(I.STICK);
        if (id === B.LEAVES && Math.random() < .12) { give(I.APPLE); toast('Found an apple! Right click to eat it'); }
        mining = null;
        // unsupported torches fall
        [[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => { const x = t.x + dx, y = t.y + dy; if (get(x, y) === B.TORCH && !solid(get(x, y + 1)) && !solid(get(x - 1, y)) && !solid(get(x + 1, y))) { set(x, y, B.AIR); give(B.TORCH); } });
      } else if (need && tier < need && performance.now() - tierHint > 4000) { tierHint = performance.now(); toast(`Tip: ${BLK[id].n} needs ${['', 'a wooden', 'a stone', 'an iron'][need]} pickaxe`); }
    } else mining = null; } else mining = null;

  // zombies
  time += dt / (firstDay ? 600 : 300); if (time >= 1) { time -= 1; firstDay = false; }
  if (isNight() && mobs.length < 3 && Math.random() < dt * .2) {
    const x = Math.floor(P.x + (Math.random() < .5 ? -1 : 1) * (18 + Math.random() * 14));
    if (x > 2 && x < W - 2) { let y = 0; while (y < H && !solid(get(x, y))) y++; if (y < H && top[x] >= y && Math.abs(y - P.y) < 20) mobs.push(newEnt(x + .5, y - .01, 'zombie')); } }
  mobs.forEach(m => {
    const dx = P.x - m.x, close = Math.abs(dx) < 24 && Math.abs(P.y - m.y) < 12;
    const ax = m.hurt > 0 ? 0 : close ? Math.sign(dx) * (Math.abs(dx) > .6 ? 1 : 0) : 0;
    const rr = move(m, ax, false, dt, 2.2);
    if (rr.hitX && m.ground) { m.vy = -8.2; m.ground = false; }
    if (m.hurt > 0) m.hurt -= dt;
    if (Math.abs(dx) < 14 && Math.random() < dt * .15) SFX.groan();
    if (Math.abs(dx) < .8 && Math.abs(P.y - m.y) < 1.5) { hurtPlayer(2, 'A zombie hit you!'); P.vx = Math.sign(dx || 1) * 8; P.vy = -4; }
    if (daylight() > .45) { m.hp -= dt * 3; if (Math.random() < dt * 10) parts.push({ x: m.x, y: m.y - 1.6, vx: 0, vy: -2, col: '#ff8a1a', life: .5 }); }
    if (m.y > H + 5) m.hp = 0; });
  mobs = mobs.filter(m => m.hp > 0 && Math.abs(m.x - P.x) < 60);
  parts.forEach(p => { p.vy += 15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);

  // goals
  if (!won && GOALS[goal].ok()) { goal++; if (goal >= GOALS.length) { won = true; goal = GOALS.length - 1; toast('🏆 You beat Blockcraft!'); } else toast('Goal complete! Next: ' + GOALS[goal].t); SFX.goal(); drawHud(); }

  camX = lerp(camX, P.x, Math.min(1, dt * 8)); camY = lerp(camY, P.y - 2, Math.min(1, dt * 8));
  camX = clamp(camX, VW / 2, W - VW / 2); camY = Math.min(H - VH / 2, camY);
  if (toastT > 0) toastT -= dt; else if (toastQ.length) { toastMsg = toastQ.shift(); toastT = 1.8; }
  const t = target(), id = get(t.x, t.y);
  info.textContent = `${held() ? name(held()) : 'Empty hand'} · ${id ? BLK[id].n : 'air'} · depth ${Math.max(0, Math.floor(P.y) - surface[clamp(Math.floor(P.x), 0, W - 1)])}`;
}
const colCache = {}; function avgCol(id) { if (colCache[id]) return colCache[id]; const d = tex[id].getContext('2d').getImageData(0, 0, TS, TS).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return colCache[id] = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`; }

// ---------- character drawing ----------
const STEVE = { skin:'#c69c7a', skinD:'#a8805e', hair:'#3a2a1a', eye:'#fff', pupil:'#4a3aa8', mouth:'#8a5a40', shirt:'#18a8a8', shirtD:'#127f7f', pants:'#3b3bb5', pantsD:'#2c2c8a', shoe:'#4a4a4a' };
const ZOMBIE = { skin:'#5a8a3a', skinD:'#46702c', hair:'#3f6a28', eye:'#111', pupil:'#111', mouth:'#2f4f1c', shirt:'#18a8a8', shirtD:'#127f7f', pants:'#3b3bb5', pantsD:'#2c2c8a', shoe:'#3a3a5a' };
function limb(u, x, y, w, h, ang, cols) { ctx.save(); ctx.translate(x * u, y * u); ctx.rotate(ang); cols.forEach(([c, y0, y1]) => { ctx.fillStyle = c; ctx.fillRect(-w / 2 * u, y0 * u, w * u, (y1 - y0) * u + .5); }); ctx.restore(); }
function drawPerson(e, pal, heldId) {
  const u = e.h * S / 32, sx = (e.x - (camX - VW / 2)) * S, sy = (e.y - (camY - VH / 2)) * S;
  ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.scale(e.face, 1);
  const sw = Math.sin(e.walk) * .7, zomb = e.kind === 'zombie';
  // back leg, back arm
  limb(u, 0, -12, 4, 12, -sw, [[pal.pantsD, 0, 10], [pal.shoe, 10, 12]]);
  const armBack = zomb ? -Math.PI / 2 + .1 : sw;
  limb(u, 0, -22, 4, 12, armBack, [[pal.shirtD, 0, 4], [pal.skinD, 4, 12]]);
  // body
  ctx.fillStyle = pal.shirt; ctx.fillRect(-2 * u, -24 * u, 4 * u, 12 * u);
  ctx.fillStyle = pal.shirtD; ctx.fillRect(-2 * u, -14 * u, 4 * u, 2 * u);
  // front leg
  limb(u, 0, -12, 4, 12, sw, [[pal.pants, 0, 10], [pal.shoe, 10, 12]]);
  // head 8x8, face toward +x
  const hx = -4 * u, hy = -32 * u;
  ctx.fillStyle = pal.skin; ctx.fillRect(hx, hy, 8 * u, 8 * u);
  ctx.fillStyle = pal.hair; ctx.fillRect(hx, hy, 8 * u, 2 * u); ctx.fillRect(hx, hy, 3 * u, 4 * u); ctx.fillRect(hx, hy + 2 * u, 1 * u, 3 * u);
  if (!zomb) { ctx.fillRect(hx + 6 * u, hy + 2 * u, 1 * u, 1 * u); }
  ctx.fillStyle = pal.eye; ctx.fillRect(hx + 5 * u, hy + 4 * u, 2 * u, 1 * u);
  ctx.fillStyle = pal.pupil; ctx.fillRect(hx + 6 * u, hy + 4 * u, 1 * u, 1 * u);
  ctx.fillStyle = pal.mouth; ctx.fillRect(hx + 5 * u, hy + 6 * u, 3 * u, 1 * u);
  ctx.fillStyle = pal.skinD; ctx.fillRect(hx + 3 * u, hy + 4 * u, 1 * u, 2 * u);
  if (e.hurt > 0) { ctx.fillStyle = 'rgba(255,0,0,.45)'; ctx.fillRect(hx, hy, 8 * u, 32 * u); }
  // front arm with swing + held item
  let armF = zomb ? -Math.PI / 2 : -sw; if (e.swing > 0) armF = -Math.PI * .55 + Math.sin(e.swing * Math.PI) * -.9;
  ctx.save(); ctx.translate(0, -22 * u); ctx.rotate(armF);
  if (heldId && tex[heldId]) { ctx.save(); ctx.translate(0, 11 * u); ctx.rotate(placeable(heldId) ? 0 : -Math.PI / 4);
    const z = placeable(heldId) ? 6 : 10; ctx.imageSmoothingEnabled = false; ctx.drawImage(tex[heldId], -z / 2 * u + (placeable(heldId) ? 1 * u : 0), -z * u + 2 * u, z * u, z * u); ctx.restore(); }
  [[pal.shirt, 0, 4], [pal.skin, 4, 12]].forEach(([c, y0, y1]) => { ctx.fillStyle = c; ctx.fillRect(-2 * u, y0 * u, 4 * u, (y1 - y0) * u + .5); });
  ctx.restore();
  ctx.restore();
}

// ---------- render ----------
function render() {
  const dl = daylight();
  ctx.fillStyle = `rgb(${lerp(8, 135, dl) | 0},${lerp(12, 206, dl) | 0},${lerp(34, 235, dl) | 0})`; ctx.fillRect(0, 0, cv.width, cv.height);
  if (dl < .6) { ctx.fillStyle = `rgba(255,255,255,${(.6 - dl) * 1.2})`; for (let i = 0; i < 60; i++) ctx.fillRect(hash(i, 1, 3) * cv.width | 0, hash(i, 2, 3) * cv.height * .6 | 0, 2, 2); }
  const ang = (time - .3) * Math.PI * 2;
  const sx = cv.width / 2 + Math.sin(ang) * cv.width * .42, sy = cv.height * .6 - Math.cos(ang) * cv.height * .5;
  ctx.fillStyle = '#fff6a8'; ctx.fillRect(sx - 26, sy - 26, 52, 52); ctx.fillStyle = '#ffe55c'; ctx.fillRect(sx - 18, sy - 18, 36, 36);
  const mx = cv.width / 2 - Math.sin(ang) * cv.width * .42, my = cv.height * .6 + Math.cos(ang) * cv.height * .5;
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(mx - 20, my - 20, 40, 40); ctx.fillStyle = '#c8c8d4'; ctx.fillRect(mx - 10, my - 8, 8, 8); ctx.fillRect(mx + 4, my + 4, 6, 6);
  const ox = camX - VW / 2, oy = camY - VH / 2;
  const x0 = Math.floor(ox), y0 = Math.floor(oy), x1 = Math.ceil(ox + VW), y1 = Math.ceil(oy + VH);
  const near = torches.filter(t => t.x > x0 - 8 && t.x < x1 + 8 && t.y > y0 - 8 && t.y < y1 + 8);
  const skyL = .32 + dl * .68;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = Math.round((x - ox) * S), py = Math.round((y - oy) * S), id = get(x, y);
    const inside = x >= 0 && x < W && y > surface[x] && y > top[x];
    if (inside && !lightBlocks(id)) { ctx.fillStyle = '#3a332c'; ctx.fillRect(px, py, S + 1, S + 1); }
    if (id) ctx.drawImage(tex[id], px, py, S + 1, S + 1);
    // light
    const tp = x >= 0 && x < W ? top[x] : 0;
    let L = y <= tp + 1 ? skyL : skyL * Math.max(0, 1 - (y - tp - 1) * .13);
    for (const t of near) { const d = Math.hypot(t.x - x, t.y - y); if (d < 10) L = Math.max(L, 1 - d / 10); }
    const pd = Math.hypot(P.x - .5 - x, P.y - 1 - y); if (pd < 6) L = Math.max(L, .5 * (1 - pd / 6)); // you can always see what's right next to you
    L = Math.max(L, id >= B.COAL_ORE && id <= B.DIAMOND_ORE ? .3 : .14); // ores glint in the dark
    if (L < .98 && !(id === B.AIR && y <= tp)) { ctx.fillStyle = `rgba(0,0,8,${(1 - L) * .92})`; ctx.fillRect(px, py, S + 1, S + 1); }
  }
  if (mining) ctx.drawImage(crack[Math.min(5, mining.p * 6 | 0)], Math.round((mining.x - ox) * S), Math.round((mining.y - oy) * S), S, S);
  const t = target(); if (inReach(t) && playing) { ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 2; ctx.strokeRect(Math.round((t.x - ox) * S) + 1, Math.round((t.y - oy) * S) + 1, S - 2, S - 2); }
  mobs.forEach(m => drawPerson(m, ZOMBIE, 0));
  drawPerson(P, STEVE, held());
  parts.forEach(p => { ctx.fillStyle = p.col; ctx.fillRect((p.x - ox) * S - 2, (p.y - oy) * S - 2, 5, 5); });
  if (toastT > 0) { ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(toastMsg, cv.width / 2 + 2, 92); ctx.fillStyle = '#ffd84a'; ctx.fillText(toastMsg, cv.width / 2, 90); }
}

let last = performance.now(), saveT = 0;
function loop(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); render(); if ((saveT += dt) > 5) { saveT = 0; save(); } requestAnimationFrame(loop); }
addEventListener('beforeunload', save);
drawHud(); requestAnimationFrame(loop);
window.__bc = { step: dt => update(dt), draw: render, P, get inv() { return inv; }, get hot() { return hot; }, get mobs() { return mobs; }, get, set, B, I, give, setTime: v => time = v, spawnZombie: (dx) => mobs.push(newEnt(P.x + dx, P.y, 'zombie')),
  toScreen: (x, y) => ({ x: (x + .5 - (camX - VW / 2)) * S, y: (y + .5 - (camY - VH / 2)) * S }), select: i => { sel = i; drawHud(); } };
})();
