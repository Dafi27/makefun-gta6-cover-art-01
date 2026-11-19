/* Palm Heat Cover Lab — offline GTA-style cover art maker.
   Everything is drawn on canvas with the app's own art: no external
   images, no network requests, no Rockstar artwork or fonts. */

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');

const LAYOUTS = [
  { id: 'hero', name: 'Hero + 3', panels: 4 },
  { id: 'grid', name: 'Four Square', panels: 4 },
  { id: 'duo', name: 'Split Duo', panels: 2 },
  { id: 'triptych', name: 'Triptych', panels: 3 },
];
const GRADES = [
  { id: 'vice', name: 'Vice Sunset', dot: '#ff5e8a', top: 'rgba(255,126,61,0.16)', mid: 'rgba(255,45,120,0.24)', bot: 'rgba(123,47,247,0.30)' },
  { id: 'neon', name: 'Neon Nights', dot: '#2de2c5', top: 'rgba(0,240,255,0.14)', mid: 'rgba(255,42,213,0.22)', bot: 'rgba(10,10,60,0.34)' },
  { id: 'gold', name: 'Palm Gold', dot: '#ffb347', top: 'rgba(255,215,106,0.18)', mid: 'rgba(255,138,61,0.20)', bot: 'rgba(120,60,10,0.26)' },
  { id: 'teal', name: 'Teal Noir', dot: '#2de2c5', top: 'rgba(0,229,192,0.14)', mid: 'rgba(0,120,255,0.20)', bot: 'rgba(0,20,60,0.36)' },
  { id: 'mono', name: 'Mono Heat', dot: '#dddddd', top: 'rgba(255,255,255,0.05)', mid: 'rgba(255,255,255,0.05)', bot: 'rgba(0,0,0,0.18)' },
];
const SCENES = [
  { id: 'boulevard', name: 'Boulevard Sunset' },
  { id: 'neon', name: 'Neon Street' },
  { id: 'pier', name: 'Pier Day' },
];
const EXPORT_SIZES = ['1080x1080', '1080x1350', '1920x1080'];

const state = {
  layout: 'hero',
  grade: 'vice',
  title: 'PALM HEAT',
  subtitle: 'Neon nights in Leonida',
  badge: 'LEONIDA • 2026',
  selected: 0,
  photos: [], // {img, name}
  panels: [
    { fill: { kind: 'scene', name: 'boulevard' }, zoom: 1, ox: 0, oy: 0 },
    { fill: { kind: 'scene', name: 'neon' }, zoom: 1, ox: 0, oy: 0 },
    { fill: { kind: 'scene', name: 'pier' }, zoom: 1, ox: 0, oy: 0 },
    { fill: { kind: 'scene', name: 'boulevard' }, zoom: 1, ox: 0, oy: 0 },
  ],
};

/* ---------- deterministic helper ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- procedural sample scenes (original art) ---------- */
function drawPalm(c, x, y, h, lean, color) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = Math.max(2, h * 0.03);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * h * 0.3, y - h * 0.55, x + lean * h * 0.55, y - h);
  c.stroke();
  const topX = x + lean * h * 0.55, topY = y - h;
  c.lineWidth = Math.max(1.5, h * 0.018);
  for (let i = 0; i < 7; i++) {
    const ang = (-0.15 - i * 0.22) * Math.PI + (lean > 0 ? 0.25 : -0.25);
    c.beginPath();
    c.moveTo(topX, topY);
    c.quadraticCurveTo(
      topX + Math.cos(ang) * h * 0.28, topY + Math.sin(ang) * h * 0.28 - h * 0.06,
      topX + Math.cos(ang) * h * 0.52, topY + Math.sin(ang) * h * 0.52 + h * 0.16);
    c.stroke();
  }
  c.restore();
}

function drawBoulevard(c, x, y, w, h) {
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#2b1a4d'); sky.addColorStop(0.45, '#c94b7c');
  sky.addColorStop(0.75, '#ff7e3d'); sky.addColorStop(1, '#ffb347');
  c.fillStyle = sky; c.fillRect(x, y, w, h);
  // sun
  c.save();
  c.shadowColor = '#ffd76a'; c.shadowBlur = w * 0.12;
  c.fillStyle = '#ffe9a3';
  c.beginPath(); c.arc(x + w * 0.66, y + h * 0.4, w * 0.13, 0, Math.PI * 2); c.fill();
  c.restore();
  // skyline
  c.fillStyle = '#3a1c56';
  const rand = mulberry32(7);
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.08 + rand() * 0.1), bh = h * (0.14 + rand() * 0.22);
    c.fillRect(bx, y + h * 0.62 - bh, bw, bh);
    bx += bw + w * 0.02;
  }
  // road
  c.fillStyle = '#1c1030';
  c.beginPath();
  c.moveTo(x, y + h); c.lineTo(x + w, y + h);
  c.lineTo(x + w * 0.72, y + h * 0.62); c.lineTo(x + w * 0.28, y + h * 0.62);
  c.closePath(); c.fill();
  c.strokeStyle = '#ffd76a'; c.lineWidth = Math.max(2, w * 0.008);
  c.setLineDash([w * 0.05, w * 0.04]);
  c.beginPath(); c.moveTo(x + w * 0.5, y + h * 0.64); c.lineTo(x + w * 0.5, y + h); c.stroke();
  c.setLineDash([]);
  // palms
  drawPalm(c, x + w * 0.16, y + h * 0.98, h * 0.5, -1, '#160a26');
  drawPalm(c, x + w * 0.88, y + h * 0.98, h * 0.44, 1, '#160a26');
}

function drawNeonStreet(c, x, y, w, h) {
  const bg = c.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#050510'); bg.addColorStop(0.6, '#12082e'); bg.addColorStop(1, '#0a0618');
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  // buildings with lit windows
  const rand = mulberry32(21);
  c.fillStyle = '#0d0a1e';
  c.fillRect(x, y + h * 0.1, w * 0.3, h * 0.6);
  c.fillRect(x + w * 0.7, y + h * 0.05, w * 0.3, h * 0.65);
  for (let r = 0; r < 5; r++) {
    for (let col = 0; col < 3; col++) {
      if (rand() < 0.55) {
        c.fillStyle = rand() < 0.5 ? 'rgba(255,42,213,0.85)' : 'rgba(0,240,255,0.85)';
        c.fillRect(x + w * (0.04 + col * 0.09), y + h * (0.16 + r * 0.1), w * 0.05, h * 0.05);
      }
    }
    for (let col = 0; col < 3; col++) {
      if (rand() < 0.55) {
        c.fillStyle = rand() < 0.5 ? 'rgba(255,42,213,0.85)' : 'rgba(0,240,255,0.85)';
        c.fillRect(x + w * (0.74 + col * 0.09), y + h * (0.12 + r * 0.1), w * 0.05, h * 0.05);
      }
    }
  }
  // neon signs
  const signs = [
    { sx: 0.36, sy: 0.18, sw: 0.28, sh: 0.1, color: '#ff2ad5', glow: '#ff2ad5' },
    { sx: 0.4, sy: 0.36, sw: 0.2, sh: 0.08, color: '#00f0ff', glow: '#00f0ff' },
    { sx: 0.38, sy: 0.52, sw: 0.24, sh: 0.07, color: '#ffd76a', glow: '#ffb347' },
  ];
  for (const s of signs) {
    c.save();
    c.shadowColor = s.glow; c.shadowBlur = w * 0.06;
    c.fillStyle = s.color;
    roundRect(c, x + w * s.sx, y + h * s.sy, w * s.sw, h * s.sh, w * 0.02);
    c.fill();
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillRect(x + w * (s.sx + 0.03), y + h * (s.sy + s.sh * 0.32), w * s.sw * 0.62, h * s.sh * 0.36);
  }
  // wet pavement reflections
  const wet = c.createLinearGradient(x, y + h * 0.7, x, y + h);
  wet.addColorStop(0, 'rgba(255,42,213,0.20)'); wet.addColorStop(1, 'rgba(0,240,255,0.12)');
  c.fillStyle = wet; c.fillRect(x, y + h * 0.7, w, h * 0.3);
  c.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 6; i++) {
    c.fillRect(x + w * (0.1 + i * 0.14), y + h * (0.74 + (i % 3) * 0.07), w * 0.08, h * 0.012);
  }
}

function drawPier(c, x, y, w, h) {
  const sky = c.createLinearGradient(x, y, x, y + h * 0.55);
  sky.addColorStop(0, '#8fd0f5'); sky.addColorStop(1, '#e8f6ff');
  c.fillStyle = sky; c.fillRect(x, y, w, h * 0.55);
  // sun + clouds
  c.fillStyle = '#fff3c4';
  c.beginPath(); c.arc(x + w * 0.78, y + h * 0.14, w * 0.09, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, cw] of [[0.2, 0.12, 0.22], [0.55, 0.08, 0.18], [0.42, 0.22, 0.26]]) {
    c.beginPath(); c.ellipse(x + w * cx, y + h * cy, w * cw, h * 0.035, 0, 0, Math.PI * 2); c.fill();
  }
  // sea
  const sea = c.createLinearGradient(x, y + h * 0.55, x, y + h);
  sea.addColorStop(0, '#2fc4b2'); sea.addColorStop(1, '#0b5f7d');
  c.fillStyle = sea; c.fillRect(x, y + h * 0.55, w, h * 0.45);
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(1.5, w * 0.004);
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(x + w * (0.05 + i * 0.05), y + h * (0.6 + i * 0.07));
    c.quadraticCurveTo(x + w * 0.5, y + h * (0.58 + i * 0.07), x + w * 0.95, y + h * (0.62 + i * 0.07));
    c.stroke();
  }
  // pier planks, perspective from bottom centre
  c.fillStyle = '#7a5230';
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const pw = w * (0.16 + t * 0.5);
    const py = y + h * (0.62 + t * 0.36);
    c.fillRect(x + (w - pw) / 2, py, pw, h * 0.035);
  }
  c.fillStyle = '#5d3d22';
  c.fillRect(x + w * 0.47, y + h * 0.62, w * 0.015, h * 0.36);
  c.fillRect(x + w * 0.515, y + h * 0.62, w * 0.015, h * 0.36);
  // fishing rod
  c.strokeStyle = '#2b1c10'; c.lineWidth = Math.max(2, w * 0.006);
  c.beginPath(); c.moveTo(x + w * 0.82, y + h * 0.6); c.lineTo(x + w * 0.6, y + h * 0.86); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x + w * 0.6, y + h * 0.86); c.lineTo(x + w * 0.58, y + h * 0.95); c.stroke();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ---------- layouts ---------- */
function layoutRects(id, W, H) {
  if (id === 'grid') {
    return [
      [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
    ].map(([fx, fy, fw, fh]) => ({ x: W * fx, y: H * fy, w: W * fw, h: H * fh }));
  }
  if (id === 'duo') {
    return [
      { x: 0, y: 0, w: W * 0.5, h: H },
      { x: W * 0.5, y: 0, w: W * 0.5, h: H },
    ];
  }
  if (id === 'triptych') {
    return [0, 1, 2].map(i => ({ x: (W * i) / 3, y: 0, w: W / 3, h: H }));
  }
  // hero: big panel left, three stacked right
  return [
    { x: 0, y: 0, w: W * 0.62, h: H },
    { x: W * 0.62, y: 0, w: W * 0.38, h: H / 3 },
    { x: W * 0.62, y: H / 3, w: W * 0.38, h: H / 3 },
    { x: W * 0.62, y: (H * 2) / 3, w: W * 0.38, h: H / 3 },
  ];
}

function drawScene(c, name, x, y, w, h) {
  if (name === 'neon') drawNeonStreet(c, x, y, w, h);
  else if (name === 'pier') drawPier(c, x, y, w, h);
  else drawBoulevard(c, x, y, w, h);
}

function drawPanel(c, panel, rect, mono) {
  const gap = Math.max(3, rect.w * 0.012);
  const r = { x: rect.x + gap / 2, y: rect.y + gap / 2, w: rect.w - gap, h: rect.h - gap };
  c.save();
  c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
  if (mono) c.filter = 'grayscale(1) contrast(1.12) brightness(1.04)';
  const fill = panel.fill;
  if (fill.kind === 'scene') {
    drawScene(c, fill.name, r.x, r.y, r.w, r.h);
  } else {
    const photo = state.photos[fill.idx];
    if (photo && photo.img.naturalWidth) {
      const iw = photo.img.naturalWidth, ih = photo.img.naturalHeight;
      const scale = Math.max(r.w / iw, r.h / ih) * panel.zoom;
      const dw = iw * scale, dh = ih * scale;
      const dx = r.x + (r.w - dw) / 2 + (panel.ox / 100) * r.w * 0.3;
      const dy = r.y + (r.h - dh) / 2 + (panel.oy / 100) * r.h * 0.3;
      c.drawImage(photo.img, dx, dy, dw, dh);
    } else {
      drawScene(c, 'boulevard', r.x, r.y, r.w, r.h);
    }
  }
  c.filter = 'none';
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = Math.max(2, gap / 2);
  c.strokeRect(r.x, r.y, r.w, r.h);
}

/* ---------- the cover render ---------- */
function drawCover(c, W, H) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#0d0a12';
  c.fillRect(0, 0, W, H);
  const layout = LAYOUTS.find(l => l.id === state.layout);
  const grade = GRADES.find(g => g.id === state.grade);
  const rects = layoutRects(state.layout, W, H);
  const mono = state.grade === 'mono';
  for (let i = 0; i < layout.panels; i++) {
    drawPanel(c, state.panels[i], rects[i], mono);
  }
  // grade overlay
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, grade.top); g.addColorStop(0.55, grade.mid); g.addColorStop(1, grade.bot);
  c.save();
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.restore();
  // vignette
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.34)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
  // title band
  const bandH = H * 0.24;
  const bg = c.createLinearGradient(0, H - bandH, 0, H);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.78)');
  c.fillStyle = bg; c.fillRect(0, H - bandH, W, bandH);
  // badge pill, top right
  const badge = state.badge.trim();
  if (badge) {
    c.font = `600 ${Math.round(H * 0.028)}px system-ui, sans-serif`;
    const bw = c.measureText(badge).width + W * 0.05;
    const bh = H * 0.052;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(c, W - bw - W * 0.03, H * 0.03, bw, bh, bh / 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(1, H * 0.0015);
    roundRect(c, W - bw - W * 0.03, H * 0.03, bw, bh, bh / 2); c.stroke();
    c.fillStyle = '#ffe9a3';
    c.textBaseline = 'middle';
    c.fillText(badge, W - bw - W * 0.03 + W * 0.025, H * 0.03 + bh / 2 + 1);
  }
  // title + subtitle
  const title = (state.title.trim() || 'PALM HEAT').toUpperCase();
  const titlePx = Math.round(H * 0.104);
  c.font = `${titlePx}px Anton, sans-serif`;
  try { c.letterSpacing = `${Math.round(H * 0.004)}px`; } catch (e) { /* older canvas */ }
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(0,0,0,0.85)';
  c.lineWidth = Math.max(3, titlePx / 14);
  c.strokeText(title, W * 0.045, H - H * 0.085);
  const tg = c.createLinearGradient(0, H - H * 0.19, 0, H - H * 0.07);
  tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ffd76a');
  c.fillStyle = tg;
  c.fillText(title, W * 0.045, H - H * 0.085);
  try { c.letterSpacing = '0px'; } catch (e) { /* older canvas */ }
  const sub = state.subtitle.trim();
  if (sub) {
    const subPx = Math.round(H * 0.042);
    c.font = `${subPx}px Pacifico, cursive`;
    c.fillStyle = '#2de2c5';
    c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = Math.round(H * 0.008);
    c.fillText(sub, W * 0.05, H - H * 0.028);
    c.shadowBlur = 0;
  }
}

function render() {
  drawCover(ctx, canvas.width, canvas.height);
}

/* ---------- export ---------- */
async function exportCover(size) {
  const [w, h] = size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off.getContext('2d'), w, h);
  const blob = await new Promise(res => off.toBlob(res, 'image/png'));
  window.coverLab.lastExport = { size, width: w, height: h, blob };
  return blob;
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function exportAndDownload(size) {
  const blob = await exportCover(size);
  download(blob, `palm-heat-cover-${size}.png`);
  setStatus(`Exported ${size} PNG.`);
}
async function exportAll() {
  for (const size of EXPORT_SIZES) {
    await exportAndDownload(size);
    await new Promise(r => setTimeout(r, 350));
  }
}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const statusLine = $('statusLine');
function setStatus(msg) { statusLine.textContent = msg; }

function buildChips(container, items, activeId, onPick, dotKey) {
  container.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (item.id === activeId ? ' active' : '');
    if (dotKey) {
      const dot = document.createElement('span');
      dot.className = 'grade-dot';
      dot.style.background = item[dotKey];
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(item.name));
    b.addEventListener('click', () => { onPick(item.id); render(); refreshControls(); });
    container.appendChild(b);
  }
}

function refreshControls() {
  buildChips($('layoutRow'), LAYOUTS, state.layout, id => { state.layout = id; });
  buildChips($('gradeRow'), GRADES, state.grade, id => { state.grade = id; }, 'dot');
  const layout = LAYOUTS.find(l => l.id === state.layout);
  const strip = $('panelStrip');
  strip.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-chip' + (i === state.selected ? ' active' : '');
    b.textContent = `Panel ${i + 1}` + (i >= layout.panels ? ' (off)' : '');
    b.disabled = i >= layout.panels;
    b.addEventListener('click', () => { state.selected = i; refreshControls(); render(); });
    strip.appendChild(b);
  }
  const panel = state.panels[state.selected];
  $('panelName').textContent = `Panel ${state.selected + 1} — ${panel.fill.kind === 'scene'
    ? SCENES.find(s => s.id === panel.fill.name).name
    : 'Photo ' + (panel.fill.idx + 1)}`;
  const fillSel = $('panelFill');
  fillSel.innerHTML = '';
  for (const s of SCENES) {
    const o = document.createElement('option');
    o.value = 'scene:' + s.id;
    o.textContent = 'Scene: ' + s.name;
    fillSel.appendChild(o);
  }
  state.photos.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = 'photo:' + i;
    o.textContent = 'Photo ' + (i + 1) + ': ' + p.name;
    fillSel.appendChild(o);
  });
  fillSel.value = panel.fill.kind === 'scene' ? 'scene:' + panel.fill.name : 'photo:' + panel.fill.idx;
  $('zoomRange').value = Math.round(panel.zoom * 100);
  $('zoomVal').textContent = Math.round(panel.zoom * 100) + '%';
  $('panXRange').value = panel.ox;
  $('panXVal').textContent = panel.ox;
  $('panYRange').value = panel.oy;
  $('panYVal').textContent = panel.oy;
}

function buildSceneRow() {
  const row = $('sceneRow');
  for (const s of SCENES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'scene-btn';
    b.textContent = '＋ ' + s.name;
    b.addEventListener('click', () => {
      state.panels[state.selected].fill = { kind: 'scene', name: s.id };
      render(); refreshControls();
      setStatus(`Panel ${state.selected + 1} now shows ${s.name}.`);
    });
    row.appendChild(b);
  }
}

function refreshThumbs() {
  const row = $('thumbRow');
  row.innerHTML = '';
  state.photos.forEach((p, i) => {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = URL.createObjectURL(p.file);
    img.alt = p.name;
    img.title = 'Click to put on the selected panel';
    img.addEventListener('click', () => {
      state.panels[state.selected].fill = { kind: 'photo', idx: i };
      render(); refreshControls();
      setStatus(`Photo ${i + 1} placed on panel ${state.selected + 1}.`);
    });
    row.appendChild(img);
  });
}

async function addPhotos(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
    state.photos.push({ img, file, name: file.name });
    added++;
  }
  if (added) {
    state.panels[state.selected].fill = { kind: 'photo', idx: state.photos.length - added };
    refreshThumbs(); render(); refreshControls();
    setStatus(`${added} photo${added > 1 ? 's' : ''} loaded — placed on panel ${state.selected + 1}.`);
  }
}

function bind() {
  $('upload').addEventListener('change', e => addPhotos([...e.target.files]));
  $('clearPhotos').addEventListener('click', () => {
    state.photos = [];
    state.panels.forEach(p => { if (p.fill.kind === 'photo') p.fill = { kind: 'scene', name: 'boulevard' }; });
    refreshThumbs(); render(); refreshControls();
    setStatus('Photos cleared — panels back to sample scenes.');
  });
  $('titleInput').addEventListener('input', e => { state.title = e.target.value; render(); });
  $('subtitleInput').addEventListener('input', e => { state.subtitle = e.target.value; render(); });
  $('badgeInput').addEventListener('input', e => { state.badge = e.target.value; render(); });
  $('panelFill').addEventListener('change', e => {
    const [kind, val] = e.target.value.split(':');
    state.panels[state.selected].fill = kind === 'scene'
      ? { kind: 'scene', name: val }
      : { kind: 'photo', idx: Number(val) };
    render(); refreshControls();
  });
  $('zoomRange').addEventListener('input', e => {
    state.panels[state.selected].zoom = Number(e.target.value) / 100;
    $('zoomVal').textContent = e.target.value + '%';
    render();
  });
  $('panXRange').addEventListener('input', e => {
    state.panels[state.selected].ox = Number(e.target.value);
    $('panXVal').textContent = e.target.value;
    render();
  });
  $('panYRange').addEventListener('input', e => {
    state.panels[state.selected].oy = Number(e.target.value);
    $('panYVal').textContent = e.target.value;
    render();
  });
  document.querySelectorAll('[data-size]').forEach(b => {
    b.addEventListener('click', () => exportAndDownload(b.dataset.size));
  });
  $('exportAll').addEventListener('click', exportAll);
  // Clicking the preview selects the panel under the click, so the
  // panel controls always edit the panel you are looking at.
  canvas.addEventListener('click', e => {
    const box = canvas.getBoundingClientRect();
    const x = (e.clientX - box.left) * (canvas.width / box.width);
    const y = (e.clientY - box.top) * (canvas.height / box.height);
    const layout = LAYOUTS.find(l => l.id === state.layout);
    const rects = layoutRects(state.layout, canvas.width, canvas.height);
    for (let i = 0; i < layout.panels; i++) {
      const r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        if (state.selected !== i) {
          state.selected = i;
          refreshControls();
          setStatus(`Panel ${i + 1} selected — adjust its fill, zoom and pan.`);
        }
        break;
      }
    }
  });
}

/* ---------- test hook for the maker ---------- */
window.coverLab = {
  state,
  exportCover,
  render,
  lastExport: null,
};

buildSceneRow();
bind();
refreshControls();
render();
if (document.fonts && document.fonts.ready) {
  Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).catch(() => {}).finally(() => render());
  document.fonts.ready.then(() => render());
}
