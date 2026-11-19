'use strict';
/* Palm Heat Cover Lab — offline GTA-style cover art maker.
   All code written from scratch for this entry. No libraries. */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- deterministic pseudo-random for the sample scenes ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- grades: filter + gradient overlay ---------- */
const GRADES = [
  { id: 'sunset', label: 'Sunset', filter: 'saturate(1.35) contrast(1.08) sepia(0.18)',
    blend: 'overlay', alpha: 0.38, c1: '#ff9a3c', c2: '#ff2e88',
    hint: 'Warm orange-to-pink Vice City dusk.' },
  { id: 'neon', label: 'Neon Vice', filter: 'saturate(1.55) contrast(1.12)',
    blend: 'soft-light', alpha: 0.55, c1: '#00e5ff', c2: '#ff00a8',
    hint: 'Magenta and cyan night glow.' },
  { id: 'golden', label: 'Golden Hour', filter: 'saturate(1.25) contrast(1.05) sepia(0.35) brightness(1.06)',
    blend: 'soft-light', alpha: 0.40, c1: '#ffb347', c2: '#ff7b00',
    hint: 'Honeyed late-afternoon light.' },
  { id: 'noir', label: 'Noir', filter: 'grayscale(1) contrast(1.28) brightness(1.03)',
    blend: 'overlay', alpha: 0.18, c1: '#ffffff', c2: '#000000',
    hint: 'High-contrast black and white.' },
  { id: 'teal', label: 'Teal Heat', filter: 'saturate(1.3) contrast(1.1)',
    blend: 'overlay', alpha: 0.32, c1: '#00b8a9', c2: '#ff7b00',
    hint: 'Teal shadows, hot orange highlights.' },
];

/* ---------- layouts: rects in normalised 0..1 space ---------- */
function gridRects(cols, rows, gap) {
  const out = [];
  const cw = (1 - gap * (cols - 1)) / cols;
  const ch = (1 - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ x: c * (cw + gap), y: r * (ch + gap), w: cw, h: ch });
  return out;
}
const LAYOUTS = {
  fullbleed: g => [{ x: 0, y: 0, w: 1, h: 1 }],
  grid4: g => gridRects(2, 2, g),
  hero3: g => [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62 + g, y: 0, w: 0.38 - g, h: (1 - 2 * g) / 3 },
    { x: 0.62 + g, y: (1 - 2 * g) / 3 + g, w: 0.38 - g, h: (1 - 2 * g) / 3 },
    { x: 0.62 + g, y: 2 * ((1 - 2 * g) / 3 + g), w: 0.38 - g, h: (1 - 2 * g) / 3 },
  ],
  nine: g => gridRects(3, 3, g),
};
const SIZES = { '1080x1080': [1080, 1080], '1080x1350': [1080, 1350], '1920x1080': [1920, 1080] };

/* ---------- state ---------- */
const state = {
  photos: [],          // {id, name, img, w, h}
  panels: [],          // {photo, s, ox, oy} per panel
  selected: 0,
  layout: 'grid4',
  grade: 'sunset',
  title: 'PALM HEAT',
  subtitle: 'chasing the sunset',
  titleSize: 110,      // percent
  titleColor: '#ffffff',
  titlePos: 'bottom',
  band: true,
  frame: false,
  gap: 10,             // px at 1080 wide
  grain: 35,           // 0..100
  vignette: true,
  size: '1080x1080',
};
let photoSeq = 0;

/* ---------- procedural sample photos (drawn locally, no files) ---------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function drawPalm(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14, -70, 34, -120); ctx.stroke();
  ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    // fronds fan from up-left (195 deg) through straight up (270) to up-right (345),
    // drooping at the tips like a real palm crown
    const ang = Math.PI * (1.083 + (i / 6) * 0.833);
    const len = 62;
    const ex = 34 + Math.cos(ang) * len, ey = -120 + Math.sin(ang) * len * 0.5 + 22;
    const cx = 34 + Math.cos(ang) * len * 0.5, cy = -120 + Math.sin(ang) * len * 0.5 - 14;
    ctx.beginPath(); ctx.moveTo(34, -120); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
  }
  ctx.restore();
}

function drawBoulevard(w, h) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#2b1055'); sky.addColorStop(0.45, '#c94b7c'); sky.addColorStop(1, '#ff7e5f');
  x.fillStyle = sky; x.fillRect(0, 0, w, h * 0.62);
  const glow = x.createRadialGradient(w * 0.66, h * 0.40, 10, w * 0.66, h * 0.40, h * 0.42);
  glow.addColorStop(0, 'rgba(255,243,176,0.95)'); glow.addColorStop(0.25, 'rgba(255,190,120,0.55)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
  x.fillStyle = glow; x.fillRect(0, 0, w, h * 0.62);
  x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(w * 0.66, h * 0.40, h * 0.13, 0, 7); x.fill();
  const sea = x.createLinearGradient(0, h * 0.62, 0, h);
  sea.addColorStop(0, '#ff9a5c'); sea.addColorStop(1, '#5e2350');
  x.fillStyle = sea; x.fillRect(0, h * 0.62, w, h * 0.38);
  const rnd = mulberry32(7);
  x.fillStyle = 'rgba(255,240,180,0.5)';
  for (let i = 0; i < 26; i++) {
    const yy = h * 0.64 + rnd() * h * 0.3, ww = 30 + rnd() * 180;
    x.fillRect(w * 0.66 - ww / 2 + (rnd() - 0.5) * 60, yy, ww, 3);
  }
  x.fillStyle = '#241239';
  for (let i = 0; i < 9; i++) { const bw = 40 + rnd() * 90, bh = 24 + rnd() * 70; x.fillRect(i * (w / 9), h * 0.62 - bh, bw, bh); }
  drawPalm(x, w * 0.10, h * 0.98, h / 420, '#160a26');
  drawPalm(x, w * 0.88, h * 1.0, h / 360, '#160a26');
  drawPalm(x, w * 0.30, h * 0.99, h / 520, '#1c0e30');
  x.strokeStyle = 'rgba(22,10,38,0.9)'; x.lineWidth = 3;
  for (const [bx, by, s] of [[0.42, 0.18, 14], [0.5, 0.14, 11], [0.36, 0.22, 9]]) {
    x.beginPath(); x.moveTo(bx * w - s, by * h); x.quadraticCurveTo(bx * w, by * h - s * 0.6, bx * w + s, by * h); x.stroke();
  }
  return c;
}

function drawNeonStreet(w, h) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0b0620'); sky.addColorStop(1, '#241040');
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  const rnd = mulberry32(21);
  const buildings = [[0, 0.34, 0.30, 0.72], [0.32, 0.26, 0.36, 0.80], [0.70, 0.30, 0.30, 0.76]];
  for (const [bx, by, bw, bh] of buildings) {
    x.fillStyle = '#120a24'; x.fillRect(bx * w, by * h, bw * w, bh * h);
    for (let r = 0; r < 9; r++) for (let col = 0; col < 6; col++) {
      if (rnd() < 0.42) {
        x.fillStyle = rnd() < 0.5 ? 'rgba(255,214,102,0.9)' : 'rgba(0,229,255,0.85)';
        x.fillRect(bx * w + 10 + col * (bw * w - 20) / 6, by * h + 12 + r * (bh * h - 24) / 9, 12, 16);
      }
    }
  }
  const signs = [
    { x: 0.08, y: 0.16, w: 0.10, h: 0.30, c: '#ff2e88', t: 'HOTEL' },
    { x: 0.76, y: 0.12, w: 0.09, h: 0.34, c: '#00e5ff', t: 'BAR' },
    { x: 0.55, y: 0.22, w: 0.08, h: 0.22, c: '#3dff7a', t: '24H' },
  ];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const s of signs) {
    x.save(); x.shadowColor = s.c; x.shadowBlur = 34; x.fillStyle = s.c;
    x.fillRect(s.x * w, s.y * h, s.w * w, s.h * h);
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.font = `900 ${Math.round(s.w * w * 0.24)}px Arial, sans-serif`;
    x.fillText(s.t, (s.x + s.w / 2) * w, (s.y + s.h / 2) * h); x.restore();
  }
  const street = x.createLinearGradient(0, h * 0.72, 0, h);
  street.addColorStop(0, '#160b2e'); street.addColorStop(1, '#05030c');
  x.fillStyle = street; x.fillRect(0, h * 0.72, w, h * 0.28);
  x.globalAlpha = 0.28;
  for (const s of signs) {
    x.fillStyle = s.c; x.fillRect(s.x * w, h * 0.74, s.w * w, h * 0.16);
  }
  x.globalAlpha = 1;
  x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, h * 0.86); x.lineTo(w, h * 0.86); x.stroke();
  return c;
}

function drawRooftop(w, h) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h * 0.66);
  sky.addColorStop(0, '#3d2b63'); sky.addColorStop(0.5, '#b5659a'); sky.addColorStop(1, '#ff9e7d');
  x.fillStyle = sky; x.fillRect(0, 0, w, h * 0.66);
  x.fillStyle = '#ffe9b8'; x.beginPath(); x.arc(w * 0.30, h * 0.52, h * 0.10, 0, 7); x.fill();
  const rnd = mulberry32(42);
  x.fillStyle = '#4a2a5e';
  for (let i = 0; i < 12; i++) { const bw = 50 + rnd() * 100, bh = 40 + rnd() * 130; x.fillRect(i * (w / 12), h * 0.66 - bh, bw, bh); }
  x.fillStyle = '#241239';
  for (let i = 0; i < 8; i++) { const bw = 70 + rnd() * 110, bh = 20 + rnd() * 80; x.fillRect(i * (w / 8), h * 0.66 - bh, bw, bh); }
  x.fillStyle = '#160a26'; x.fillRect(0, h * 0.66, w, h * 0.34);
  drawPalm(x, w * 0.08, h * 0.70, h / 460, '#0e0618');
  drawPalm(x, w * 0.92, h * 0.70, h / 400, '#0e0618');
  x.strokeStyle = 'rgba(255,209,102,0.9)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(w * 0.12, h * 0.68); x.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.88, h * 0.68); x.stroke();
  x.fillStyle = '#ffd166';
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, px = w * (0.12 + 0.76 * t), py = h * (0.68 + 0.14 * 4 * t * (1 - t) * 1.9);
    x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill();
  }
  x.fillStyle = '#0e0618';
  const px = w * 0.68, py = h * 0.66;
  x.beginPath(); x.arc(px, py - h * 0.115, h * 0.032, 0, 7); x.fill();
  x.beginPath(); x.moveTo(px - h * 0.055, py); x.quadraticCurveTo(px - h * 0.06, py - h * 0.075, px, py - h * 0.08);
  x.quadraticCurveTo(px + h * 0.06, py - h * 0.075, px + h * 0.055, py); x.closePath(); x.fill();
  return c;
}
const SAMPLES = [
  { id: 'sample-boulevard', name: 'Sunset boulevard', draw: drawBoulevard },
  { id: 'sample-neon', name: 'Neon street', draw: drawNeonStreet },
  { id: 'sample-rooftop', name: 'Rooftop dusk', draw: drawRooftop },
];

/* ---------- grain pattern (made once) ---------- */
let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const n = makeCanvas(140, 140), nx = n.getContext('2d');
  const img = nx.createImageData(140, 140), rnd = mulberry32(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(rnd() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(n, 'repeat');
  return grainPattern;
}

/* ---------- cover rendering (shared by preview and export) ---------- */
function layoutRects(layout, W, H, gapPx) {
  const g = gapPx / Math.min(W, H);
  return LAYOUTS[layout](g).map(r => ({ x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H }));
}
function ensurePanels(n) {
  const first = state.photos[0] ? state.photos[0].id : null;
  while (state.panels.length < n) state.panels.push({ photo: first, s: 1, ox: 0, oy: 0 });
  state.panels.length = n;
  for (const p of state.panels) if (p.photo == null) p.photo = first;
}
function photoById(id) { return state.photos.find(p => p.id === id) || state.photos[0]; }
function coverSrc(photo, rect, t) {
  const pw = photo.w, ph = photo.h;
  let sw, sh;
  if (pw / ph > rect.w / rect.h) { sh = ph; sw = ph * rect.w / rect.h; }
  else { sw = pw; sh = pw * rect.h / rect.w; }
  sw /= t.s; sh /= t.s;
  const sx = clamp((pw - sw) / 2 - t.ox * (pw - sw) / 2, 0, Math.max(0, pw - sw));
  const sy = clamp((ph - sh) / 2 - t.oy * (ph - sh) / 2, 0, Math.max(0, ph - sh));
  return { sx, sy, sw, sh };
}
function renderCover(ctx, W, H) {
  const grade = GRADES.find(g => g.id === state.grade) || GRADES[0];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = state.frame ? '#f5f1e8' : '#0a0514';
  ctx.fillRect(0, 0, W, H);
  const frame = state.frame ? Math.round(Math.min(W, H) * 0.022) : 0;
  const gapPx = state.gap * (W / 1080);
  const rects = layoutRects(state.layout, W - 2 * frame, H - 2 * frame, gapPx)
    .map(r => ({ x: r.x + frame, y: r.y + frame, w: r.w, h: r.h }));
  ensurePanels(rects.length);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i], t = state.panels[i], photo = photoById(t.photo);
    if (!photo) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.filter = grade.filter;
    const s = coverSrc(photo, r, t);
    ctx.drawImage(photo.img, s.sx, s.sy, s.sw, s.sh, r.x, r.y, r.w, r.h);
    ctx.restore();
    ctx.filter = 'none';
    if (i === state.selected) {
      ctx.save(); ctx.strokeStyle = 'rgba(0,229,255,0.9)'; ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.restore();
    }
  }
  // grade overlay over the panel area
  const og = ctx.createLinearGradient(0, frame, 0, H - frame);
  og.addColorStop(0, grade.c1); og.addColorStop(1, grade.c2);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend; ctx.globalAlpha = grade.alpha;
  ctx.fillStyle = og; ctx.fillRect(frame, frame, W - 2 * frame, H - 2 * frame);
  ctx.restore();
  // grain
  if (state.grain > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = (state.grain / 100) * 0.45;
    ctx.fillStyle = getGrain(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // vignette
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  drawTitle(ctx, W, H);
  return rects;
}
function drawTitle(ctx, W, H) {
  const title = state.title.trim() || 'UNTITLED';
  const sub = state.subtitle.trim();
  const base = W / 1080;
  let size = state.titleSize * base;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  try { ctx.letterSpacing = `${Math.round(W * 0.008)}px`; } catch (e) {}
  const maxW = W * 0.92;
  while (ctx.measureText(title.toUpperCase()).width > maxW && size > 20) {
    size *= 0.92; ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  }
  const bottom = state.titlePos === 'bottom';
  const titleY = bottom ? H * 0.895 : H * 0.135;
  const subY = bottom ? H * 0.955 : H * 0.195;
  if (state.band) {
    const bg = ctx.createLinearGradient(0, bottom ? H * 0.70 : 0, 0, bottom ? H : H * 0.30);
    if (bottom) { bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.55)'); }
    else { bg.addColorStop(0, 'rgba(0,0,0,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); }
    ctx.fillStyle = bg; ctx.fillRect(0, bottom ? H * 0.70 : 0, W, H * 0.30);
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.04;
  ctx.lineWidth = Math.max(3, size * 0.09); ctx.strokeStyle = 'rgba(12,6,24,0.92)';
  ctx.lineJoin = 'round';
  ctx.strokeText(title.toUpperCase(), W / 2, titleY);
  ctx.fillStyle = state.titleColor;
  ctx.fillText(title.toUpperCase(), W / 2, titleY);
  ctx.restore();
  if (sub) {
    const subSize = Math.max(16, W * 0.038);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = subSize * 0.25;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(sub, W / 2, subY);
    ctx.restore();
  }
  try { ctx.letterSpacing = '0px'; } catch (e) {}
}

/* ---------- preview ---------- */
const preview = $('preview');
function render() {
  const [W, H] = SIZES[state.size];
  const scale = 860 / Math.max(W, H);
  preview.width = Math.round(W * scale);
  preview.height = Math.round(H * scale);
  const ctx = preview.getContext('2d');
  const rects = renderCover(ctx, preview.width, preview.height);
  preview._rects = rects;
  $('photoInfo').textContent = state.photos.length
    ? `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} · panel ${state.selected + 1}/${rects.length} selected · ${state.layout} · ${state.size}`
    : 'No photo yet — upload one or load a sample photo.';
  const sel = state.panels[state.selected];
  if (sel) $('zoomRange').value = Math.round(sel.s * 100);
}

/* ---------- photos ---------- */
function addPhoto(photo) {
  state.photos.push(photo);
  if (state.photos.length === 1) state.panels.forEach(p => { p.photo = photo.id; });
  rebuildThumbs(); render();
}
function loadSample(i) {
  const s = SAMPLES[i % SAMPLES.length];
  let existing = state.photos.find(p => p.id === s.id);
  if (existing) {
    state.panels[state.selected].photo = s.id; rebuildThumbs(); render(); return;
  }
  const img = s.draw(1200, 900);
  addPhoto({ id: s.id, name: s.name, img, w: 1200, h: 900 });
}
let sampleIdx = 0;
function rebuildThumbs() {
  const box = $('thumbs'); box.innerHTML = '';
  for (const p of state.photos) {
    const t = makeCanvas(72, 54), tx = t.getContext('2d');
    const s = coverSrc(p, { w: 72, h: 54 }, { s: 1, ox: 0, oy: 0 });
    tx.drawImage(p.img, s.sx, s.sy, s.sw, s.sh, 0, 0, 72, 54);
    t.title = p.name;
    const sel = state.panels[state.selected];
    if (sel && sel.photo === p.id) t.classList.add('sel');
    t.addEventListener('click', () => {
      state.panels[state.selected].photo = p.id; rebuildThumbs(); render();
    });
    box.appendChild(t);
  }
  const add = document.createElement('div');
  add.className = 'ph'; add.textContent = '+ add photo'; add.title = 'Upload a photo';
  add.addEventListener('click', () => $('fileInput').click());
  box.appendChild(add);
}
function handleFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      addPhoto({ id: 'up' + (++photoSeq), name: f.name, img, w: img.naturalWidth, h: img.naturalHeight });
      $('status').textContent = `Loaded ${f.name}`;
    };
    img.src = url;
  }
}

/* ---------- panel interaction: click to select, drag to pan, wheel to zoom ---------- */
let drag = null;
function canvasPos(e) {
  const r = preview.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (preview.width / r.width), y: (e.clientY - r.top) * (preview.height / r.height) };
}
function hitPanel(p) {
  const rects = preview._rects || [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}
preview.addEventListener('pointerdown', e => {
  const p = canvasPos(e), i = hitPanel(p);
  if (i < 0) return;
  state.selected = i;
  const t = state.panels[i], photo = photoById(t.photo), r = preview._rects[i];
  drag = { x0: p.x, y0: p.y, t, src: photo ? coverSrc(photo, r, t) : null, photo, rect: r };
  preview.classList.add('dragging'); preview.setPointerCapture(e.pointerId);
  rebuildThumbs(); render();
});
preview.addEventListener('pointermove', e => {
  if (!drag || !drag.photo) return;
  const p = canvasPos(e);
  const dx = p.x - drag.x0, dy = p.y - drag.y0;
  const { photo, rect, src, t } = drag;
  const sx = clamp(src.sx - dx * (src.sw / rect.w), 0, Math.max(0, photo.w - src.sw));
  const sy = clamp(src.sy - dy * (src.sh / rect.h), 0, Math.max(0, photo.h - src.sh));
  t.ox = photo.w - src.sw > 0 ? ((photo.w - src.sw) / 2 - sx) * 2 / (photo.w - src.sw) : 0;
  t.oy = photo.h - src.sh > 0 ? ((photo.h - src.sh) / 2 - sy) * 2 / (photo.h - src.sh) : 0;
  render();
});
preview.addEventListener('pointerup', () => { drag = null; preview.classList.remove('dragging'); });
preview.addEventListener('wheel', e => {
  e.preventDefault();
  const t = state.panels[state.selected];
  if (!t) return;
  t.s = clamp(t.s * Math.exp(-e.deltaY * 0.0012), 1, 3);
  render();
}, { passive: false });

/* ---------- controls ---------- */
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
$('sampleBtn').addEventListener('click', () => { loadSample(sampleIdx++); $('status').textContent = 'Sample photo loaded.'; });
const dz = $('dropZone');
['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

$('layoutRow').addEventListener('click', e => {
  const b = e.target.closest('button[data-layout]'); if (!b) return;
  state.layout = b.dataset.layout;
  document.querySelectorAll('#layoutRow button').forEach(x => x.classList.toggle('active', x === b));
  render();
});
const gradeRow = $('gradeRow');
for (const g of GRADES) {
  const sw = document.createElement('span');
  sw.className = 'sw' + (g.id === state.grade ? ' sel' : '');
  sw.title = g.label; sw.dataset.grade = g.id;
  sw.style.background = `linear-gradient(135deg, ${g.c1}, ${g.c2})`;
  sw.addEventListener('click', () => {
    state.grade = g.id; $('gradeHint').textContent = g.label + ' — ' + g.hint;
    gradeRow.querySelectorAll('.sw').forEach(x => x.classList.toggle('sel', x === sw));
    render();
  });
  gradeRow.appendChild(sw);
}
$('gradeHint').textContent = GRADES[0].label + ' — ' + GRADES[0].hint;
$('titleColors').addEventListener('click', e => {
  const sw = e.target.closest('.sw'); if (!sw) return;
  state.titleColor = sw.dataset.c;
  document.querySelectorAll('#titleColors .sw').forEach(x => x.classList.toggle('sel', x === sw));
  render();
});
$('titleInput').addEventListener('input', e => { state.title = e.target.value; render(); });
$('subInput').addEventListener('input', e => { state.subtitle = e.target.value; render(); });
$('titleSize').addEventListener('input', e => { state.titleSize = +e.target.value; render(); });
$('posTop').addEventListener('click', () => { state.titlePos = 'top'; $('posTop').classList.add('active'); $('posBottom').classList.remove('active'); render(); });
$('posBottom').addEventListener('click', () => { state.titlePos = 'bottom'; $('posBottom').classList.add('active'); $('posTop').classList.remove('active'); render(); });
$('bandChk').addEventListener('change', e => { state.band = e.target.checked; render(); });
$('frameChk').addEventListener('change', e => { state.frame = e.target.checked; render(); });
$('gapRange').addEventListener('input', e => { state.gap = +e.target.value; render(); });
$('grainRange').addEventListener('input', e => { state.grain = +e.target.value; render(); });
$('vigChk').addEventListener('change', e => { state.vignette = e.target.checked; render(); });
$('zoomRange').addEventListener('input', e => {
  const t = state.panels[state.selected]; if (!t) return;
  t.s = +e.target.value / 100; render();
});
$('resetCrop').addEventListener('click', () => {
  const t = state.panels[state.selected]; if (!t) return;
  t.s = 1; t.ox = 0; t.oy = 0; render();
});
$('shuffleBtn').addEventListener('click', () => {
  const layouts = Object.keys(LAYOUTS);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = GRADES[Math.floor(Math.random() * GRADES.length)].id;
  const colors = ['#ffffff', '#ffd166', '#ff2e88', '#00e5ff'];
  state.titleColor = colors[Math.floor(Math.random() * colors.length)];
  if (state.photos.length) {
    for (const p of state.panels) p.photo = state.photos[Math.floor(Math.random() * state.photos.length)].id;
  }
  document.querySelectorAll('#layoutRow button').forEach(x => x.classList.toggle('active', x.dataset.layout === state.layout));
  gradeRow.querySelectorAll('.sw').forEach(x => x.classList.toggle('sel', x.dataset.grade === state.grade));
  document.querySelectorAll('#titleColors .sw').forEach(x => x.classList.toggle('sel', x.dataset.c === state.titleColor));
  $('gradeHint').textContent = (GRADES.find(g => g.id === state.grade) || GRADES[0]).hint;
  rebuildThumbs(); render();
  $('status').textContent = 'Shuffled layout, grade and photos.';
});
$('sizeRow').addEventListener('click', e => {
  const b = e.target.closest('button[data-size]'); if (!b) return;
  state.size = b.dataset.size;
  document.querySelectorAll('#sizeRow button').forEach(x => x.classList.toggle('active', x === b));
  render();
});
$('exportBtn').addEventListener('click', () => {
  const [W, H] = SIZES[state.size];
  const off = makeCanvas(W, H);
  const keepSel = state.selected;
  state.selected = -1; // hide the selection outline on export
  renderCover(off.getContext('2d'), W, H);
  state.selected = keepSel; render();
  off.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `palm-heat-cover-${W}x${H}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('status').textContent = `Exported ${W}×${H} PNG — check your downloads.`;
  }, 'image/png');
});
$('exportAllBtn').addEventListener('click', async () => {
  const keepSel = state.selected;
  state.selected = -1;
  const done = [];
  for (const key of Object.keys(SIZES)) {
    const [W, H] = SIZES[key];
    const off = makeCanvas(W, H);
    renderCover(off.getContext('2d'), W, H);
    await new Promise(res => off.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `palm-heat-cover-${W}x${H}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      done.push(`${W}×${H}`);
      res();
    }, 'image/png'));
    await new Promise(r => setTimeout(r, 400));
  }
  state.selected = keepSel; render();
  $('status').textContent = `Exported all 3 sizes (${done.join(', ')}) — check your downloads.`;
});

/* ---------- init ---------- */
if (document.fonts && document.fonts.ready) {
  document.fonts.load('90px Anton').catch(() => {});
  document.fonts.load('40px Pacifico').catch(() => {});
  document.fonts.ready.then(() => render());
}
loadSample(0);
render();
