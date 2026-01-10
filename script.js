(() => {
  "use strict";

  // =========================
  // DOM
  // =========================
  const $ = (id) => document.getElementById(id);

  const canvas = $("simCanvas");
  const toast = $("toast");
  const elStatus = $("simStatus");

  const elBuyers = $("buyers");
  const elVolume = $("volume");
  const elMcap = $("mcap");
  const elColonies = $("colonies");
  const elWorms = $("worms");
  const eventLogEl = $("eventLog");

  // Inspector (simplified)
  const inspector = $("inspector");
  const insClose = $("insClose");
  const insName = $("insName");
  const insDNA = $("insDNA");
  const insTemp = $("insTemp");
  const insBiome = $("insBiome");
  const insStyle = $("insStyle");
  const insWorms = $("insWorms");
  const insMutCount = $("insMutCount");
  const insMuts = $("insMuts");
  const insBossChips = $("insBossChips");

  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // =========================
  // Helpers
  // =========================
  const fmt = (n) => "$" + Math.max(0, Math.round(n)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const lerp = (a, b, t) => a + (b - a) * t;

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  function lerpAngle(a, b, t) {
    const d = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    return a + d * t;
  }

  // =========================
  // Canvas sizing
  // =========================
  let W = 1, H = 1, DPR = 1;
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // iOS cap
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 120));
  setTimeout(resizeCanvas, 0);

  // =========================
  // Event log (capped + spam merge)
  // =========================
  const LOG_CAP = 40;
  let lastLog = { msg: "", t: 0, count: 0, badge: "" };

  function pushLog(badge, msg, meta = "") {
    if (!eventLogEl) return;
    const now = Date.now();

    if (msg === lastLog.msg && badge === lastLog.badge && now - lastLog.t < 1200) {
      lastLog.count++;
      const first = eventLogEl.firstChild;
      if (first) {
        const txt = first.querySelector(".eventText");
        if (txt) txt.textContent = `${msg} (x${lastLog.count})`;
      }
      lastLog.t = now;
      return;
    }
    lastLog = { msg, t: now, count: 1, badge };

    const row = document.createElement("div");
    row.className = "eventRow";

    const b = document.createElement("div");
    b.className = `badge ${badge}`;
    b.textContent =
      badge === "mut" ? "MUTATION" :
      badge === "mile" ? "MILESTONE" :
      badge === "boss" ? "SPECIAL" : "EVENT";

    const wrap = document.createElement("div");

    const t = document.createElement("div");
    t.className = "eventText";
    t.textContent = msg;

    const m = document.createElement("div");
    m.className = "eventMeta";
    m.textContent = meta || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    wrap.appendChild(t);
    wrap.appendChild(m);

    row.appendChild(b);
    row.appendChild(wrap);

    eventLogEl.prepend(row);

    while (eventLogEl.children.length > LOG_CAP) {
      eventLogEl.removeChild(eventLogEl.lastChild);
    }
  }

  // =========================
  // Sound (iOS unlock)
  // =========================
  let audioCtx = null;
  let audioUnlocked = false;

  function ensureAudio() {
    if (audioUnlocked) return true;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      audioUnlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  function playSfx(type = "ping", intensity = 1) {
    if (!ensureAudio() || !audioCtx) return;

    const now = audioCtx.currentTime;
    const out = audioCtx.createGain();
    out.gain.value = 0.0001;
    out.connect(audioCtx.destination);

    const g = audioCtx.createGain();
    g.connect(out);

    const o = audioCtx.createOscillator();
    o.type = "sine";

    const n = audioCtx.createOscillator();
    n.type = "triangle";

    const A = 0.005;

    if (type === "mut") {
      o.frequency.setValueAtTime(320 + 80 * intensity, now);
      o.frequency.exponentialRampToValueAtTime(120, now + 0.20);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.12, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    } else if (type === "shock") {
      o.frequency.setValueAtTime(95, now);
      o.frequency.exponentialRampToValueAtTime(45, now + 0.42);
      n.frequency.setValueAtTime(150, now);
      n.frequency.exponentialRampToValueAtTime(60, now + 0.42);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.22, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
      n.connect(g);
      n.start(now);
      n.stop(now + 0.5);
    } else if (type === "fire") {
      o.frequency.setValueAtTime(240, now);
      o.frequency.exponentialRampToValueAtTime(620, now + 0.14);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.24, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    } else if (type === "ice") {
      o.frequency.setValueAtTime(620, now);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      // ✅ FIXED: removed the accidental double comma that broke the entire script
      g.gain.linearRampToValueAtTime(0.18, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.40);
    } else if (type === "sol") {
      o.frequency.setValueAtTime(180, now);
      o.frequency.exponentialRampToValueAtTime(520, now + 0.10);
      n.frequency.setValueAtTime(90, now);
      n.frequency.exponentialRampToValueAtTime(240, now + 0.20);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.22, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      n.connect(g);
      n.start(now);
      n.stop(now + 0.36);
    } else {
      o.frequency.setValueAtTime(420, now);
      o.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.10, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
    }

    o.connect(g);
    o.start(now);
    o.stop(now + 0.6);

    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(1.0, now + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  }

  window.addEventListener("pointerdown", () => ensureAudio(), { passive: true, once: true });

  // =========================
  // Economy / triggers
  // =========================
  let buyers = 0;
  let volume = 0;
  let mcap = 0;

  const MAX_COLONIES = 16;
  const MC_STEP = 25000;
  let nextSplitAt = MC_STEP;

  const milestone50k = { hit: false };
  const milestone100k = { hit: false };
  const milestone250k = { hit: false };

  // =========================
  // Camera + interaction
  // =========================
  let camX = 0, camY = 0, zoom = 0.82;
  let dragging = false, lastX = 0, lastY = 0;
  let selected = 0;
  let focusOn = false;
  let isInteracting = false;
  let movedDuringDrag = false;

  function toWorld(px, py) {
    return {
      x: (px - W / 2) / zoom - camX,
      y: (py - H / 2) / zoom - camY
    };
  }

  function pickColony(wx, wy) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < colonies.length; i++) {
      const c = colonies[i];
      const d = dist2(wx, wy, c.x, c.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return (best !== -1 && bestD < 320 * 320) ? best : -1;
  }

  const TAP_SLOP = 10;

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    dragging = true;
    isInteracting = true;
    movedDuringDrag = false;
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    if (Math.abs(dx) + Math.abs(dy) > TAP_SLOP) movedDuringDrag = true;

    lastX = e.clientX; lastY = e.clientY;

    camX += dx / zoom;
    camY += dy / zoom;
  }, { passive: true });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    isInteracting = false;

    if (!movedDuringDrag) {
      const w = toWorld(e.clientX, e.clientY);
      const idx = pickColony(w.x, w.y);
      if (idx !== -1) {
        selected = idx;
        openInspectorFor(idx);
        pushLog("event", `Selected Colony #${idx + 1}`);
        if (focusOn) centerOnSelected(true);
      }
    }
  }, { passive: true });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
    isInteracting = false;
  }, { passive: true });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    isInteracting = true;
    const k = e.deltaY > 0 ? 0.92 : 1.08;
    zoom = clamp(zoom * k, 0.55, 2.8);
    clearTimeout(canvas.__wheelTO);
    canvas.__wheelTO = setTimeout(() => (isInteracting = false), 120);
  }, { passive: false });

  let lastTap = 0;
  canvas.addEventListener("touchend", () => {
    const now = Date.now();
    if (now - lastTap < 280) centerOnSelected(false);
    lastTap = now;
  }, { passive: true });

  function centerOnSelected(smooth = true) {
    const c = colonies[selected];
    if (!c) return;
    if (!smooth) { camX = -c.x; camY = -c.y; return; }
    camX = lerp(camX, -c.x, 0.18);
    camY = lerp(camY, -c.y, 0.18);
  }

  function zoomOutToFitAll() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pad = 560;
    for (const c of colonies) {
      minX = Math.min(minX, c.x - pad);
      minY = Math.min(minY, c.y - pad);
      maxX = Math.max(maxX, c.x + pad);
      maxY = Math.max(maxY, c.y + pad);
    }
    const bw = Math.max(240, maxX - minX);
    const bh = Math.max(240, maxY - minY);
    const fit = Math.min(W / bw, H / bh);
    zoom = clamp(fit * 0.92, 0.55, 1.7);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    camX = -cx; camY = -cy;
  }

  // Inspector UI
  function makeDnaCode(c) {
    const a = Math.floor((c.dna.hue % 360));
    const b = Math.floor(c.dna.chaos * 99);
    const d = Math.floor(c.dna.drift * 99);
    const e = Math.floor(c.dna.aura * 99);
    const f = Math.floor(c.dna.limbiness * 99);
    return `H${a}-C${b}-D${d}-A${e}-L${f}`;
  }

  function openInspectorFor(idx) {
    if (!inspector) return;
    const c = colonies[idx];
    if (!c) return;

    inspector.style.display = "block";

    const bosses = c.worms.filter(w => w.isBoss || w.special);
    const chips = [];
    for (const b of bosses) {
      if (b.special === "SOL_STORM") chips.push(`<span class="tag sol">⚡ SOL STORM</span>`);
      else if (b.special === "FIRE_DOGE") chips.push(`<span class="tag fire">🔥 FIRE DOGE</span>`);
      else if (b.special === "ICE_QUEEN") chips.push(`<span class="tag ice">❄ ICE QUEEN</span>`);
      else chips.push(`<span class="tag">👑 BOSS</span>`);
    }
    if (insBossChips) insBossChips.innerHTML = chips.join("") || `<span class="tag">No bosses</span>`;

    if (insName) insName.textContent = `Colony #${idx + 1} • ${c.id}`;
    if (insDNA) insDNA.textContent = makeDnaCode(c);
    if (insTemp) insTemp.textContent = c.dna.temperament;
    if (insBiome) insBiome.textContent = c.dna.biome;
    if (insStyle) insStyle.textContent = c.dna.style;

    if (insWorms) insWorms.textContent = String(c.worms.length);
    if (insMutCount) insMutCount.textContent = String(c.muts.length);

    if (insMuts) {
      insMuts.innerHTML = "";
      const take = c.muts.slice(0, 10);
      for (const m of take) {
        const d = document.createElement("div");
        d.className = "mut";
        d.textContent = m;
        insMuts.appendChild(d);
      }
      if (!take.length) {
        const d = document.createElement("div");
        d.className = "mut";
        d.textContent = "—";
        insMuts.appendChild(d);
      }
    }
  }

  if (insClose) {
    insClose.addEventListener("click", () => {
      if (inspector) inspector.style.display = "none";
    });
  }

  // =========================
  // Background
  // =========================
  const bg = {
    canvas: document.createElement("canvas"),
    ctx: null,
    w: 0, h: 0
  };
  bg.ctx = bg.canvas.getContext("2d");

  function makeStarfield() {
    bg.w = 900;
    bg.h = 900;
    bg.canvas.width = bg.w;
    bg.canvas.height = bg.h;

    const b = bg.ctx;
    b.clearRect(0, 0, bg.w, bg.h);

    for (let i = 0; i < 12; i++) {
      const x = rand(0, bg.w), y = rand(0, bg.h);
      const r = rand(170, 380);
      const hue = rand(180, 330);
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${hue}, 95%, 62%, ${rand(0.08, 0.16)})`);
      g.addColorStop(1, `hsla(${hue}, 95%, 62%, 0)`);
      b.fillStyle = g;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
    }

    b.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i++) {
      const cx = rand(0, bg.w), cy = rand(0, bg.h);
      const baseR = rand(120, 290);
      const hue = rand(170, 310);
      b.strokeStyle = `hsla(${hue}, 95%, 75%, ${rand(0.06, 0.13)})`;
      b.lineWidth = rand(1.1, 2.6);
      for (let k = 0; k < 7; k++) {
        b.beginPath();
        const start = rand(0, Math.PI * 2);
        const span = rand(Math.PI * 0.6, Math.PI * 1.35);
        for (let t = 0; t <= 1.001; t += 0.06) {
          const a = start + span * t;
          const rr = baseR * (0.55 + t * 0.75) + Math.sin(t * 6 + i) * 10;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (t === 0) b.moveTo(x, y);
          else b.lineTo(x, y);
        }
        b.stroke();
      }
    }
    b.globalCompositeOperation = "source-over";

    for (let i = 0; i < 1600; i++) {
      const x = rand(0, bg.w), y = rand(0, bg.h);
      const r = Math.random() < 0.90 ? rand(0.3, 1.2) : rand(1.2, 2.2);
      const a = Math.random() < 0.92 ? rand(0.35, 0.75) : rand(0.75, 0.95);
      const hue = Math.random() < 0.85 ? 210 : rand(180, 320);
      b.fillStyle = `hsla(${hue}, 95%, 88%, ${a})`;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();

      if (r > 1.5 && Math.random() < 0.25) {
        b.strokeStyle = `hsla(${hue}, 95%, 92%, ${a * 0.55})`;
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x - 4, y);
        b.lineTo(x + 4, y);
        b.moveTo(x, y - 4);
        b.lineTo(x, y + 4);
        b.stroke();
      }
    }
  }
  makeStarfield();

  function drawBackground() {
    const px = (-camX * zoom * 0.10) % bg.w;
    const py = (-camY * zoom * 0.10) % bg.h;
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        ctx.drawImage(bg.canvas, px + ix * bg.w, py + iy * bg.h);
      }
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,255,255,.012)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  // =========================
  // Colony / worms
  // =========================
  const DNA_TEMPS = ["CALM", "AGGRESSIVE", "CHAOTIC", "TOXIC", "HYPER", "ZEN", "FERAL", "ROYAL"];
  const DNA_BIOMES = ["NEON GARDEN", "DEEP SEA", "VOID BLOOM", "GLASS CAVE", "ARC STORM", "EMBER WASTE", "ICE TEMPLE", "STARFIELD"];
  const DNA_STYLES = ["COMET", "CROWN", "ARC", "SPIRAL", "DRIFT", "RIBBON", "FRACTAL", "ORBIT"];

  function makeColonyOutline(dna) {
    const pts = [];
    const baseR = 120 * dna.aura;
    const spikes = randi(10, 18);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const wob =
        Math.sin(a * (2.0 + dna.chaos) + dna.seed) * (18 + 18 * dna.chaos) +
        Math.sin(a * (5.0 + dna.drift) - dna.seed * 0.7) * (10 + 12 * dna.drift);
      pts.push({ a, r: baseR + wob });
    }
    return pts;
  }

  function newColony(x, y, hue = rand(0, 360)) {
    const id = Math.random().toString(16).slice(2, 6).toUpperCase();
    const dna = {
      hue,
      chaos: rand(0.55, 1.45),
      drift: rand(0.55, 1.45),
      aura: rand(1.0, 1.9),
      limbiness: rand(0.20, 1.35),
      temperament: DNA_TEMPS[randi(0, DNA_TEMPS.length - 1)],
      biome: DNA_BIOMES[randi(0, DNA_BIOMES.length - 1)],
      style: DNA_STYLES[randi(0, DNA_STYLES.length - 1)],
      seed: rand(0, 9999)
    };

    return {
      id,
      x, y,
      vx: rand(-0.18, 0.18),
      vy: rand(-0.18, 0.18),
      dna,
      outline: makeColonyOutline(dna),
      worms: [],
      shock: [],
      freezeT: 0,
      muts: []
    };
  }

  function addLimb(w, big = false) {
    if (!w.segs.length) return;
    const at = randi(2, w.segs.length - 3);
    w.limbs.push({
      at,
      len: big ? rand(45, 130) : rand(24, 86),
      ang: rand(-1.4, 1.4),
      wob: rand(0.7, 1.9)
    });
  }

  function newWorm(col, big = false, special = null) {
    const type = ["DRIFTER", "ORBITER", "HUNTER"][randi(0, 2)];
    const segCount = big ? randi(18, 32) : randi(12, 22);
    const baseLen = big ? rand(10, 16) : rand(7, 12);

    const spawnAng = rand(0, Math.PI * 2);
    const spawnRad = rand(45, 130);
    let px = col.x + Math.cos(spawnAng) * spawnRad;
    let py = col.y + Math.sin(spawnAng) * spawnRad;
    let ang = rand(0, Math.PI * 2);

    const hueBase = (col.dna.hue + rand(-170, 170) + 360) % 360;

    const w = {
      id: Math.random().toString(16).slice(2, 6),
      type,
      hue: hueBase,
      width: big ? rand(7, 12) : rand(4.4, 7.2),
      speed: big ? rand(0.36, 0.82) : rand(0.48, 1.10),
      turn: rand(0.010, 0.026) * col.dna.chaos,
      phase: rand(0, Math.PI * 2),
      orbitDir: Math.random() < 0.5 ? -1 : 1,
      roam: {
        tx: col.x + Math.cos(spawnAng) * rand(80, 200),
        ty: col.y + Math.sin(spawnAng) * rand(80, 200),
        t: rand(0, 9999),
        mode: Math.random() < 0.6 ? "FORAGE" : "PATROL"
      },
      pat: {
        stripe: Math.random() < 0.78,
        dots: Math.random() < 0.48,
        dual: Math.random() < 0.52,
        hue2: (hueBase + rand(40, 160)) % 360,
        sparkle: Math.random() < 0.38
      },
      limbs: [],
      segs: [],
      isBoss: false,
      special: special || null,
      breath: [],
      bolts: [],
      __nextBurst: 0
    };

    for (let i = 0; i < segCount; i++) {
      w.segs.push({ x: px, y: py, a: ang, len: baseLen * rand(0.85, 1.22) });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.35, 0.35) * col.dna.chaos;
    }

    const limbChance = clamp(0.10 + col.dna.limbiness * 0.22, 0.14, 0.60);
    if (Math.random() < limbChance) addLimb(w, big);

    if (special === "SOL_STORM") {
      w.isBoss = true;
      w.width *= 2.0;
      w.speed *= 0.95;
      w.hue = 185;
      w.pat.hue2 = 285;
      w.pat.sparkle = true;
    }
    if (special === "FIRE_DOGE") {
      w.isBoss = true;
      w.width *= 2.1;
      w.speed *= 0.92;
      w.hue = 22;
      w.pat.hue2 = 55;
      w.pat.sparkle = true;
    }
    if (special === "ICE_QUEEN") {
      w.isBoss = true;
      w.width *= 2.3;
      w.speed *= 0.86;
      w.hue = 205;
      w.pat.hue2 = 265;
      w.pat.sparkle = true;
    }

    return w;
  }

  const colonies = [newColony(0, 0, 150)];
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], true));

  // =========================
  // Shockwaves
  // =========================
  function shockwave(col, strength = 1, hueOverride = null) {
    col.shock.push({
      r: 0,
      v: 2.9 + strength * 1.6,
      a: 0.95,
      w: 2 + strength * 1.4,
      hue: hueOverride
    });
    playSfx("shock", strength);
  }

  // =========================
  // Flow field
  // =========================
  function flowAngle(x, y, time) {
    const t = time * 0.00022;
    const nx = x * 0.0020;
    const ny = y * 0.0020;
    return (
      Math.sin(nx + t) * 1.0 +
      Math.cos(ny - t * 1.4) * 0.95 +
      Math.sin((nx + ny) * 0.65 + t * 1.7) * 0.80
    );
  }

  // =========================
  // Drawing
  // =========================
  function aura(x, y, r, hue, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue},95%,65%,${a})`);
    g.addColorStop(1, `hsla(${hue},95%,65%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function strokePath(points, width, color, glow = null) {
    if (glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = glow;
      ctx.lineWidth = width + 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  function drawColony(col, time) {
    const hue = col.dna.hue;

    if (!isInteracting) {
      aura(col.x, col.y, 210 * col.dna.aura, hue, 0.16);
      aura(col.x, col.y, 150 * col.dna.aura, (hue + 40) % 360, 0.10);
      aura(col.x, col.y, 105 * col.dna.aura, (hue + 110) % 360, 0.06);
    } else {
      aura(col.x, col.y, 160 * col.dna.aura, hue, 0.12);
    }

    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, .30)`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let i = 0; i < col.outline.length; i++) {
      const o = col.outline[i];
      const wob = Math.sin(time * 0.0014 + o.a * 3 + col.dna.seed) * 10;
      const r = o.r + wob;
      const px = col.x + Math.cos(o.a) * r;
      const py = col.y + Math.sin(o.a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    if (colonies[selected] === col) {
      ctx.strokeStyle = `hsla(${hue}, 95%, 70%, .62)`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(col.x, col.y, 118 * col.dna.aura, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of col.shock) {
      const hh = (s.hue ?? hue);
      ctx.strokeStyle = `hsla(${hh}, 92%, 70%, ${s.a})`;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.arc(col.x, col.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (col.freezeT > 0) {
      ctx.globalCompositeOperation = "lighter";
      aura(col.x, col.y, 260 * col.dna.aura, 205, 0.14 * clamp(col.freezeT / 2.6, 0, 1));
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawWorm(w, time) {
    const pts = w.segs;
    if (!pts.length) return;

    const bossGlow = w.isBoss
      ? `hsla(${w.hue}, 95%, 70%, .34)`
      : `hsla(${w.hue}, 95%, 65%, .14)`;

    if (!isInteracting) strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .94)`, bossGlow);
    else strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .94)`);

    if (w.isBoss && !isInteracting) {
      const h = pts[0];
      ctx.globalCompositeOperation = "lighter";
      aura(h.x, h.y, 42 + w.width * 2.2, w.hue, 0.16);
      aura(h.x, h.y, 26 + w.width * 1.5, (w.hue + 80) % 360, 0.10);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // =========================
  // Behavior (roaming)
  // =========================
  function updateRoamTarget(col, w, time) {
    w.roam.t += 0.016;
    const shouldRetarget = (time % 1000 < 16) && (Math.random() < 0.06);
    if (shouldRetarget) {
      const a = rand(0, Math.PI * 2);
      const r = rand(90, 260) * (col.dna.aura * 0.9);
      w.roam.tx = col.x + Math.cos(a) * r;
      w.roam.ty = col.y + Math.sin(a) * r;
      w.roam.mode = Math.random() < 0.65 ? "FORAGE" : "PATROL";
    }
  }

  function wormBehavior(col, w, time, dt) {
    const head = w.segs[0];
    const freezeSlow = col.freezeT > 0 ? 0.55 : 1.0;

    updateRoamTarget(col, w, time);

    const dxC = col.x - head.x;
    const dyC = col.y - head.y;
    const towardC = Math.atan2(dyC, dxC);

    const dxT = w.roam.tx - head.x;
    const dyT = w.roam.ty - head.y;
    const towardT = Math.atan2(dyT, dxT);

    const field = flowAngle(head.x, head.y, time);
    const orbit = towardC + w.orbitDir * (0.75 + 0.35 * Math.sin(time * 0.001 + w.phase));

    let desired;
    if (w.type === "DRIFTER") desired = lerpAngle(towardT, field, 0.35);
    else if (w.type === "ORBITER") desired = lerpAngle(lerpAngle(orbit, towardT, 0.35), field, 0.25);
    else desired = lerpAngle(lerpAngle(towardT, towardC, 0.25), field, 0.30);

    desired = lerpAngle(desired, towardC, 0.10);

    const turnAmt = w.turn * (0.9 + 0.25 * Math.sin(time * 0.001 + w.phase));
    head.a = lerpAngle(head.a, desired, clamp(turnAmt * 9.2, 0.06, 0.24));
    head.a += (Math.random() - 0.5) * turnAmt * 0.9;

    const boost = w.isBoss ? 1.75 : 1.0;
    const sp = w.speed * 2.20 * boost * freezeSlow;
    head.x += Math.cos(head.a) * sp;
    head.y += Math.sin(head.a) * sp;

    const d = Math.hypot(head.x - col.x, head.y - col.y);
    const leash = 360 + 90 * col.dna.aura;
    if (d > leash) {
      head.x = col.x + (head.x - col.x) * 0.90;
      head.y = col.y + (head.y - col.y) * 0.90;
      head.a = lerpAngle(head.a, towardC, 0.28);
    }

    for (let i = 1; i < w.segs.length; i++) {
      const prev = w.segs[i - 1];
      const seg = w.segs[i];

      const vx = seg.x - prev.x;
      const vy = seg.y - prev.y;
      const ang = Math.atan2(vy, vx);

      const targetX = prev.x + Math.cos(ang) * seg.len;
      const targetY = prev.y + Math.sin(ang) * seg.len;

      seg.x = seg.x * 0.22 + targetX * 0.78;
      seg.y = seg.y * 0.22 + targetY * 0.78;
      seg.a = ang;
    }
  }

  // =========================
  // Mutations / spawning / milestones
  // =========================
  let mutTimer = 0;
  let spawnTimer = 0;

  function addColonyMut(col, msg) {
    col.muts.unshift(msg);
    if (col.muts.length > 60) col.muts.length = 60;
  }

  function mutateRandom() {
    const c = colonies[randi(0, colonies.length - 1)];
    if (!c?.worms?.length) return;
    const w = c.worms[randi(0, c.worms.length - 1)];

    const roll = Math.random();
    let msg = "";

    if (roll < 0.16) {
      w.hue = (w.hue + rand(40, 160)) % 360;
      msg = `Color morph • Worm ${w.id}`;
    } else if (roll < 0.30) {
      w.speed *= rand(1.05, 1.32);
      msg = `Aggression spike • Worm ${w.id}`;
    } else if (roll < 0.44) {
      w.width = clamp(w.width * rand(1.05, 1.38), 3.5, 22);
      msg = `Body growth • Worm ${w.id}`;
    } else if (roll < 0.58) {
      w.turn *= rand(1.10, 1.50);
      msg = `Turn instability • Worm ${w.id}`;
    } else if (roll < 0.74) {
      msg = `Pattern shift • Worm ${w.id}`;
    } else if (roll < 0.88) {
      w.roam.tx = c.x + Math.cos(rand(0, Math.PI * 2)) * rand(130, 280);
      w.roam.ty = c.y + Math.sin(rand(0, Math.PI * 2)) * rand(130, 280);
      msg = `Forage instinct • Worm ${w.id}`;
    } else {
      addLimb(w, Math.random() < 0.45);
      msg = `Limb growth • Worm ${w.id}`;
    }

    addColonyMut(c, msg);
    pushLog("mut", msg);
    playSfx("mut", 1);
    if (Math.random() < 0.28) shockwave(c, 0.95);

    if (colonies[selected] === c && inspector?.style.display === "block") openInspectorFor(selected);
  }

  function growthScore() {
    return (mcap / 24000) + (volume / 7000) + (buyers / 12);
  }

  function maybeSpawnWorms(dt) {
    const g = growthScore();
    const target = clamp(Math.floor(3 + g * 2.1), 3, 140);

    const total = colonies.reduce((a, c) => a + c.worms.length, 0);
    if (total >= target) return;

    spawnTimer += dt;
    const rate = clamp(1.2 - g * 0.035, 0.12, 1.2);
    if (spawnTimer >= rate) {
      spawnTimer = 0;
      const c = colonies[selected] || colonies[0];
      c.worms.push(newWorm(c, Math.random() < 0.18));
      if (Math.random() < 0.22) shockwave(c, 0.55);
      pushLog("event", "New worm hatched");
      if (colonies[selected] === c && inspector?.style.display === "block") openInspectorFor(selected);
    }
  }

  function trySplitByMcap() {
    while (mcap >= nextSplitAt && colonies.length < MAX_COLONIES) {
      const base = colonies[0];
      const ang = rand(0, Math.PI * 2);
      const dist = rand(280, 520);
      const nc = newColony(
        base.x + Math.cos(ang) * dist,
        base.y + Math.sin(ang) * dist,
        (base.dna.hue + rand(-110, 110) + 360) % 360
      );

      const g = growthScore();
      const starters = clamp(Math.floor(2 + g / 2), 2, 7);
      for (let i = 0; i < starters; i++) nc.worms.push(newWorm(nc, Math.random() < 0.25));

      shockwave(nc, 1.1);
      colonies.push(nc);

      pushLog("event", `New colony spawned at ${fmt(nextSplitAt)} MC`);
      nextSplitAt += MC_STEP;
    }
  }

  function checkMilestones() {
    if (!milestone50k.hit && mcap >= 50000) {
      milestone50k.hit = true;
      const c = colonies[0];
      c.worms.push(newWorm(c, true, "SOL_STORM"));
      shockwave(c, 2.4, 185);
      pushLog("boss", "⚡ 50k Milestone: Solana Storm Worm has arrived!");
      playSfx("sol", 1.2);
    }

    if (!milestone100k.hit && mcap >= 100000) {
      milestone100k.hit = true;
      const c = colonies[0];
      c.worms.push(newWorm(c, true, "FIRE_DOGE"));
      shockwave(c, 2.6, 22);
      pushLog("mile", "🔥 100k Milestone: Fire Doge Worm has arrived!");
      playSfx("fire", 1.2);
    }

    if (!milestone250k.hit && mcap >= 250000) {
      milestone250k.hit = true;
      const c = colonies[0];
      c.worms.push(newWorm(c, true, "ICE_QUEEN"));
      c.freezeT = 3.0;
      shockwave(c, 2.9, 205);
      pushLog("mile", "❄ 250k Milestone: Ice Queen hatch!");
      playSfx("ice", 1.2);
    }
  }

  // =========================
  // Controls
  // =========================
  function bind(action, fn) {
    const btn = document.querySelector(`button[data-action="${action}"]`);
    if (btn) btn.addEventListener("click", () => { ensureAudio(); fn(); });
  }

  bind("feed", () => {
    volume += rand(20, 90);
    mcap += rand(120, 460);
  });

  bind("smallBuy", () => {
    buyers += 1;
    volume += rand(180, 900);
    mcap += rand(900, 3200);
  });

  bind("whaleBuy", () => {
    buyers += randi(2, 5);
    volume += rand(2500, 8500);
    mcap += rand(9000, 22000);
    shockwave(colonies[0], 1.2);
  });

  bind("sell", () => {
    volume = Math.max(0, volume - rand(600, 2600));
    mcap = Math.max(0, mcap - rand(2200, 9000));
  });

  bind("storm", () => {
    volume += rand(5000, 18000);
    mcap += rand(2000, 8000);
    shockwave(colonies[0], 1.0);
  });

  bind("mutate", () => mutateRandom());

  bind("focus", () => {
    focusOn = !focusOn;
    const btn = $("focusBtn");
    if (btn) btn.textContent = `Focus: ${focusOn ? "On" : "Off"}`;
    if (focusOn) centerOnSelected(false);
  });

  bind("zoomIn", () => (zoom = clamp(zoom * 1.12, 0.55, 2.8)));
  bind("zoomOut", () => (zoom = clamp(zoom * 0.88, 0.55, 2.8)));

  bind("capture", () => {
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "worm_colony.png";
      a.click();
      pushLog("event", "Capture saved");
    } catch {
      pushLog("event", "Capture blocked by iOS — screenshot/share instead");
    }
  });

  bind("reset", () => location.reload());

  // =========================
  // Stats
  // =========================
  function updateStats() {
    if (elBuyers) elBuyers.textContent = String(buyers);
    if (elVolume) elVolume.textContent = fmt(volume);
    if (elMcap) elMcap.textContent = fmt(mcap);
    if (elColonies) elColonies.textContent = String(colonies.length);
    if (elWorms) {
      const total = colonies.reduce((a, c) => a + c.worms.length, 0);
      elWorms.textContent = String(total);
    }
  }

  // =========================
  // Main step/render
  // =========================
  function step(dt, time) {
    trySplitByMcap();
    checkMilestones();

    for (const c of colonies) {
      c.vx += rand(-0.02, 0.02) * c.dna.drift;
      c.vy += rand(-0.02, 0.02) * c.dna.drift;
      c.vx *= 0.985;
      c.vy *= 0.985;
      c.x += c.vx;
      c.y += c.vy;

      if (c.freezeT > 0) c.freezeT = Math.max(0, c.freezeT - dt);

      for (const s of c.shock) {
        s.r += s.v;
        s.a *= 0.962;
      }
      c.shock = c.shock.filter((s) => s.a > 0.06);
    }

    for (const c of colonies) {
      for (const w of c.worms) wormBehavior(c, w, time, dt);
    }

    if (focusOn) centerOnSelected(true);

    mutTimer += dt;
    const g = growthScore();
    const mutRate = clamp(2.2 - g * 0.07, 0.35, 2.2);
    if (mutTimer >= mutRate) {
      mutTimer = 0;
      if (Math.random() < 0.65) mutateRandom();
    }

    maybeSpawnWorms(dt);
    updateStats();
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    for (const c of colonies) drawColony(c, time);
    for (const c of colonies) for (const w of c.worms) drawWorm(w, time);

    ctx.restore();

    if (toast) toast.textContent = "JS LOADED ✓ (rendering)";
    if (elStatus) elStatus.textContent = "Simulation Active";
  }

  // =========================
  // Loop
  // =========================
  let last = performance.now();
  let renderAccum = 0;
  const RENDER_FPS = 40;
  const RENDER_DT = 1 / RENDER_FPS;

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    step(dt, now);

    renderAccum += dt;
    if (renderAccum >= RENDER_DT) {
      renderAccum = 0;
      render(now);
    }

    requestAnimationFrame(tick);
  }

  // =========================
  // Boot
  // =========================
  function boot() {
    resizeCanvas();
    zoomOutToFitAll();
    updateStats();
    pushLog("event", "Simulation ready");
    if (toast) toast.textContent = "Loading…";
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
