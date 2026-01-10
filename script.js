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

  const milestone50k = { hit: false };
  const milestone100k = { hit: false };
  const milestone250k = { hit: false };

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
  // Background
  // =========================
  const bg = { canvas: document.createElement("canvas"), ctx: null, w: 0, h: 0 };
  bg.ctx = bg.canvas.getContext("2d");

  function makeStarfield() {
    bg.w = 900; bg.h = 900;
    bg.canvas.width = bg.w;
    bg.canvas.height = bg.h;

    const b = bg.ctx;
    b.clearRect(0, 0, bg.w, bg.h);

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

    for (let i = 0; i < 1400; i++) {
      const x = rand(0, bg.w), y = rand(0, bg.h);
      const r = Math.random() < 0.90 ? rand(0.3, 1.2) : rand(1.2, 2.2);
      const a = Math.random() < 0.92 ? rand(0.35, 0.75) : rand(0.75, 0.95);
      const hue = Math.random() < 0.85 ? 210 : rand(180, 320);
      b.fillStyle = `hsla(${hue}, 95%, 85%, ${a})`;
      b.beginPath();
      b.arc(x, y, r, 0, Math.PI * 2);
      b.fill();
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
      id, x, y,
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

    const spawnAng = rand(0, Math.PI * 2);
    const spawnRad = rand(60, 150);
    let px = col.x + Math.cos(spawnAng) * spawnRad;
    let py = col.y + Math.sin(spawnAng) * spawnRad;

    let ang = rand(0, Math.PI * 2);

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

      bossPulse: rand(0, 9999),
      sparks: [],
      breath: [],
      shards: [],

      goal: { x: col.x + rand(-120, 120), y: col.y + rand(-120, 120) },
      goalT: rand(0.8, 2.2),
      mood: rand(0, 1),
      burstT: 0,
      fearT: 0,
      zig: rand(0, 9999),
      traveling: false,
    };

    for (let i = 0; i < segCount; i++) {
      w.segs.push({ x: px, y: py, a: ang, len: baseLen * rand(0.85, 1.22) });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.35, 0.35) * col.dna.chaos;
    }

    const limbChance = clamp(0.10 + col.dna.limbiness * 0.22, 0.12, 0.58);
    if (Math.random() < limbChance) addLimb(w, big);

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

  const migrations = []; // traveling worms that create new colonies

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
  // Flow field
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
  }

  function drawColony(col, time) {
    const hue = col.dna.hue;

    aura(col.x, col.y, 190 * col.dna.aura, hue, isInteracting ? 0.12 : 0.16);

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

    if (colonies[selected] === col) {
      ctx.strokeStyle = `hsla(${hue}, 95%, 65%, .55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(col.x, col.y, 105 * col.dna.aura, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of col.shock) {
      const hh = (s.hue ?? hue);
      ctx.strokeStyle = `hsla(${hh}, 92%, 62%, ${s.a})`;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.arc(col.x, col.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (col.freezeT > 0) {
      ctx.globalCompositeOperation = "lighter";
      aura(col.x, col.y, 240 * col.dna.aura, 200, 0.12 * clamp(col.freezeT / 2.6, 0, 1));
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // =========================
  // Better worm movement (unpredictable)
  // =========================
  function pickNewGoal(col, w) {
    const baseR = 160 + 90 * col.dna.aura;
    const ring = baseR + rand(-80, 160) + (w.isBoss ? rand(40, 220) : 0);
    const breakout = (Math.random() < (0.10 + w.mood * 0.12)) ? rand(140, 420) : 0;

    const a = rand(0, Math.PI * 2);
    w.goal.x = col.x + Math.cos(a) * (ring + breakout);
    w.goal.y = col.y + Math.sin(a) * (ring + breakout);

    const wild = 0.65 + w.mood * 0.85 + (w.isBoss ? 0.35 : 0);
    w.goalT = rand(0.55, 1.45) / wild + rand(0.05, 0.45);
  }

  function avoidOthers(col, w, head) {
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
    return norm(ax, ay);
  }

  function accompanyingDrag(col, w, head, dt) {
    const drag = w.isBoss ? 0.006 : 0.010;
    head.x -= (head.x - col.x) * drag * dt * 60;
    head.y -= (head.y - col.y) * drag * dt * 60;
  }

  function wormBehavior(col, w, time, dt) {
    const head = w.segs[0];
    if (!head) return;

    const freezeSlow = col.freezeT > 0 ? 0.62 : 1.0;

    w.goalT -= dt;
    if (w.goalT <= 0) pickNewGoal(col, w);

    if (w.burstT > 0) w.burstT -= dt;
    if (Math.random() < (0.010 + w.mood * 0.010) * dt * 60) {
      w.burstT = rand(0.15, 0.45);
    }

    const dToCenter = Math.hypot(head.x - col.x, head.y - col.y);
    if (dToCenter < 95 && Math.random() < 0.06 * dt * 60) w.fearT = rand(0.35, 0.85);
    if (w.fearT > 0) w.fearT -= dt;

    const toGoal = { x: w.goal.x - head.x, y: w.goal.y - head.y };
    const ng = norm(toGoal.x, toGoal.y);

    const fieldA = flowAngle(head.x, head.y, time);
    const field = { x: Math.cos(fieldA), y: Math.sin(fieldA) };

    const sep = avoidOthers(col, w, head);

    const toCol = { x: col.x - head.x, y: col.y - head.y };
    const nc = norm(toCol.x, toCol.y);
    const tangent = { x: -nc.y * w.orbitDir, y: nc.x * w.orbitDir };

    let wg = 0.65, wf = 0.18, wo = 0.18, ws = 0.35;
    if (w.type === "ORBITER") { wo = 0.34; wg = 0.52; }
    if (w.type === "DRIFTER") { wf = 0.28; wo = 0.12; wg = 0.52; }
    if (w.type === "HUNTER") { wg = 0.72; ws = 0.45; wo = 0.22; }
    if (w.isBoss) { wf += 0.08; wo += 0.08; wg += 0.05; }

    const fearPush = w.fearT > 0 ? { x: -nc.x, y: -nc.y } : { x: 0, y: 0 };

    w.zig += dt * (0.6 + w.mood);
    const wig = {
      x: Math.cos(w.zig * 3.2) * 0.22 + Math.sin(w.zig * 1.8) * 0.18,
      y: Math.sin(w.zig * 3.0) * 0.22 + Math.cos(w.zig * 2.0) * 0.18
    };

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

    const baseTurn = w.turn * (0.85 + 0.35 * Math.sin(time * 0.001 + w.phase));
    const chaosKick = (Math.random() - 0.5) * baseTurn * (0.45 + w.mood * 0.35);
    head.a = lerpAngle(head.a, desired, clamp(baseTurn * 10.0, 0.08, 0.26));
    head.a += chaosKick;

    const boost = w.isBoss ? 1.35 : 1.0;
    const burst = w.burstT > 0 ? 1.55 : 1.0;
    const typeBoost = (w.type === "HUNTER") ? 1.18 : (w.type === "DRIFTER" ? 1.10 : 1.0);

    const sp = w.speed * 2.05 * boost * burst * typeBoost * freezeSlow;

    // ✅ FIXED: movement line that previously broke the sim
    head.x += Math.cos(head.a) * sp;
    accompanyingDrag(col, w, head, dt);
    head.y += Math.sin(head.a) * sp;

    const leash = (w.isBoss ? 520 : 360) + 90 * col.dna.aura;
    if (dToCenter > leash) {
      const back = Math.atan2(col.y - head.y, col.x - head.x);
      head.a = lerpAngle(head.a, back, 0.18);
      head.x = lerp(head.x, col.x, 0.012);
      head.y = lerp(head.y, col.y, 0.012);
      pickNewGoal(col, w);
    }

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
  }

  // =========================
  // Mutations + spawning (kept simple here)
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
    }
  }

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
  // Controls
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
  // Main step/render
  // =========================
  function step(dt, time) {
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

    mutTimer += dt;
    const g = growthScore();
    const mutRate = clamp(2.2 - g * 0.07, 0.35, 2.2);
    if (mutTimer >= mutRate) {
      mutTimer = 0;
      if (Math.random() < 0.65) mutateRandom();
    }

    maybeSpawnWorms(dt);

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

    const sh = shakeT > 0 ? shakeMag : 0;
    const sx = shakeT > 0 ? rand(-sh, sh) : 0;
    const sy = shakeT > 0 ? rand(-sh, sh) : 0;

    ctx.save();
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    for (const c of colonies) drawColony(c, time);
    for (const c of colonies) for (const w of c.worms) drawWorm(w, time);

    ctx.restore();

    if (flashA > 0.02) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${flashA})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }

    toastTick++;
    if (toast && toastTick % 25 === 0) toast.textContent = "Simulation Active ✓";
    if (elStatus && toastTick % 35 === 0) elStatus.textContent = "Simulation Active";
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
    updateInspector();
    pushLog("event", "Simulation ready");
    if (toast) toast.textContent = "Loading…";
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
