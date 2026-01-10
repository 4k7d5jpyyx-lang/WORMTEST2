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

  // Inspector overlay (matches your HTML)
  const inspector = $("inspector");
  const inspectorBody = $("inspectorBody");
  const btnToggleInspector = $("toggleInspector");
  const elSelName = $("selName");
  const elDnaVal = $("dnaVal");
  const elTempVal = $("tempVal");
  const elBiomeVal = $("biomeVal");
  const elStyleVal = $("styleVal");
  const mutListEl = $("mutList");

  if (!canvas) return;

  // Perf: desynchronized helps iOS panning; alpha true for glow
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  // =========================
  // Utils
  // =========================
  const fmt = (n) => "$" + Math.max(0, Math.round(n)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const lerp = (a, b, t) => a + (b - a) * t;

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }
  function len(ax, ay) { return Math.hypot(ax, ay); }
  function norm(ax, ay) {
    const l = Math.hypot(ax, ay) || 1;
    return { x: ax / l, y: ay / l };
  }
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
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap for iOS perf
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
  // Event log (capped + merges spam)
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
  // iOS-friendly sound (unlocks on first tap)
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
      o.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.12, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    } else if (type === "shock") {
      o.frequency.setValueAtTime(90, now);
      o.frequency.exponentialRampToValueAtTime(45, now + 0.35);
      n.frequency.setValueAtTime(140, now);
      n.frequency.exponentialRampToValueAtTime(60, now + 0.35);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.22, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      n.connect(g);
      n.start(now);
      n.stop(now + 0.4);
    } else if (type === "fire") {
      o.frequency.setValueAtTime(220, now);
      o.frequency.exponentialRampToValueAtTime(520, now + 0.12);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.26, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    } else if (type === "ice") {
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.20, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.40);
    } else if (type === "storm") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(140, now);
      o.frequency.exponentialRampToValueAtTime(420, now + 0.10);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.30, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    } else {
      o.frequency.setValueAtTime(420, now);
      o.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.10, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
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

  // Milestones
  const milestone50k = { hit: false };   // Solana Storm Worm
  const milestone100k = { hit: false };  // Fire Doge Worm
  const milestone250k = { hit: false };  // Ice Queen

  function growthScore() {
    return (mcap / 24000) + (volume / 7000) + (buyers / 12);
  }

  // =========================
  // Camera + interaction
  // =========================
  let camX = 0, camY = 0, zoom = 0.82;
  let dragging = false, lastX = 0, lastY = 0;
  let selected = 0;
  let focusOn = false;
  let isInteracting = false;

  // screen shake
  let shakeT = 0;
  let shakeMag = 0;
  let flashA = 0;

  function addShake(mag, dur = 0.25) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = Math.max(shakeT, dur);
  }
  function addFlash(a = 0.35) {
    flashA = Math.max(flashA, a);
  }

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
    return (best !== -1 && bestD < 280 * 280) ? best : -1;
  }

  // Drag pan
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    dragging = true;
    isInteracting = true;
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    camX += dx / zoom;
    camY += dy / zoom;
  }, { passive: true });

  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    isInteracting = false;

    // tap select
    const w = toWorld(e.clientX, e.clientY);
    const idx = pickColony(w.x, w.y);
    if (idx !== -1) {
      selected = idx;
      updateInspector();
      pushLog("event", `Selected Colony #${idx + 1}`);
      if (focusOn) centerOnSelected(true);
    }
  }, { passive: true });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
    isInteracting = false;
  }, { passive: true });

  // wheel zoom desktop
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    isInteracting = true;
    const k = e.deltaY > 0 ? 0.92 : 1.08;
    zoom = clamp(zoom * k, 0.55, 2.8);
    clearTimeout(canvas.__wheelTO);
    canvas.__wheelTO = setTimeout(() => (isInteracting = false), 120);
  }, { passive: false });

  // double tap center mobile
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
    const pad = 520;
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

  // =========================
  // Background (stars + nebula + galaxy swirls)
  // =========================
  const bg = {
    canvas: document.createElement("canvas"),
    ctx: null,
    w: 0, h: 0,
  };
  bg.ctx = bg.canvas.getContext("2d");

  function makeStarfield() {
    bg.w = 900;
    bg.h = 900;
    bg.canvas.width = bg.w;
    bg.canvas.height = bg.h;

    const b = bg.ctx;
    b.clearRect(0, 0, bg.w, bg.h);

    // nebula blobs
    for (let i = 0; i < 10; i++) {
      const x = rand(0, bg.w), y = rand(0, bg.h);
      const r = rand(160, 360);
      const hue = rand(180, 320);
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${hue}, 95%, 60%, ${rand(0.08, 0.16)})`);
      g.addColorStop(1, `hsla(${hue}, 95%, 60%, 0)`);
      b.fillStyle = g;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
    }

    // galaxy swirls
    b.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const cx = rand(0, bg.w), cy = rand(0, bg.h);
      const baseR = rand(120, 260);
      const hue = rand(170, 310);
      b.strokeStyle = `hsla(${hue}, 95%, 70%, ${rand(0.06, 0.12)})`;
      b.lineWidth = rand(1.2, 2.4);
      for (let k = 0; k < 6; k++) {
        b.beginPath();
        const start = rand(0, Math.PI * 2);
        const span = rand(Math.PI * 0.6, Math.PI * 1.2);
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

    // stars
    for (let i = 0; i < 1400; i++) {
      const x = rand(0, bg.w), y = rand(0, bg.h);
      const r = Math.random() < 0.90 ? rand(0.3, 1.2) : rand(1.2, 2.2);
      const a = Math.random() < 0.92 ? rand(0.35, 0.75) : rand(0.75, 0.95);
      const hue = Math.random() < 0.85 ? 210 : rand(180, 320);
      b.fillStyle = `hsla(${hue}, 95%, 85%, ${a})`;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();

      if (r > 1.5 && Math.random() < 0.25) {
        b.strokeStyle = `hsla(${hue}, 95%, 90%, ${a * 0.55})`;
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(x - 4, y); b.lineTo(x + 4, y);
        b.moveTo(x, y - 4); b.lineTo(x, y + 4);
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
    ctx.fillStyle = "rgba(255,255,255,.015)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  // =========================
  // DNA / Models
  // =========================
  const DNA_TEMPS = ["CALM", "AGGRESSIVE", "CHAOTIC", "TOXIC", "HYPER", "ZEN", "FERAL", "ROYAL"];
  const DNA_BIOMES = ["NEON GARDEN", "DEEP SEA", "VOID BLOOM", "GLASS CAVE", "ARC STORM", "EMBER WASTE", "ICE TEMPLE", "STARFIELD"];
  const DNA_STYLES = ["COMET", "CROWN", "ARC", "SPIRAL", "DRIFT", "RIBBON", "FRACTAL", "ORBIT"];

  function makeDnaCode(c) {
    const a = Math.floor((c.dna.hue % 360));
    const b = Math.floor(c.dna.chaos * 99);
    const d = Math.floor(c.dna.drift * 99);
    const e = Math.floor(c.dna.aura * 99);
    const f = Math.floor(c.dna.limbiness * 99);
    return `H${a}-C${b}-D${d}-A${e}-L${f}`;
  }

  function makeColonyOutline(dna) {
    const pts = [];
    const baseR = 120 * dna.aura;
    const spikes = randi(9, 16);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const wob =
        Math.sin(a * (2.0 + dna.chaos) + dna.seed) * (18 + 18 * dna.chaos) +
        Math.sin(a * (5.0 + dna.drift) - dna.seed * 0.7) * (10 + 12 * dna.drift);
      const r = baseR + wob;
      pts.push({ a, r });
    }
    return pts;
  }

  function newColony(x, y, hue = rand(0, 360)) {
    const id = Math.random().toString(16).slice(2, 6).toUpperCase();
    const dna = {
      hue,
      chaos: rand(0.55, 1.45),
      drift: rand(0.55, 1.45),
      aura: rand(1.0, 1.8),
      limbiness: rand(0.20, 1.25),
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
      mutHistory: [],
    };
  }

  function addLimb(w, big = false) {
    if (!w.segs.length) return;
    const at = randi(2, Math.max(3, w.segs.length - 3));
    w.limbs.push({
      at,
      len: big ? rand(55, 140) : rand(24, 90),
      ang: rand(-1.6, 1.6),
      wob: rand(0.7, 2.2)
    });
  }

  function newWorm(col, big = false, special = null) {
    const type = ["DRIFTER", "ORBITER", "HUNTER"][randi(0, 2)];
    const segCount = big ? randi(18, 30) : randi(12, 20);
    const baseLen = big ? rand(10, 16) : rand(7, 12);

    // spawn around colony
    const spawnAng = rand(0, Math.PI * 2);
    const spawnRad = rand(60, 150);
    let px = col.x + Math.cos(spawnAng) * spawnRad;
    let py = col.y + Math.sin(spawnAng) * spawnRad;

    // random heading
    let ang = rand(0, Math.PI * 2);

    // palettes
    const paletteShift = rand(-160, 160);
    const hueBase = (col.dna.hue + paletteShift + 360) % 360;

    const w = {
      id: Math.random().toString(16).slice(2, 6),
      type,
      hue: hueBase,
      width: big ? rand(7, 12) : rand(4.4, 7.2),
      speed: big ? rand(0.36, 0.78) : rand(0.48, 1.08),
      turn: rand(0.010, 0.026) * col.dna.chaos,
      phase: rand(0, Math.PI * 2),

      orbitDir: Math.random() < 0.5 ? -1 : 1,
      roamBias: rand(0.12, 0.34),

      pat: {
        stripe: Math.random() < 0.75,
        dots: Math.random() < 0.45,
        dual: Math.random() < 0.45,
        hue2: (hueBase + rand(40, 150)) % 360,
        sparkle: Math.random() < 0.35,
      },

      limbs: [],
      segs: [],
      isBoss: false,
      special: special || null,

      // boss FX
      bossPulse: rand(0, 9999),
      sparks: [],
      breath: [],
      shards: [],

      // NEW: better movement state
      goal: { x: col.x + rand(-120, 120), y: col.y + rand(-120, 120) },
      goalT: rand(0.8, 2.2),      // seconds to next goal
      mood: rand(0, 1),           // changes how wild it is
      burstT: 0,                  // short speed burst timer
      fearT: 0,                   // temporary avoidance if too centered
      zig: rand(0, 9999),         // noise phase
      traveling: false,           // used by migrant worms
    };

    for (let i = 0; i < segCount; i++) {
      w.segs.push({ x: px, y: py, a: ang, len: baseLen * rand(0.85, 1.22) });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.35, 0.35) * col.dna.chaos;
    }

    const limbChance = clamp(0.10 + col.dna.limbiness * 0.22, 0.12, 0.58);
    if (Math.random() < limbChance) addLimb(w, big);

    // special tuning
    if (special === "SOL_STORM") {
      w.isBoss = true;
      w.width *= 2.1;
      w.speed *= 0.95;
      w.hue = 175;
      w.pat.hue2 = 285;
      w.pat.sparkle = true;
      w.mood = 1.0;
      for (let i = 0; i < 6; i++) addLimb(w, true);
    } else if (special === "FIRE_DOGE") {
      w.isBoss = true;
      w.width *= 1.95;
      w.speed *= 0.98;
      w.hue = 22;
      w.pat.hue2 = 55;
      w.pat.sparkle = true;
      w.mood = 0.95;
      for (let i = 0; i < 6; i++) addLimb(w, true);
    } else if (special === "ICE_QUEEN") {
      w.isBoss = true;
      w.width *= 2.2;
      w.speed *= 0.90;
      w.hue = 200;
      w.pat.hue2 = 265;
      w.pat.sparkle = true;
      w.mood = 0.85;
      for (let i = 0; i < 7; i++) addLimb(w, true);
    }

    return w;
  }

  // =========================
  // World state
  // =========================
  const colonies = [newColony(0, 0, 150)];
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], true));

  // NEW: migrations (worms that travel to create a new colony)
  const migrations = []; // { fromIdx, worm, tx, ty, prog, trail[] }

  // =========================
  // Inspector
  // =========================
  let inspectorCollapsed = false;

  function updateInspector() {
    const c = colonies[selected];
    if (!c || !inspector) return;

    if (elSelName) elSelName.textContent = `Colony #${selected + 1} • ${c.id}`;
    if (elDnaVal) elDnaVal.textContent = makeDnaCode(c);
    if (elTempVal) elTempVal.textContent = c.dna.temperament;
    if (elBiomeVal) elBiomeVal.textContent = c.dna.biome;
    if (elStyleVal) elStyleVal.textContent = c.dna.style;

    if (mutListEl) {
      mutListEl.innerHTML = "";
      const list = c.mutHistory.slice(0, 8);
      if (!list.length) {
        const d = document.createElement("div");
        d.className = "mutItem";
        d.textContent = "No mutations yet.";
        mutListEl.appendChild(d);
      } else {
        for (const line of list) {
          const d = document.createElement("div");
          d.className = "mutItem";
          d.textContent = line;
          mutListEl.appendChild(d);
        }
      }
    }
  }

  if (btnToggleInspector && inspectorBody) {
    btnToggleInspector.addEventListener("click", () => {
      inspectorCollapsed = !inspectorCollapsed;
      inspectorBody.style.display = inspectorCollapsed ? "none" : "block";
      btnToggleInspector.textContent = inspectorCollapsed ? "▸" : "▾";
    });
  }

  // =========================
  // Shockwaves + particles
  // =========================
  function shockwave(col, strength = 1, hueOverride = null) {
    col.shock.push({
      r: 0,
      v: 2.8 + strength * 1.5,
      a: 0.95,
      w: 2 + strength * 1.4,
      hue: hueOverride
    });
    playSfx("shock", strength);
  }

  // =========================
  // Flow field (global drift breaker)
  // =========================
  function flowAngle(x, y, time) {
    const t = time * 0.00025;
    const nx = x * 0.0022;
    const ny = y * 0.0022;
    return (
      Math.sin(nx + t) * 1.2 +
      Math.cos(ny - t * 1.3) * 1.0 +
      Math.sin((nx + ny) * 0.7 + t * 1.8) * 0.8
    );
  }

  // =========================
  // Drawing helpers
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
      ctx.lineWidth = width + 7;
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

  // BIG boss visuals (more extreme)
  function drawBossFX(w, time) {
    const head = w.segs[0];
    if (!head) return;

    const pulse = 0.5 + 0.5 * Math.sin(time * 0.003 + w.bossPulse);
    const ringR = 18 + w.width * 1.2 + pulse * 8;

    ctx.globalCompositeOperation = "lighter";

    // huge outer aura
    aura(head.x, head.y, ringR * 4.0, w.hue, 0.07 + pulse * 0.04);
    aura(head.x, head.y, ringR * 2.4, (w.hue + 70) % 360, 0.05 + pulse * 0.03);

    // crown ring
    ctx.strokeStyle = `hsla(${w.hue}, 95%, 72%, ${0.45 + pulse * 0.30})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(head.x, head.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // spikes
    ctx.strokeStyle = `hsla(${(w.hue + 90) % 360}, 95%, 78%, ${0.28 + pulse * 0.30})`;
    ctx.lineWidth = 1.9;
    const spikes = 14;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const x1 = head.x + Math.cos(a) * ringR;
      const y1 = head.y + Math.sin(a) * ringR;
      const x2 = head.x + Math.cos(a) * (ringR + 10 + pulse * 7);
      const y2 = head.y + Math.sin(a) * (ringR + 10 + pulse * 7);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // sparks
    if (!w.__sparkT) w.__sparkT = 0;
    if (time - w.__sparkT > rand(70, 140)) {
      w.__sparkT = time;
      const count = randi(6, 11);
      for (let i = 0; i < count; i++) {
        w.sparks.push({
          x: head.x + rand(-14, 14),
          y: head.y + rand(-14, 14),
          vx: rand(-2.2, 2.2),
          vy: rand(-2.2, 2.2),
          a: rand(0.55, 0.95),
          h: (w.hue + rand(-55, 55) + 360) % 360
        });
      }
    }
    for (const s of w.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.90;
      s.vy *= 0.90;
      s.a *= 0.88;
      ctx.strokeStyle = `hsla(${s.h}, 95%, 78%, ${s.a})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + rand(-8, 8), s.y + rand(-8, 8));
      ctx.stroke();
    }
    w.sparks = w.sparks.filter(s => s.a > 0.06);

    ctx.globalCompositeOperation = "source-over";

    // label
    ctx.font = "900 12px system-ui, -apple-system, Inter, sans-serif";
    ctx.fillStyle = "rgba(235,245,255,.92)";
    const label =
      w.special === "SOL_STORM" ? "SOLANA STORM" :
      w.special === "FIRE_DOGE" ? "FIRE DOGE" :
      w.special === "ICE_QUEEN" ? "ICE QUEEN" : "BOSS";
    ctx.fillText(label, head.x + 16, head.y - 16);
  }

  function drawWorm(w, time) {
    const pts = w.segs;
    if (!pts.length) return;

    const glowA = w.isBoss
      ? `hsla(${w.hue}, 95%, 65%, .42)`
      : `hsla(${w.hue}, 95%, 65%, .14)`;

    if (!isInteracting) {
      strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .92)`, glowA);
    } else {
      strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .92)`, null);
    }

    // patterns (skip heavy detail while interacting)
    if (!isInteracting) {
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        const t = i / Math.max(1, pts.length - 1);
        const stripeOn = w.pat.stripe && (i % 6 < 3);
        const useHue = (w.pat.dual && stripeOn) ? w.pat.hue2 : w.hue;

        const r = Math.max(1.6, w.width * (0.30 + 0.18 * Math.sin(t * 10 + w.phase)));
        ctx.fillStyle = `hsla(${useHue}, 95%, ${stripeOn ? 70 : 62}%, .85)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (w.pat.dots && (i % 8 === 0)) {
          ctx.fillStyle = `hsla(${(useHue + 30) % 360}, 95%, 78%, .75)`;
          ctx.beginPath();
          ctx.arc(
            p.x + Math.sin(t * 8 + time * 0.003) * 2,
            p.y + Math.cos(t * 8 + time * 0.003) * 2,
            r * 0.55,
            0, Math.PI * 2
          );
          ctx.fill();
        }

        if (w.pat.sparkle && (i % 10 === 0)) {
          ctx.strokeStyle = `hsla(${(useHue + 90) % 360}, 95%, 88%, .25)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y);
          ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3);
          ctx.stroke();
        }
      }
    }

    // limbs
    if (w.limbs?.length) {
      ctx.globalCompositeOperation = isInteracting ? "source-over" : "lighter";
      for (const L of w.limbs) {
        const at = clamp(L.at, 0, pts.length - 1);
        const base = pts[at];
        const baseAng =
          (pts[at]?.a || 0) +
          L.ang +
          Math.sin(time * 0.002 * L.wob + w.phase) * 0.35;

        const lx = base.x + Math.cos(baseAng) * L.len;
        const ly = base.y + Math.sin(baseAng) * L.len;

        ctx.strokeStyle = `hsla(${(w.hue + 40) % 360}, 95%, 66%, ${isInteracting ? 0.30 : 0.60})`;
        ctx.lineWidth = Math.max(2, w.width * 0.38);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(
          base.x + Math.cos(baseAng) * (L.len * 0.55),
          base.y + Math.sin(baseAng) * (L.len * 0.55),
          lx, ly
        );
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // boss attention FX
    if (w.isBoss && !isInteracting) drawBossFX(w, time);

    // fire breath particles
    if (w.special === "FIRE_DOGE" && w.breath.length) {
      ctx.globalCompositeOperation = "lighter";
      for (const p of w.breath) {
        ctx.fillStyle = `hsla(${p.h}, 95%, 65%, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // ice shards
    if (w.special === "ICE_QUEEN" && w.shards.length) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(200,240,255,.45)";
      ctx.lineWidth = 1.2;
      for (const s of w.shards) {
        ctx.strokeStyle = `hsla(${s.h}, 95%, 80%, ${s.a})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.vx * 3.2, s.y + s.vy * 3.2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawColony(col, time) {
    const hue = col.dna.hue;

    if (!isInteracting) {
      aura(col.x, col.y, 190 * col.dna.aura, hue, 0.16);
      aura(col.x, col.y, 140 * col.dna.aura, (hue + 40) % 360, 0.10);
      aura(col.x, col.y, 95 * col.dna.aura, (hue + 110) % 360, 0.06);
    } else {
      aura(col.x, col.y, 145 * col.dna.aura, hue, 0.12);
    }

    // outline
    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, .28)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < col.outline.length; i++) {
      const o = col.outline[i];
      const wob = Math.sin(time * 0.0014 + o.a * 3 + col.dna.seed) * 8;
      const r = o.r + wob;
      const px = col.x + Math.cos(o.a) * r;
      const py = col.y + Math.sin(o.a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // selected ring
    if (colonies[selected] === col) {
      ctx.strokeStyle = `hsla(${hue}, 95%, 65%, .55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(col.x, col.y, 105 * col.dna.aura, 0, Math.PI * 2);
      ctx.stroke();
    }

    // shock rings
    for (const s of col.shock) {
      const hh = (s.hue ?? hue);
      ctx.strokeStyle = `hsla(${hh}, 92%, 62%, ${s.a})`;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.arc(col.x, col.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // freeze aura
    if (col.freezeT > 0) {
      ctx.globalCompositeOperation = "lighter";
      aura(col.x, col.y, 240 * col.dna.aura, 200, 0.12 * clamp(col.freezeT / 2.6, 0, 1));
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawMigration(m, time) {
    // draw a faint trail so it feels like travel
    if (m.trail.length) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `hsla(${m.worm.hue},95%,70%,.18)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.trail[0].x, m.trail[0].y);
      for (let i = 1; i < m.trail.length; i++) ctx.lineTo(m.trail[i].x, m.trail[i].y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    drawWorm(m.worm, time);
  }

  // =========================
  // Better worm movement (unpredictable)
  // =========================
  function pickNewGoal(col, w) {
    // goals are NOT center-locked: they roam the ring and occasionally spike outward
    const baseR = 160 + 90 * col.dna.aura;
    const ring = baseR + rand(-80, 160) + (w.isBoss ? rand(40, 220) : 0);

    // sometimes “break out” farther
    const breakout = (Math.random() < (0.10 + w.mood * 0.12)) ? rand(140, 420) : 0;

    const a = rand(0, Math.PI * 2);
    w.goal.x = col.x + Math.cos(a) * (ring + breakout);
    w.goal.y = col.y + Math.sin(a) * (ring + breakout);

    // hunters sometimes aim near another worm to create swirl chaos
    if (w.type === "HUNTER" && col.worms.length > 2 && Math.random() < 0.35) {
      const other = col.worms[randi(0, col.worms.length - 1)];
      if (other && other.segs[0] && other !== w) {
        w.goal.x = other.segs[0].x + rand(-140, 140);
        w.goal.y = other.segs[0].y + rand(-140, 140);
      }
    }

    // next goal timing
    const wild = 0.65 + w.mood * 0.85 + (w.isBoss ? 0.35 : 0);
    w.goalT = rand(0.55, 1.45) / wild + rand(0.05, 0.45);
  }

  function avoidOthers(col, w, head) {
    // simple separation so they don’t stack in the middle
    let ax = 0, ay = 0, hits = 0;
    const radius = w.isBoss ? 90 : 55;
    const r2 = radius * radius;

    for (let i = 0; i < col.worms.length; i++) {
      const o = col.worms[i];
      if (o === w) continue;
      const oh = o.segs[0];
      if (!oh) continue;
      const d2 = dist2(head.x, head.y, oh.x, oh.y);
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 1;
        ax += (head.x - oh.x) / d;
        ay += (head.y - oh.y) / d;
        hits++;
      }
    }
    if (!hits) return { x: 0, y: 0 };
    const n = norm(ax, ay);
    return { x: n.x, y: n.y };
  }

  function wormBehavior(col, w, time, dt) {
    const head = w.segs[0];
    if (!head) return;

    // colony freeze slows
    const freezeSlow = col.freezeT > 0 ? 0.62 : 1.0;

    // keep goals changing
    w.goalT -= dt;
    if (w.goalT <= 0) pickNewGoal(col, w);

    // “burst” makes movement spiky / unpredictable
    if (w.burstT > 0) w.burstT -= dt;
    if (Math.random() < (0.010 + w.mood * 0.010) * dt * 60) {
      w.burstT = rand(0.15, 0.45);
    }

    // center avoidance if stuck too near center too long
    const dToCenter = Math.hypot(head.x - col.x, head.y - col.y);
    if (dToCenter < 95 && Math.random() < 0.06 * dt * 60) w.fearT = rand(0.35, 0.85);
    if (w.fearT > 0) w.fearT -= dt;

    // core steering vectors
    const toGoal = { x: w.goal.x - head.x, y: w.goal.y - head.y };
    const ng = norm(toGoal.x, toGoal.y);

    const fieldA = flowAngle(head.x, head.y, time);
    const field = { x: Math.cos(fieldA), y: Math.sin(fieldA) };

    const sep = avoidOthers(col, w, head);

    // orbit tendency around colony, but not constant circle
    const toCol = { x: col.x - head.x, y: col.y - head.y };
    const nc = norm(toCol.x, toCol.y);
    const tangent = { x: -nc.y * w.orbitDir, y: nc.x * w.orbitDir };

    // mix weights by type
    let wg = 0.65, wf = 0.18, wo = 0.18, ws = 0.35;
    if (w.type === "ORBITER") { wo = 0.34; wg = 0.52; }
    if (w.type === "DRIFTER") { wf = 0.28; wo = 0.12; wg = 0.52; }
    if (w.type === "HUNTER") { wg = 0.72; ws = 0.45; wo = 0.22; }

    // bosses get a bit more chaotic + outward travel
    if (w.isBoss) { wf += 0.08; wo += 0.08; wg += 0.05; }

    // fear pushes outward from center
    const fearPush = w.fearT > 0 ? { x: -nc.x, y: -nc.y } : { x: 0, y: 0 };

    // noise wiggle
    w.zig += dt * (0.6 + w.mood);
    const wig = {
      x: Math.cos(w.zig * 3.2) * 0.22 + Math.sin(w.zig * 1.8) * 0.18,
      y: Math.sin(w.zig * 3.0) * 0.22 + Math.cos(w.zig * 2.0) * 0.18
    };

    // blend
    let sx =
      ng.x * wg +
      field.x * wf +
      tangent.x * wo +
      sep.x * ws +
      fearPush.x * 0.75 +
      wig.x * 0.55;

    let sy =
      ng.y * wg +
      field.y * wf +
      tangent.y * wo +
      sep.y * ws +
      fearPush.y * 0.75 +
      wig.y * 0.55;

    const s = norm(sx, sy);

    const desired = Math.atan2(s.y, s.x);

    // turn speed
    const baseTurn = w.turn * (0.85 + 0.35 * Math.sin(time * 0.001 + w.phase));
    const chaosKick = (Math.random() - 0.5) * baseTurn * (0.45 + w.mood * 0.35);
    head.a = lerpAngle(head.a, desired, clamp(baseTurn * 10.0, 0.08, 0.26));
    head.a += chaosKick;

    // speed
    const boost = w.isBoss ? 1.35 : 1.0;
    const burst = w.burstT > 0 ? 1.55 : 1.0;
    const typeBoost = (w.type === "HUNTER") ? 1.18 : (w.type === "DRIFTER" ? 1.10 : 1.0);

    const sp = w.speed * 2.05 * boost * burst * typeBoost * freezeSlow;

    head.x += Math.cos(head.a) * sp accompanyingDrag(col, w, head, dt);
    head.y += Math.sin(head.a) * sp;

    // leash: allow wider roaming, but keep connected to colony
    const leash = (w.isBoss ? 520 : 360) + 90 * col.dna.aura;
    if (dToCenter > leash) {
      // steer back without snapping
      const back = Math.atan2(col.y - head.y, col.x - head.x);
      head.a = lerpAngle(head.a, back, 0.18);
      head.x = lerp(head.x, col.x, 0.012);
      head.y = lerp(head.y, col.y, 0.012);
      // also choose a nearer goal
      pickNewGoal(col, w);
    }

    // segments follow (smoother tail)
    for (let i = 1; i < w.segs.length; i++) {
      const prev = w.segs[i - 1];
      const seg = w.segs[i];

      const vx = seg.x - prev.x;
      const vy = seg.y - prev.y;
      const ang = Math.atan2(vy, vx);

      const targetX = prev.x + Math.cos(ang) * seg.len;
      const targetY = prev.y + Math.sin(ang) * seg.len;

      const tight = 0.78 + (w.isBoss ? 0.04 : 0) + Math.sin(time * 0.001 + i) * 0.02;
      seg.x = seg.x * (1 - tight) + targetX * tight;
      seg.y = seg.y * (1 - tight) + targetY * tight;
      seg.a = ang;
    }

    // boss specials every 15–20 seconds
    if (w.isBoss) bossSpecials(col, w, time);

    // FIRE DOGE breath particles update
    if (w.special === "FIRE_DOGE") {
      for (const p of w.breath) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.a *= 0.94;
        p.r *= 0.985;
      }
      w.breath = w.breath.filter(p => p.a > 0.05 && p.r > 0.6);
    }

    // ICE shards update
    if (w.special === "ICE_QUEEN") {
      for (const s2 of w.shards) {
        s2.x += s2.vx;
        s2.y += s2.vy;
        s2.vx *= 0.985;
        s2.vy *= 0.985;
        s2.a *= 0.94;
      }
      w.shards = w.shards.filter(s2 => s2.a > 0.06);
    }
  }

  // tiny drag for head to reduce straight-line “laser” motion
  function accompanyingDrag(col, w, head, dt) {
    // subtle: bosses less drag so they feel aggressive
    const drag = w.isBoss ? 0.006 : 0.010;
    head.x -= (head.x - col.x) * drag * dt * 60;
    head.y -= (head.y - col.y) * drag * dt * 60;
    return 0;
  }

  // =========================
  // Boss “crazy move” every 15-20 seconds
  // =========================
  function bossSpecials(col, w, time) {
    if (!w.__nextBossAct) w.__nextBossAct = time + rand(15000, 20000);
    if (time < w.__nextBossAct) return;

    w.__nextBossAct = time + rand(15000, 20000);

    const head = w.segs[0];
    if (!head) return;

    // world shake always
    addShake(w.special === "SOL_STORM" ? 18 : w.special === "FIRE_DOGE" ? 22 : 16, 0.38);
    addFlash(w.special === "SOL_STORM" ? 0.28 : 0.20);

    if (w.special === "SOL_STORM") {
      // chain shockwaves + lightning burst
      for (let k = 0; k < 5; k++) {
        setTimeout(() => {
          shockwave(col, 2.35 - k * 0.22, 175);
        }, k * 80);
      }
      pushLog("boss", "⚡ SOLANA STORM: Reality cracks — chain shockwave + lightning!");
      playSfx("storm", 1.35);

      // extra sparks storm
      for (let i = 0; i < 40; i++) {
        w.sparks.push({
          x: head.x + rand(-26, 26),
          y: head.y + rand(-26, 26),
          vx: rand(-4.0, 4.0),
          vy: rand(-4.0, 4.0),
          a: rand(0.65, 1.0),
          h: (175 + rand(-30, 35) + 360) % 360
        });
      }

    } else if (w.special === "FIRE_DOGE") {
      // huge breath cone
      pushLog("boss", "🔥 FIRE DOGE: Inferno breath — massive blast!");
      playSfx("fire", 1.4);
      shockwave(col, 2.35, 22);

      const dir = head.a;
      const hx = head.x, hy = head.y;

      // spawn lots of fire particles
      const N = 160;
      for (let k = 0; k < N; k++) {
        const spread = rand(-0.65, 0.65);
        const a = dir + spread;
        const sp = rand(3.2, 7.6);
        w.breath.push({
          x: hx + Math.cos(a) * rand(10, 30) + rand(-10, 10),
          y: hy + Math.sin(a) * rand(10, 30) + rand(-10, 10),
          vx: Math.cos(a) * sp + rand(-0.8, 0.8),
          vy: Math.sin(a) * sp + rand(-0.8, 0.8),
          r: rand(2.8, 6.8),
          a: rand(0.55, 0.95),
          h: rand(8, 48)
        });
      }

    } else if (w.special === "ICE_QUEEN") {
      // freeze pulse + shards + stronger colony freeze
      pushLog("boss", "❄️ ICE QUEEN: Blizzard pulse — colony freezes and shards explode!");
      playSfx("ice", 1.3);
      col.freezeT = Math.max(col.freezeT, 3.2);
      shockwave(col, 2.4, 200);

      // shards
      const N = 120;
      for (let k = 0; k < N; k++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(2.2, 6.0);
        w.shards.push({
          x: head.x + rand(-18, 18),
          y: head.y + rand(-18, 18),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          a: rand(0.55, 0.95),
          h: rand(185, 225)
        });
      }
    } else {
      // generic boss
      pushLog("boss", "👑 BOSS: Shockwave surge!");
      shockwave(col, 2.0, w.hue);
    }
  }

  // =========================
  // Mutations
  // =========================
  let mutTimer = 0;
  let spawnTimer = 0;

  function addMutationToColony(c, msg) {
    c.mutHistory.unshift(msg);
    if (c.mutHistory.length > 14) c.mutHistory.length = 14;
    if (c === colonies[selected]) updateInspector();
  }

  function mutateRandom() {
    const c = colonies[randi(0, colonies.length - 1)];
    if (!c?.worms?.length) return;
    const w = c.worms[randi(0, c.worms.length - 1)];

    const roll = Math.random();
    let msg = "";

    if (roll < 0.18) {
      w.hue = (w.hue + rand(40, 160)) % 360;
      w.pat.hue2 = (w.hue + rand(40, 150)) % 360;
      msg = `Color morph • Worm ${w.id}`;
    } else if (roll < 0.34) {
      w.speed *= rand(1.05, 1.30);
      w.mood = clamp(w.mood + rand(0.08, 0.22), 0, 1.2);
      msg = `Aggression spike • Worm ${w.id}`;
    } else if (roll < 0.50) {
      w.width = clamp(w.width * rand(1.05, 1.35), 3.5, 22);
      msg = `Body growth • Worm ${w.id}`;
    } else if (roll < 0.66) {
      w.turn *= rand(1.10, 1.45);
      msg = `Turn instability • Worm ${w.id}`;
    } else if (roll < 0.80) {
      w.pat.stripe = !w.pat.stripe;
      w.pat.dots = !w.pat.dots;
      msg = `Pattern shift • Worm ${w.id}`;
    } else {
      addLimb(w, Math.random() < 0.45);
      msg = `Limb growth • Worm ${w.id}`;
    }

    addMutationToColony(c, msg);
    pushLog("mut", msg);
    playSfx("mut", 1);
    if (Math.random() < 0.25) shockwave(c, 0.9);
  }

  function maybeSpawnWorms(dt) {
    const g = growthScore();
    const target = clamp(Math.floor(3 + g * 2.1), 3, 120);

    const total = colonies.reduce((a, c) => a + c.worms.length, 0) + migrations.length;
    if (total >= target) return;

    spawnTimer += dt;
    const rate = clamp(1.2 - g * 0.035, 0.12, 1.2);
    if (spawnTimer >= rate) {
      spawnTimer = 0;
      const c = colonies[selected] || colonies[0];
      c.worms.push(newWorm(c, Math.random() < 0.18));
      if (Math.random() < 0.22) shockwave(c, 0.55);
      pushLog("event", "New worm hatched");
    }
  }

  // =========================
  // Colony spawning by MC — NOW via worm travel (migration)
  // =========================
  function startMigrationForNewColony(targetMcap) {
    if (colonies.length >= MAX_COLONIES) return;

    // source colony: selected (feels intentional), else first
    const fromIdx = clamp(selected, 0, colonies.length - 1);
    const from = colonies[fromIdx];
    if (!from || from.worms.length < 2) return;

    // pick a non-boss worm if possible (bosses stay home)
    let wormIdx = from.worms.findIndex(w => !w.isBoss);
    if (wormIdx === -1) wormIdx = 0;

    const worm = from.worms.splice(wormIdx, 1)[0];
    if (!worm) return;

    worm.traveling = true;

    // decide target location relative to colony 0 (keeps world clustered)
    const base = colonies[0];
    const ang = rand(0, Math.PI * 2);
    const dist = rand(520, 820) + rand(-60, 120) * growthScore();
    const tx = base.x + Math.cos(ang) * dist;
    const ty = base.y + Math.sin(ang) * dist;

    // set worm head to start from source colony
    const h = worm.segs[0];
    if (h) {
      h.x = from.x + rand(-30, 30);
      h.y = from.y + rand(-30, 30);
    }

    migrations.push({
      fromIdx,
      worm,
      tx,
      ty,
      bornAt: performance.now(),
      trail: [],
      tag: fmt(targetMcap)
    });

    pushLog("event", `Scouting worm departed to form a new colony (${fmt(targetMcap)} MC)`);
    shockwave(from, 1.05);
  }

  function stepMigrations(time, dt) {
    if (!migrations.length) return;

    for (let i = migrations.length - 1; i >= 0; i--) {
      const m = migrations[i];
      const w = m.worm;
      const h = w.segs[0];
      if (!h) { migrations.splice(i, 1); continue; }

      // steer toward target with noise + flow
      const toT = { x: m.tx - h.x, y: m.ty - h.y };
      const d = Math.hypot(toT.x, toT.y);

      const nT = norm(toT.x, toT.y);
      const fieldA = flowAngle(h.x, h.y, time);
      const field = { x: Math.cos(fieldA), y: Math.sin(fieldA) };

      w.zig += dt * 1.2;
      const wig = { x: Math.cos(w.zig * 2.6) * 0.35, y: Math.sin(w.zig * 2.4) * 0.35 };

      const sx = nT.x * 0.78 + field.x * 0.18 + wig.x * 0.35;
      const sy = nT.y * 0.78 + field.y * 0.18 + wig.y * 0.35;
      const s = norm(sx, sy);
      const desired = Math.atan2(s.y, s.x);

      h.a = lerpAngle(h.a, desired, 0.20);

      const sp = (w.speed * 2.7) * (w.isBoss ? 1.0 : 1.12);
      h.x += Math.cos(h.a) * sp;
      h.y += Math.sin(h.a) * sp;

      // tail follows (same follow logic)
      for (let k = 1; k < w.segs.length; k++) {
        const prev = w.segs[k - 1];
        const seg = w.segs[k];
        const vx = seg.x - prev.x;
        const vy = seg.y - prev.y;
        const ang = Math.atan2(vy, vx);
        const tx2 = prev.x + Math.cos(ang) * seg.len;
        const ty2 = prev.y + Math.sin(ang) * seg.len;
        seg.x = seg.x * 0.22 + tx2 * 0.78;
        seg.y = seg.y * 0.22 + ty2 * 0.78;
        seg.a = ang;
      }

      // trail
      if (!isInteracting) {
        m.trail.push({ x: h.x, y: h.y });
        if (m.trail.length > 46) m.trail.shift();
      } else if (m.trail.length > 24) {
        m.trail.length = 24;
      }

      // arrival -> create new colony
      if (d < 55) {
        const from = colonies[m.fromIdx] || colonies[0];
        const baseHue = (from?.dna?.hue ?? 160);
        const nc = newColony(m.tx, m.ty, (baseHue + rand(-100, 100) + 360) % 360);

        // migrant worm becomes founder
        w.traveling = false;
        nc.worms.push(w);

        // starter worms
        const g = growthScore();
        const starters = clamp(Math.floor(2 + g / 2), 2, 7);
        for (let s2 = 0; s2 < starters; s2++) nc.worms.push(newWorm(nc, Math.random() < 0.25));

        colonies.push(nc);
        shockwave(nc, 1.25);
        pushLog("event", `New colony formed by migration worm at ${m.tag}`);
        playSfx("storm", 0.9);

        migrations.splice(i, 1);
      }
    }
  }

  // =========================
  // Colonies spawning by MC trigger
  // =========================
  function trySplitByMcap() {
    while (mcap >= nextSplitAt && colonies.length < MAX_COLONIES) {
      // Instead of instantly appearing: send a worm to build it.
      startMigrationForNewColony(nextSplitAt);
      nextSplitAt += MC_STEP;
    }
  }

  // =========================
  // Milestones
  // =========================
  function checkMilestones() {
    if (!milestone50k.hit && mcap >= 50000) {
      milestone50k.hit = true;
      const c = colonies[0];
      const stormBoss = newWorm(c, true, "SOL_STORM");
      c.worms.push(stormBoss);
      shockwave(c, 2.0, 175);
      pushLog("boss", "⚡ 50k Milestone: Solana Storm Worm has formed!");
      playSfx("storm", 1.2);
      addShake(14, 0.25);
      addFlash(0.22);
    }

    if (!milestone100k.hit && mcap >= 100000) {
      milestone100k.hit = true;
      const c = colonies[0];
      const fire = newWorm(c, true, "FIRE_DOGE");
      c.worms.push(fire);
      shockwave(c, 2.0, 22);
      pushLog("mile", "🔥 100k Milestone: Fire-Breathing Doge Worm has arrived!");
      playSfx("fire", 1.2);
      addShake(16, 0.25);
    }

    if (!milestone250k.hit && mcap >= 250000) {
      milestone250k.hit = true;
      const c = colonies[0];
      const queen = newWorm(c, true, "ICE_QUEEN");
      c.worms.push(queen);

      c.freezeT = 2.6;
      shockwave(c, 2.2, 200);
      pushLog("mile", "❄️ 250k Milestone: Ice Queen hatch — the colony chills!");
      playSfx("ice", 1.2);
      addShake(14, 0.25);
    }
  }

  // =========================
  // Controls (same mechanics)
  // =========================
  function bind(action, fn) {
    const btn = document.querySelector(`button[data-action="${action}"]`);
    if (btn) btn.addEventListener("click", () => { ensureAudio(); fn(); });
  }

  bind("feed", () => { volume += rand(20, 90); mcap += rand(120, 460); });
  bind("smallBuy", () => {
    buyers += 1;
    const dv = rand(180, 900), dm = rand(900, 3200);
    volume += dv; mcap += dm;
  });
  bind("whaleBuy", () => {
    const b = randi(2, 5);
    const dv = rand(2500, 8500), dm = rand(9000, 22000);
    buyers += b; volume += dv; mcap += dm;
    shockwave(colonies[0], 1.2);
    addShake(8, 0.18);
  });
  bind("sell", () => {
    const dv = rand(600, 2600), dm = rand(2200, 9000);
    volume = Math.max(0, volume - dv);
    mcap = Math.max(0, mcap - dm);
  });
  bind("storm", () => {
    const dv = rand(5000, 18000), dm = rand(2000, 8000);
    volume += dv; mcap += dm;
    shockwave(colonies[0], 1.0);
    addShake(10, 0.20);
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
      const total = colonies.reduce((a, c) => a + c.worms.length, 0) + migrations.length;
      elWorms.textContent = String(total);
    }
  }

  // =========================
  // Auto mutation cadence
  // =========================
  function autoMutations(dt) {
    mutTimer += dt;
    const g = growthScore();
    const mutRate = clamp(2.2 - g * 0.07, 0.35, 2.2);
    if (mutTimer >= mutRate) {
      mutTimer = 0;
      if (Math.random() < 0.65) mutateRandom();
    }
  }

  // =========================
  // Main step/render
  // =========================
  function step(dt, time) {
    trySplitByMcap();
    checkMilestones();

    // colony drift
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

    // worms in colonies
    for (const c of colonies) {
      for (const w of c.worms) wormBehavior(c, w, time, dt);
    }

    // migrating worms
    stepMigrations(time, dt);

    if (focusOn) centerOnSelected(true);

    autoMutations(dt);
    maybeSpawnWorms(dt);

    // shake decay
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      shakeMag *= 0.90;
    } else {
      shakeMag *= 0.92;
    }
    flashA *= 0.92;

    updateStats();
  }

  let toastTick = 0;
  function render(time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // camera + shake
    const sh = shakeT > 0 ? (shakeMag * (shakeT / Math.max(0.001, shakeT))) : 0;
    const sx = shakeT > 0 ? rand(-sh, sh) : 0;
    const sy = shakeT > 0 ? rand(-sh, sh) : 0;

    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    for (const c of colonies) drawColony(c, time);
    for (const c of colonies) for (const w of c.worms) drawWorm(w, time);
    for (const m of migrations) drawMigration(m, time);

    ctx.restore();

    // flash overlay
    if (flashA > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${flashA})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }

    // keep these light (don’t update every frame)
    toastTick++;
    if (toast && toastTick % 25 === 0) toast.textContent = "Simulation Active ✓";
    if (elStatus && toastTick % 35 === 0) elStatus.textContent = "Simulation Active";
  }

  // =========================
  // Loop (capped render FPS)
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
    updateInspector();
    pushLog("event", "Simulation ready");

    if (toast) toast.textContent = "Loading…";
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
