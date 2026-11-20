/* Palm Heat Cover Lab — GTA VI style cover maker.
   Everything is drawn on canvas from the photos on this machine.
   No network requests: fonts are local files, photos never leave the browser. */
(function () {
  "use strict";

  var PREVIEW_SIZES = {
    square: { w: 900, h: 900, label: "Square 1:1" },
    portrait: { w: 800, h: 1000, label: "Portrait 4:5" },
    wide: { w: 960, h: 540, label: "Wide 16:9" }
  };

  var EXPORT_SIZES = {
    "1080x1080": { w: 1080, h: 1080 },
    "1080x1350": { w: 1080, h: 1350 },
    "1920x1080": { w: 1920, h: 1080 }
  };

  var LAYOUTS = {
    hero: {
      desc: "One big hero panel over three small ones — the classic poster.",
      rects: [
        { x: 0, y: 0, w: 1, h: 0.58 },
        { x: 0, y: 0.58, w: 1 / 3, h: 0.42 },
        { x: 1 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
        { x: 2 / 3, y: 0.58, w: 1 / 3, h: 0.42 }
      ]
    },
    quad: {
      desc: "Four equal panels — one photo in each, or one photo across all four.",
      rects: [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
      ]
    },
    bleed: {
      desc: "One photo edge to edge, lettered like a loading screen.",
      rects: [{ x: 0, y: 0, w: 1, h: 1 }]
    }
  };

  var GRADES = {
    sunset: { desc: "Warm orange and pink, straight off the boulevard at dusk." },
    neon: { desc: "Pink and teal neon after dark, wet pavement glow." },
    gold: { desc: "Golden hour light, soft and warm all over." },
    noir: { desc: "High-contrast black and white, hard shadows." }
  };

  var SLOT_NAMES = ["Panel 1", "Panel 2", "Panel 3", "Panel 4"];

  var state = {
    layout: "hero",
    grade: "sunset",
    previewSize: "square",
    title: "NEON SHORE",
    subtitle: "welcome to vice city",
    badge: "LEONIDA",
    panels: [
      { img: null, scale: 1, ox: 0, oy: 0 },
      { img: null, scale: 1, ox: 0, oy: 0 },
      { img: null, scale: 1, ox: 0, oy: 0 },
      { img: null, scale: 1, ox: 0, oy: 0 }
    ]
  };

  var canvas = document.getElementById("cover");
  var ctx = canvas.getContext("2d");
  var activePanel = 0;
  var dragging = null;

  /* ---------- seeded random (deterministic grain) ---------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- demo photo: a procedural Vice City sunset ---------- */
  function makeDemoPhoto() {
    var W = 1200, H = 900;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");

    var sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2b1055");
    sky.addColorStop(0.35, "#ff2e88");
    sky.addColorStop(0.62, "#ff7a18");
    sky.addColorStop(0.8, "#ffc53d");
    sky.addColorStop(1, "#ffe9a8");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // Sun with halo
    var sunX = W * 0.68, sunY = H * 0.52, sunR = 130;
    var halo = g.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunR * 2.4);
    halo.addColorStop(0, "rgba(255, 240, 180, 0.95)");
    halo.addColorStop(0.4, "rgba(255, 170, 90, 0.45)");
    halo.addColorStop(1, "rgba(255, 120, 60, 0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff3c4";
    g.beginPath(); g.arc(sunX, sunY, sunR, 0, Math.PI * 2); g.fill();

    // Clouds
    g.fillStyle = "rgba(255, 190, 220, 0.35)";
    var clouds = [[180, 150, 220, 34], [520, 110, 260, 28], [900, 190, 240, 30], [340, 250, 180, 24], [760, 300, 200, 26]];
    clouds.forEach(function (cl) {
      g.beginPath(); g.ellipse(cl[0], cl[1], cl[2], cl[3], 0, 0, Math.PI * 2); g.fill();
    });

    // Skyline
    g.fillStyle = "#1c0b2e";
    var buildings = [
      [0, 470, 120, 180], [110, 420, 90, 230], [200, 490, 140, 160],
      [330, 400, 100, 250], [430, 460, 150, 190], [580, 410, 110, 240],
      [690, 470, 130, 180], [820, 430, 100, 220], [920, 480, 140, 170], [1060, 440, 140, 210]
    ];
    buildings.forEach(function (b) { g.fillRect(b[0], b[1], b[2], b[3]); });
    // Lit windows
    g.fillStyle = "rgba(255, 210, 110, 0.9)";
    var rnd = mulberry32(20261119);
    buildings.forEach(function (b) {
      for (var wy = b[1] + 18; wy < b[1] + b[3] - 14; wy += 26) {
        for (var wx = b[0] + 12; wx < b[0] + b[2] - 12; wx += 24) {
          if (rnd() < 0.42) g.fillRect(wx, wy, 9, 12);
        }
      }
    });

    // Street / water foreground
    var fg = g.createLinearGradient(0, H * 0.72, 0, H);
    fg.addColorStop(0, "#ff7a18");
    fg.addColorStop(0.35, "#c22a72");
    fg.addColorStop(1, "#160a24");
    g.fillStyle = fg;
    g.fillRect(0, H * 0.72, W, H * 0.28);
    // Sun reflection streaks
    g.fillStyle = "rgba(255, 240, 180, 0.35)";
    for (var i = 0; i < 9; i++) {
      var ry = H * 0.74 + i * 18;
      var rw = 260 - i * 22;
      g.fillRect(sunX - rw / 2, ry, rw, 5);
    }

    // Palm silhouettes
    function palm(px, py, s, lean) {
      g.save();
      g.translate(px, py);
      g.scale(s, s);
      g.rotate(lean);
      g.strokeStyle = "#12081f";
      g.lineWidth = 13;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -90, 4, -170); g.stroke();
      g.lineWidth = 7;
      for (var f = 0; f < 7; f++) {
        var ang = -Math.PI * 0.92 + (f / 6) * Math.PI * 0.84;
        var fx = Math.cos(ang) * 95, fy = -170 + Math.sin(ang) * 55;
        g.beginPath(); g.moveTo(4, -170);
        g.quadraticCurveTo(4 + fx * 0.55, -170 + fy * 0.7 - 26, 4 + fx, -170 + fy);
        g.stroke();
      }
      g.restore();
    }
    palm(150, H * 0.98, 1.15, -0.1);
    palm(1030, H * 0.99, 1.3, 0.12);
    palm(880, H * 0.97, 0.8, -0.16);

    // Birds
    g.strokeStyle = "rgba(30, 10, 40, 0.85)";
    g.lineWidth = 4;
    [[300, 180], [360, 150], [420, 195], [700, 130]].forEach(function (bp) {
      g.beginPath();
      g.moveTo(bp[0] - 14, bp[1]); g.quadraticCurveTo(bp[0] - 5, bp[1] - 9, bp[0], bp[1]);
      g.quadraticCurveTo(bp[0] + 5, bp[1] - 9, bp[0] + 14, bp[1]);
      g.stroke();
    });

    var img = new Image();
    img.src = c.toDataURL("image/png");
    return img;
  }

  var demoPhoto = makeDemoPhoto();

  /* ---------- photo drawing ---------- */
  function drawPhotoInPanel(g, panel, rect, W, H) {
    var img = panel.img;
    if (!img || !img.complete || !img.naturalWidth) return false;
    var rx = rect.x * W, ry = rect.y * H, rw = rect.w * W, rh = rect.h * H;
    g.save();
    g.beginPath(); g.rect(rx, ry, rw, rh); g.clip();
    var base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight) * panel.scale;
    var dw = img.naturalWidth * base, dh = img.naturalHeight * base;
    var dx = rx + (rw - dw) / 2 + panel.ox;
    var dy = ry + (rh - dh) / 2 + panel.oy;
    if (state.grade === "noir") g.filter = "grayscale(1) contrast(1.25) brightness(1.05)";
    g.drawImage(img, dx, dy, dw, dh);
    g.filter = "none";
    g.restore();
    return true;
  }

  function gradeOverlay(g, W, H) {
    var grad;
    if (state.grade === "sunset") {
      grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(255, 122, 24, 0.10)");
      grad.addColorStop(0.55, "rgba(255, 46, 136, 0.12)");
      grad.addColorStop(1, "rgba(43, 16, 85, 0.20)");
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255, 170, 60, 0.05)";
      g.fillRect(0, 0, W, H);
    } else if (state.grade === "neon") {
      grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "rgba(255, 46, 136, 0.16)");
      grad.addColorStop(0.5, "rgba(120, 40, 180, 0.10)");
      grad.addColorStop(1, "rgba(25, 227, 208, 0.14)");
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    } else if (state.grade === "gold") {
      grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(255, 197, 61, 0.14)");
      grad.addColorStop(1, "rgba(255, 122, 24, 0.16)");
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    } else if (state.grade === "noir") {
      grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.06)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
  }

  function addGrain(g, W, H) {
    var rnd = mulberry32(1337);
    g.save();
    g.globalAlpha = 0.05;
    g.fillStyle = "#ffffff";
    var n = Math.floor((W * H) / 2600);
    for (var i = 0; i < n; i++) {
      g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
    }
    g.restore();
  }

  function addVignette(g, W, H) {
    var v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(10, 4, 18, 0.42)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }

  function drawLettering(g, W, H) {
    var bandH = H * 0.155;
    var band = g.createLinearGradient(0, H - bandH * 1.7, 0, H);
    band.addColorStop(0, "rgba(12, 5, 22, 0)");
    band.addColorStop(1, "rgba(12, 5, 22, 0.92)");
    g.fillStyle = band;
    g.fillRect(0, H - bandH * 1.7, W, bandH * 1.7);

    // Badge pill, top right
    var badge = (state.badge || "").toUpperCase();
    if (badge) {
      g.font = Math.round(H * 0.028) + 'px Anton, sans-serif';
      var bw = g.measureText(badge).width + H * 0.036;
      var bx = W - bw - H * 0.028, by = H * 0.026, bh = H * 0.052;
      g.fillStyle = "#ff2e88";
      g.beginPath();
      g.roundRect(bx, by, bw, bh, bh / 2);
      g.fill();
      g.fillStyle = "#fff";
      g.textBaseline = "middle";
      g.fillText(badge, bx + H * 0.018, by + bh / 2 + H * 0.002);
    }

    // Title
    var title = (state.title || "UNTITLED").toUpperCase();
    var titleSize = H * 0.085;
    g.font = titleSize + 'px Anton, sans-serif';
    var maxW = W * 0.92;
    while (g.measureText(title).width > maxW && titleSize > H * 0.03) {
      titleSize *= 0.92;
      g.font = titleSize + 'px Anton, sans-serif';
    }
    var tx = W * 0.04, ty = H - H * 0.075;
    g.textBaseline = "alphabetic";
    g.lineJoin = "round";
    g.lineWidth = titleSize * 0.14;
    g.strokeStyle = "rgba(12, 5, 22, 0.9)";
    g.strokeText(title, tx, ty);
    var tfill = g.createLinearGradient(0, ty - titleSize, 0, ty);
    tfill.addColorStop(0, "#ffffff");
    tfill.addColorStop(1, "#ffd9ec");
    g.fillStyle = tfill;
    g.fillText(title, tx, ty);

    // Pink underline
    g.fillStyle = "#ff2e88";
    g.fillRect(tx, ty + H * 0.012, Math.min(g.measureText(title).width, maxW) * 0.98, H * 0.008);

    // Subtitle in neon script
    var sub = state.subtitle || "";
    if (sub) {
      g.font = (H * 0.042) + 'px Pacifico, cursive';
      g.shadowColor = "#19e3d0";
      g.shadowBlur = H * 0.018;
      g.fillStyle = "#d9fff9";
      g.fillText(sub, tx + H * 0.006, ty - titleSize - H * 0.012);
      g.shadowBlur = 0;
    }
  }

  /* ---------- main render ---------- */
  function renderTo(targetCanvas, W, H) {
    targetCanvas.width = W;
    targetCanvas.height = H;
    var g = targetCanvas.getContext("2d");
    g.fillStyle = "#160a24";
    g.fillRect(0, 0, W, H);

    var layout = LAYOUTS[state.layout];
    var rects = layout.rects;
    var gutter = Math.max(3, Math.round(W * 0.006));
    for (var i = 0; i < rects.length; i++) {
      var panel = state.panels[i];
      var filled = drawPhotoInPanel(g, panel, rects[i], W, H);
      if (!filled) {
        // Empty panel: deep gradient placeholder
        var px = rects[i].x * W, py = rects[i].y * H, pw = rects[i].w * W, ph = rects[i].h * H;
        var ph2 = g.createLinearGradient(px, py, px + pw, py + ph);
        ph2.addColorStop(0, "#3a1a55");
        ph2.addColorStop(1, "#160a24");
        g.fillStyle = ph2;
        g.fillRect(px, py, pw, ph);
        g.fillStyle = "rgba(245, 239, 228, 0.55)";
        g.font = Math.round(H * 0.026) + 'px Anton, sans-serif';
        g.textAlign = "center";
        g.fillText("ADD A PHOTO", px + pw / 2, py + ph / 2);
        g.textAlign = "left";
      }
      gradeOverlay(g, W, H);
    }

    // White gutters between panels
    g.fillStyle = "#ffffff";
    for (var j = 0; j < rects.length; j++) {
      var r = rects[j];
      if (r.x > 0) g.fillRect(r.x * W - gutter / 2, r.y * H, gutter, r.h * H);
      if (r.y > 0) g.fillRect(r.x * W, r.y * H - gutter / 2, r.w * W, gutter);
    }

    addGrain(g, W, H);
    addVignette(g, W, H);
    drawLettering(g, W, H);
  }

  function render() {
    var size = PREVIEW_SIZES[state.previewSize];
    renderTo(canvas, size.w, size.h);
  }

  /* ---------- exports ---------- */
  function exportPNG(key) {
    var size = EXPORT_SIZES[key];
    var off = document.createElement("canvas");
    renderTo(off, size.w, size.h);
    return new Promise(function (resolve) {
      off.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "palm-heat-cover-" + key + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve({ width: size.w, height: size.h, bytes: blob.size });
      }, "image/png");
    });
  }

  function exportDataURL(key) {
    var size = EXPORT_SIZES[key];
    var off = document.createElement("canvas");
    renderTo(off, size.w, size.h);
    return { width: size.w, height: size.h, dataUrl: off.toDataURL("image/png") };
  }

  /* ---------- panel slots UI ---------- */
  var slotsBox = document.getElementById("panel-slots");

  function buildSlots() {
    slotsBox.innerHTML = "";
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var slot = document.createElement("div");
        slot.className = "panel-slot";
        slot.dataset.slot = String(idx);

        var name = document.createElement("span");
        name.className = "slot-name";
        name.textContent = SLOT_NAMES[idx];

        var controls = document.createElement("div");
        controls.className = "slot-controls";

        var fileLabel = document.createElement("label");
        fileLabel.textContent = "Upload photo";
        var fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.addEventListener("change", function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) return;
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            state.panels[idx].img = img;
            state.panels[idx].scale = 1;
            state.panels[idx].ox = 0;
            state.panels[idx].oy = 0;
            render();
          };
          img.src = url;
        });
        fileLabel.appendChild(fileInput);

        var zoom = document.createElement("input");
        zoom.type = "range";
        zoom.min = "1";
        zoom.max = "2.5";
        zoom.step = "0.01";
        zoom.value = "1";
        zoom.setAttribute("aria-label", SLOT_NAMES[idx] + " zoom");
        var readout = document.createElement("span");
        readout.className = "zoom-readout";
        readout.textContent = "Zoom 1.00x";
        zoom.addEventListener("input", function () {
          state.panels[idx].scale = parseFloat(zoom.value);
          readout.textContent = "Zoom " + parseFloat(zoom.value).toFixed(2) + "x";
          render();
        });

        controls.appendChild(fileLabel);
        controls.appendChild(zoom);
        controls.appendChild(readout);
        slot.appendChild(name);
        slot.appendChild(controls);
        slotsBox.appendChild(slot);
      })(i);
    }
    syncSlots();
  }

  function syncSlots() {
    var visible = state.layout === "bleed" ? 1 : 4;
    var slots = slotsBox.querySelectorAll(".panel-slot");
    slots.forEach(function (slot, idx) {
      slot.classList.toggle("is-hidden", idx >= visible);
    });
  }

  /* ---------- wiring ---------- */
  function bindChoiceGroup(containerId, attr, apply) {
    var box = document.getElementById(containerId);
    box.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-" + attr + "]");
      if (!btn) return;
      box.querySelectorAll(".choice").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      apply(btn.getAttribute("data-" + attr));
      render();
    });
  }

  bindChoiceGroup("layout-choices", "layout", function (v) {
    state.layout = v;
    document.getElementById("layout-desc").textContent = LAYOUTS[v].desc;
    syncSlots();
  });

  bindChoiceGroup("grade-choices", "grade", function (v) {
    state.grade = v;
    document.getElementById("grade-desc").textContent = GRADES[v].desc;
  });

  document.getElementById("title-input").addEventListener("input", function (ev) {
    state.title = ev.target.value;
    render();
  });
  document.getElementById("subtitle-input").addEventListener("input", function (ev) {
    state.subtitle = ev.target.value;
    render();
  });
  document.getElementById("badge-input").addEventListener("input", function (ev) {
    state.badge = ev.target.value;
    render();
  });

  document.getElementById("demo-photo").addEventListener("click", function () {
    loadDemoPhoto();
  });

  document.getElementById("same-photo").addEventListener("click", function () {
    var first = state.panels[0].img || demoPhoto;
    for (var i = 0; i < 4; i++) {
      state.panels[i].img = first;
      state.panels[i].scale = 1;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    render();
  });

  document.querySelectorAll(".export-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      exportPNG(btn.getAttribute("data-export"));
    });
  });

  // Preview-size toggle, built by script so the preview follows the export shape.
  (function addPreviewSizes() {
    var stage = document.getElementById("stage");
    var row = document.createElement("div");
    row.id = "preview-size-row";
    row.className = "choice-row";
    row.style.justifyContent = "center";
    row.style.margin = "0 0 12px";
    Object.keys(PREVIEW_SIZES).forEach(function (key) {
      var b = document.createElement("button");
      b.className = "choice" + (key === state.previewSize ? " is-active" : "");
      b.type = "button";
      b.textContent = PREVIEW_SIZES[key].label;
      b.addEventListener("click", function () {
        state.previewSize = key;
        row.querySelectorAll(".choice").forEach(function (x) { x.classList.remove("is-active"); });
        b.classList.add("is-active");
        render();
      });
      row.appendChild(b);
    });
    var hint = document.getElementById("hint");
    stage.insertBefore(row, hint);
  })();

  // Drag to pan, wheel to zoom the panel under the pointer.
  function panelAt(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) / rect.width;
    var y = (clientY - rect.top) / rect.height;
    var rects = LAYOUTS[state.layout].rects;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return 0;
  }

  canvas.addEventListener("pointerdown", function (ev) {
    activePanel = panelAt(ev.clientX, ev.clientY);
    dragging = { x: ev.clientX, y: ev.clientY, ox: state.panels[activePanel].ox, oy: state.panels[activePanel].oy };
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", function (ev) {
    if (!dragging) return;
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    state.panels[activePanel].ox = dragging.ox + (ev.clientX - dragging.x) * sx;
    state.panels[activePanel].oy = dragging.oy + (ev.clientY - dragging.y) * sy;
    render();
  });

  canvas.addEventListener("pointerup", function () { dragging = null; });
  canvas.addEventListener("pointercancel", function () { dragging = null; });

  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var idx = panelAt(ev.clientX, ev.clientY);
    var panel = state.panels[idx];
    panel.scale = Math.min(2.5, Math.max(1, panel.scale * (ev.deltaY < 0 ? 1.08 : 0.93)));
    render();
  }, { passive: false });

  function loadDemoPhoto() {
    for (var i = 0; i < 4; i++) {
      state.panels[i].img = demoPhoto;
      state.panels[i].scale = 1;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
    }
    render();
  }

  // Test hooks for the maker's own verification runs.
  window.__coverLab = {
    state: state,
    render: render,
    exportDataURL: exportDataURL,
    loadDemoPhoto: loadDemoPhoto,
    layouts: Object.keys(LAYOUTS),
    grades: Object.keys(GRADES)
  };

  buildSlots();
  loadDemoPhoto();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { render(); });
  }
  render();
})();
