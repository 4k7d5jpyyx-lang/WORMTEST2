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

  // Inspector overlay (matches your current HTML ids)
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
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const fmt = (n) => "$" + Math.max(0, Math.round(n)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const lerp = (a, b, t) => a + (b - a) * t;

  // =========================
  // Canvas sizing
  // =========================
  let W = 1, H = 1, DPR = 1;
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
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
  // Event log
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
      badge === "boss" ? "BOSS" : "EVENT";

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
  // Toast (big notifications)
  // =========================
  let toastMsg = "Loading…";
  let toastT = 0;
  let toastHold = 0;

  function setToast(msg, holdMs = 1100) {
    toastMsg = msg;
    toastT = performance.now();
    toastHold = holdMs;
    if (toast) toast.textContent = msg;
  }

  function pulseBigToast(msg) {
    setToast(msg, 2400);
    // extra: shake + shock
    worldShake(14, 650);
  }

  // =========================
  // iOS-friendly audio
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
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    } else if (type === "ice") {
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.18, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    } else if (type === "storm") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(120, now);
      o.frequency.exponentialRampToValueAtTime(520, now + 0.10);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.28, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    } else if (type === "boss") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(180, now);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.26);
      n.frequency.setValueAtTime(260, now);
      n.frequency.exponentialRampToValueAtTime(90, now + 0.26);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.30, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      n.connect(g);
      n.start(now);
      n.stop(now + 0.34);
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

  // UPDATED caps
  const MAX_COLONIES = 500;
  const MAX_WORMS = 9999;

  const MC_STEP = 25000;
  let nextSplitAt = MC_STEP;

  // Milestones (original)
  const milestone50k = { hit: false };   // Solana Storm Worm
  const milestone100k = { hit: false };  // Fire Doge Worm
  const milestone250k = { hit: false };  // Ice Queen

  // Milestones (new bosses)
  const milestone500k = { hit: false };    // HYDRAWORM
  const milestone1m = { hit: false };      // MOONJUDGE WYRM
  const milestone1_5m = { hit: false };    // WHALE SUMMONER
  const milestone2m = { hit: false };      // BREAKER OF BOOKS
  const milestone2_5m = { hit: false };    // VIRAL VIPER WORM
  const milestone3m = { hit: false };      // PARABOLIC PHARAOHWORM
  const milestone3_5m = { hit: false };    // MEMELORD MEGAWORM
  const milestone4m = { hit: false };      // VALIDATOR VORTEX LEVIATHAN
  const milestone4_5m = { hit: false };    // EVENT HORIZON EEL
  const milestone5m = { hit: false };      // WYRM EMPEROR

  function growthScore() {
    return (mcap / 24000) + (volume / 7000) + (buyers / 12);
  }

  function totalWorms() {
    return colonies.reduce((a, c) => a + c.worms.length, 0);
  }

  function canAddWorms(n = 1) {
    return (totalWorms() + n) <= MAX_WORMS;
  }

  // =========================
  // Camera + interaction
  // =========================
  let camX = 0, camY = 0, zoom = 0.82;
  let dragging = false, lastX = 0, lastY = 0;
  let selected = 0;
  let focusOn = false;
  let isInteracting = false;

  // World shake
  let shakeMag = 0;
  let shakeEnd = 0;
  let shakeSeed = rand(0, 9999);

  function worldShake(mag = 10, ms = 520) {
    shakeMag = Math.max(shakeMag, mag);
    shakeEnd = performance.now() + ms;
    shakeSeed = rand(0, 9999);
  }

  function applyShake(timeMs) {
    if (timeMs > shakeEnd) return { sx: 0, sy: 0 };
    const t = timeMs * 0.024;
    const s = shakeMag * (0.6 + 0.4 * Math.sin(timeMs * 0.014));
    const sx = Math.sin(t + shakeSeed) * s;
    const sy = Math.cos(t * 1.13 - shakeSeed) * s;
    return { sx, sy };
  }

  function toWorld(px, py) {
    return {
      x: (px - W / 2) / zoom - camX,
      y: (py - H / 2) / zoom - camY
    };
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
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
  // Background
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
  // Colony / worm models
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

      // colony founding animation
      foundingT: 0,
    };
  }

  function addLimb(w, big = false) {
    if (!w.segs.length) return;
    const at = randi(2, w.segs.length - 3);
    w.limbs.push({
      at,
      len: big ? rand(40, 120) : rand(24, 82),
      ang: rand(-1.6, 1.6),
      wob: rand(0.7, 2.0)
    });
  }

  function newWorm(col, big = false, special = null) {
    const type = ["DRIFTER", "ORBITER", "HUNTER"][randi(0, 2)];
    const segCount = big ? randi(20, 34) : randi(12, 22);
    const baseLen = big ? rand(10, 16) : rand(7, 12);

    // spawn around colony
    const spawnAng = rand(0, Math.PI * 2);
    const spawnRad = rand(40, 140);
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
      speed: big ? rand(0.38, 0.84) : rand(0.52, 1.16),
      turn: rand(0.012, 0.028) * col.dna.chaos,
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

      // wandering brain
      wanderA: rand(0, Math.PI * 2),
      wanderT: rand(0, 9999),
      roamR: rand(120, 320),
      roamR2: rand(0, Math.PI * 2),
      huntT: 0,

      // colony founding travel state
      mission: null,
      trail: [],
    };

    for (let i = 0; i < segCount; i++) {
      w.segs.push({ x: px, y: py, a: ang, len: baseLen * rand(0.85, 1.22) });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.35, 0.35) * col.dna.chaos;
    }

    const limbChance = clamp(0.10 + col.dna.limbiness * 0.22, 0.12, 0.60);
    if (Math.random() < limbChance) addLimb(w, big);

    // =========================
    // Boss presets (old + new)
    // =========================
    const makeBoss = (opts) => {
      w.isBoss = true;
      w.width *= (opts.wMul ?? 2.0);
      w.speed *= (opts.sMul ?? 0.95);
      w.hue = opts.h1 ?? w.hue;
      w.pat.hue2 = opts.h2 ?? ((w.hue + 90) % 360);
      w.pat.sparkle = true;
      const limbN = opts.limbs ?? 7;
      for (let i = 0; i < limbN; i++) addLimb(w, true);
    };

    if (special === "SOL_STORM") {
      makeBoss({ wMul: 2.25, sMul: 0.95, h1: 175, h2: 285, limbs: 7 });
    } else if (special === "FIRE_DOGE") {
      makeBoss({ wMul: 2.15, sMul: 0.98, h1: 22, h2: 55, limbs: 7 });
    } else if (special === "ICE_QUEEN") {
      makeBoss({ wMul: 2.35, sMul: 0.92, h1: 200, h2: 265, limbs: 8 });
    }

    // NEW bosses
    else if (special === "HYDRAWORM") {
      makeBoss({ wMul: 2.55, sMul: 0.92, h1: 120, h2: 300, limbs: 10 });
    } else if (special === "MOONJUDGE") {
      makeBoss({ wMul: 2.75, sMul: 0.90, h1: 210, h2: 45, limbs: 9 });
    } else if (special === "WHALE_SUMMONER") {
      makeBoss({ wMul: 2.85, sMul: 0.88, h1: 190, h2: 260, limbs: 11 });
    } else if (special === "BREAKER_OF_BOOKS") {
      makeBoss({ wMul: 3.00, sMul: 0.90, h1: 35, h2: 5, limbs: 10 });
    } else if (special === "VIRAL_VIPER") {
      makeBoss({ wMul: 2.70, sMul: 0.94, h1: 310, h2: 110, limbs: 9 });
    } else if (special === "PARABOLIC_PHARAOH") {
      makeBoss({ wMul: 3.10, sMul: 0.88, h1: 48, h2: 180, limbs: 12 });
    } else if (special === "MEMELORD_MEGA") {
      makeBoss({ wMul: 3.25, sMul: 0.86, h1: 285, h2: 40, limbs: 12 });
    } else if (special === "VALIDATOR_VORTEX") {
      makeBoss({ wMul: 3.45, sMul: 0.84, h1: 170, h2: 210, limbs: 13 });
    } else if (special === "EVENT_HORIZON_EEL") {
      makeBoss({ wMul: 3.20, sMul: 0.88, h1: 260, h2: 320, limbs: 9 });
    } else if (special === "WYRM_EMPEROR") {
      makeBoss({ wMul: 3.80, sMul: 0.82, h1: 15, h2: 200, limbs: 14 });
    }

    // boss cadence: do something crazy every 15–20s
    if (w.isBoss) {
      w.__nextBossUlt = performance.now() + rand(6000, 9000);
    }

    return w;
  }

  // World state
  const colonies = [newColony(0, 0, 150)];
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], true));

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
      v: 3.0 + strength * 1.7,
      a: 0.95,
      w: 2.2 + strength * 1.6,
      hue: hueOverride
    });
    playSfx("shock", strength);
  }

  // =========================
  // Flow field + angle helpers
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

  function lerpAngle(a, b, t) {
    const d = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    return a + d * t;
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
      ctx.lineWidth = width + 8;
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

  function bossLabel(w) {
    switch (w.special) {
      case "SOL_STORM": return "⚡ SOLANA STORM";
      case "FIRE_DOGE": return "🔥 FIRE DOGE";
      case "ICE_QUEEN": return "❄️ ICE QUEEN";
      case "HYDRAWORM": return "🐉 HYDRAWORM";
      case "MOONJUDGE": return "🌙 MOONJUDGE WYRM";
      case "WHALE_SUMMONER": return "🐋 WHALE SUMMONER";
      case "BREAKER_OF_BOOKS": return "📚 BREAKER OF BOOKS";
      case "VIRAL_VIPER": return "🧬 VIRAL VIPER";
      case "PARABOLIC_PHARAOH": return "📈 PARABOLIC PHARAOH";
      case "MEMELORD_MEGA": return "👑 MEMELORD MEGAWORM";
      case "VALIDATOR_VORTEX": return "🌀 VALIDATOR VORTEX";
      case "EVENT_HORIZON_EEL": return "🕳️ EVENT HORIZON EEL";
      case "WYRM_EMPEROR": return "🛡️ WYRM EMPEROR";
      default: return "👑 BOSS";
    }
  }

  function drawBossFX(w, time) {
    const head = w.segs[0];
    if (!head) return;

    const pulse = 0.5 + 0.5 * Math.sin(time * 0.003 + w.bossPulse);
    const ringR = 18 + w.width * 1.25 + pulse * 7;

    ctx.globalCompositeOperation = "lighter";

    aura(head.x, head.y, ringR * 4.2, w.hue, 0.10 + pulse * 0.06);
    aura(head.x, head.y, ringR * 2.8, (w.pat.hue2 ?? ((w.hue + 90) % 360)), 0.06 + pulse * 0.05);

    ctx.strokeStyle = `hsla(${w.hue}, 95%, 72%, ${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(head.x, head.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${(w.hue + 120) % 360}, 95%, 75%, ${0.22 + pulse * 0.22})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(head.x, head.y, ringR + 10 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${(w.hue + 70) % 360}, 95%, 78%, ${0.30 + pulse * 0.30})`;
    ctx.lineWidth = 1.7;
    const spikes = 14;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const x1 = head.x + Math.cos(a) * ringR;
      const y1 = head.y + Math.sin(a) * ringR;
      const x2 = head.x + Math.cos(a) * (ringR + 16 + pulse * 8);
      const y2 = head.y + Math.sin(a) * (ringR + 16 + pulse * 8);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (!w.__sparkT) w.__sparkT = 0;
    if (time - w.__sparkT > rand(70, 140)) {
      w.__sparkT = time;
      const count = randi(6, 12);
      for (let i = 0; i < count; i++) {
        w.sparks.push({
          x: head.x + rand(-14, 14),
          y: head.y + rand(-14, 14),
          vx: rand(-2.2, 2.2),
          vy: rand(-2.2, 2.2),
          a: rand(0.55, 0.95),
          h: (w.hue + rand(-60, 60) + 360) % 360
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
      ctx.lineTo(s.x + rand(-9, 9), s.y + rand(-9, 9));
      ctx.stroke();
    }
    w.sparks = w.sparks.filter(s => s.a > 0.06);

    if (!w.trail) w.trail = [];
    w.trail.push({ x: head.x, y: head.y, a: 0.18 });
    if (w.trail.length > 26) w.trail.shift();
    for (let i = 0; i < w.trail.length; i++) {
      const p = w.trail[i];
      p.a *= 0.93;
      ctx.strokeStyle = `hsla(${(w.hue + 40) % 360}, 95%, 70%, ${p.a})`;
      ctx.lineWidth = 10 + i * 0.15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.0 + i * 0.65, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.font = "950 13px system-ui, -apple-system, Inter, sans-serif";
    ctx.fillStyle = "rgba(245,250,255,.95)";
    ctx.fillText(bossLabel(w), head.x + 16, head.y - 16);
  }

  function drawWorm(w, time) {
    const pts = w.segs;
    if (!pts.length) return;

    const glowA = w.isBoss
      ? `hsla(${w.hue}, 95%, 65%, .48)`
      : `hsla(${w.hue}, 95%, 65%, .14)`;

    strokePath(
      pts,
      w.width,
      `hsla(${w.hue}, 95%, 65%, .94)`,
      isInteracting ? null : glowA
    );

    if (!isInteracting) {
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        const t = i / Math.max(1, pts.length - 1);
        const stripeOn = w.pat.stripe && (i % 6 < 3);
        const useHue = (w.pat.dual && stripeOn) ? w.pat.hue2 : w.hue;

        const r = Math.max(1.6, w.width * (0.30 + 0.18 * Math.sin(t * 10 + w.phase)));
        ctx.fillStyle = `hsla(${useHue}, 95%, ${stripeOn ? 70 : 62}%, .88)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (w.pat.dots && (i % 8 === 0)) {
          ctx.fillStyle = `hsla(${(useHue + 30) % 360}, 95%, 78%, .78)`;
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
          ctx.strokeStyle = `hsla(${(useHue + 90) % 360}, 95%, 88%, .28)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y);
          ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3);
          ctx.stroke();
        }
      }
    }

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

        ctx.strokeStyle = `hsla(${(w.hue + 40) % 360}, 95%, 68%, ${isInteracting ? 0.30 : 0.62})`;
        ctx.lineWidth = Math.max(2.2, w.width * 0.38);
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

    if (w.isBoss && !isInteracting) drawBossFX(w, time);

    if (w.breath?.length && !isInteracting) {
      ctx.globalCompositeOperation = "lighter";
      for (const p of w.breath) {
        ctx.fillStyle = `hsla(${p.h}, 95%, ${p.l}%, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawColony(col, time) {
    const hue = col.dna.hue;

    const grow = col.foundingT > 0 ? clamp(col.foundingT / 1.2, 0, 1) : 1;
    const auraScale = 0.55 + 0.45 * grow;

    if (!isInteracting) {
      aura(col.x, col.y, 200 * col.dna.aura * auraScale, hue, 0.18 * grow);
      aura(col.x, col.y, 150 * col.dna.aura * auraScale, (hue + 40) % 360, 0.11 * grow);
      aura(col.x, col.y, 100 * col.dna.aura * auraScale, (hue + 110) % 360, 0.07 * grow);
    } else {
      aura(col.x, col.y, 150 * col.dna.aura * auraScale, hue, 0.12 * grow);
    }

    ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${0.30 * grow})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < col.outline.length; i++) {
      const o = col.outline[i];
      const wob = Math.sin(time * 0.0014 + o.a * 3 + col.dna.seed) * 8 * grow;
      const r = (o.r + wob) * (0.70 + 0.30 * grow);
      const px = col.x + Math.cos(o.a) * r;
      const py = col.y + Math.sin(o.a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    if (colonies[selected] === col) {
      ctx.strokeStyle = `hsla(${hue}, 95%, 65%, .62)`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(col.x, col.y, 108 * col.dna.aura, 0, Math.PI * 2);
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
  // Colony founding via worm travel
  // =========================
  const founders = [];

  function scheduleFounderMission() {
    if (colonies.length >= MAX_COLONIES) return;

    let bestCol = colonies[0];
    for (const c of colonies) if (c.worms.length > bestCol.worms.length) bestCol = c;

    const candidates = bestCol.worms.filter(w => !w.isBoss && !w.mission);
    if (!candidates.length) return;

    const w = candidates[randi(0, candidates.length - 1)];
    const fromIdx = colonies.indexOf(bestCol);

    let tx = 0, ty = 0;
    for (let tries = 0; tries < 30; tries++) {
      const ang = rand(0, Math.PI * 2);
      const dist = rand(520, 880) + colonies.length * rand(20, 60);
      tx = bestCol.x + Math.cos(ang) * dist;
      ty = bestCol.y + Math.sin(ang) * dist;

      let ok = true;
      for (const c of colonies) {
        if (Math.hypot(c.x - tx, c.y - ty) < 420) { ok = false; break; }
      }
      if (ok) break;
    }

    w.mission = {
      type: "FOUND_COLONY",
      tx, ty,
      startedT: performance.now(),
      etaT: performance.now() + rand(8000, 14000)
    };

    pushLog("event", `A worm begins a migration to found a new colony…`);
    setToast("🐛 Colony expedition launched");
  }

  function completeFounderMission(w, tx, ty, fromCol) {
    const nc = newColony(tx, ty, (fromCol.dna.hue + rand(-120, 120) + 360) % 360);
    nc.foundingT = 1.2;

    w.mission = null;

    const head = w.segs[0];
    if (head) {
      const a = rand(0, Math.PI * 2);
      head.x = tx + Math.cos(a) * 90;
      head.y = ty + Math.sin(a) * 90;
      head.a = rand(0, Math.PI * 2);
      for (let i = 1; i < w.segs.length; i++) {
        const prev = w.segs[i - 1];
        const seg = w.segs[i];
        seg.x = prev.x - Math.cos(prev.a) * seg.len;
        seg.y = prev.y - Math.sin(prev.a) * seg.len;
        seg.a = prev.a;
      }
    }

    fromCol.worms = fromCol.worms.filter(x => x !== w);
    nc.worms.push(w);

    // hatchlings (cap aware)
    if (canAddWorms(1)) nc.worms.push(newWorm(nc, Math.random() < 0.25));
    if (canAddWorms(1)) nc.worms.push(newWorm(nc, Math.random() < 0.25));

    colonies.push(nc);
    shockwave(nc, 1.8);
    worldShake(10, 450);

    pushLog("mile", `New colony founded by migration!`, fmt(mcap));
    pulseBigToast("🌱 NEW COLONY FOUNDED!");
  }

  // =========================
  // Boss Ultimate FX (existing)
  // =========================
  function bossFireInferno(col, w, time) {
    const head = w.segs[0];
    if (!head) return;

    pushLog("boss", "🔥 BOSS ULT: INFERNO BREATH UNLEASHED!");
    pulseBigToast("🔥 FIRE DOGE: INFERNO BREATH!");
    playSfx("boss", 1.2);
    playSfx("fire", 1.2);

    worldShake(22, 950);
    shockwave(col, 2.8, 22);
    setTimeout?.(() => shockwave(col, 2.2, 35), 0);

    const dir = head.a;
    for (let k = 0; k < 220; k++) {
      w.breath.push({
        x: head.x + Math.cos(dir) * rand(10, 30) + rand(-12, 12),
        y: head.y + Math.sin(dir) * rand(10, 30) + rand(-12, 12),
        vx: Math.cos(dir) * rand(3.4, 7.6) + rand(-1.1, 1.1),
        vy: Math.sin(dir) * rand(3.4, 7.6) + rand(-1.1, 1.1),
        r: rand(2.8, 7.2),
        a: rand(0.55, 0.95),
        h: rand(10, 48),
        l: rand(58, 72),
      });
    }
  }

  function bossStormQuake(col, w, time) {
    const head = w.segs[0];
    if (!head) return;

    pushLog("boss", "⚡ BOSS ULT: CHAIN STORM — WORLD SHAKES!");
    pulseBigToast("⚡ SOLANA STORM: CHAIN QUake!");
    playSfx("boss", 1.2);
    playSfx("storm", 1.2);

    worldShake(24, 1100);

    for (let i = 0; i < 4; i++) {
      setTimeout?.(() => shockwave(col, 2.6 - i * 0.3, 175), 0);
    }

    const dir = rand(0, Math.PI * 2);
    for (let k = 0; k < 180; k++) {
      const a = dir + rand(-0.8, 0.8);
      w.breath.push({
        x: head.x + rand(-10, 10),
        y: head.y + rand(-10, 10),
        vx: Math.cos(a) * rand(2.8, 7.2),
        vy: Math.sin(a) * rand(2.8, 7.2),
        r: rand(1.8, 4.5),
        a: rand(0.45, 0.85),
        h: rand(160, 200),
        l: rand(62, 80),
      });
    }
  }

  function bossIceNova(col, w, time) {
    const head = w.segs[0];
    if (!head) return;

    pushLog("boss", "❄️ BOSS ULT: ICE NOVA — FREEZE WAVE!");
    pulseBigToast("❄️ ICE QUEEN: ICE NOVA!");
    playSfx("boss", 1.2);
    playSfx("ice", 1.2);

    worldShake(18, 900);

    col.freezeT = 2.8;
    shockwave(col, 2.6, 200);
    shockwave(col, 2.0, 260);

    for (let k = 0; k < 160; k++) {
      const a = rand(0, Math.PI * 2);
      w.breath.push({
        x: head.x + rand(-10, 10),
        y: head.y + rand(-10, 10),
        vx: Math.cos(a) * rand(2.2, 6.4),
        vy: Math.sin(a) * rand(2.2, 6.4),
        r: rand(1.8, 4.8),
        a: rand(0.40, 0.85),
        h: rand(190, 280),
        l: rand(68, 86),
      });
    }
  }

  // NEW: boss ultimate dispatcher (keeps old ones intact)
  function bossUltimateBySpecial(col, w, time) {
    switch (w.special) {
      case "FIRE_DOGE":
      case "BREAKER_OF_BOOKS":
        return bossFireInferno(col, w, time);

      case "SOL_STORM":
      case "HYDRAWORM":
      case "WHALE_SUMMONER":
      case "VALIDATOR_VORTEX":
        return bossStormQuake(col, w, time);

      case "ICE_QUEEN":
      case "MOONJUDGE":
      case "EVENT_HORIZON_EEL":
        return bossIceNova(col, w, time);

      case "VIRAL_VIPER":
      case "PARABOLIC_PHARAOH":
      case "MEMELORD_MEGA":
        // mixed chaos: storm + a small fire burst
        bossStormQuake(col, w, time);
        return bossFireInferno(col, w, time);

      case "WYRM_EMPEROR":
        // final form: does all three
        bossStormQuake(col, w, time);
        bossFireInferno(col, w, time);
        return bossIceNova(col, w, time);

      default:
        return bossStormQuake(col, w, time);
    }
  }

  // =========================
  // Worm behavior
  // =========================
  function wormBehavior(col, w, time, dt) {
    const head = w.segs[0];
    if (!head) return;

    const freezeSlow = col.freezeT > 0 ? 0.55 : 1.0;

    // mission mode
    if (w.mission?.type === "FOUND_COLONY") {
      const { tx, ty, etaT } = w.mission;

      const dx = tx - head.x;
      const dy = ty - head.y;
      const toward = Math.atan2(dy, dx);

      const field = flowAngle(head.x, head.y, time);
      const drift = Math.sin((time + w.wanderT) * 0.0012) * 0.45;
      const desired = lerpAngle(toward, field, 0.22) + drift;

      head.a = lerpAngle(head.a, desired, 0.18);
      const sp = w.speed * 3.2 * freezeSlow * (w.isBoss ? 1.2 : 1.0);
      head.x += Math.cos(head.a) * sp;
      head.y += Math.sin(head.a) * sp;

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

      const dist = Math.hypot(dx, dy);
      if (dist < 120 || time >= etaT) {
        completeFounderMission(w, tx, ty, col);
      }
      return;
    }

    // normal behavior
    if (!w.__roamChange) w.__roamChange = time + rand(700, 1600);
    if (time >= w.__roamChange) {
      w.__roamChange = time + rand(700, 1600);
      w.roamR = clamp(w.roamR + rand(-80, 80), 90, 380);
      w.roamR2 = rand(0, Math.PI * 2);
      if (Math.random() < 0.35) {
        w.huntT = rand(0.35, 0.9);
        w.wanderA = rand(0, Math.PI * 2);
      }
    }

    const ringX = col.x + Math.cos(w.roamR2 + Math.sin(time * 0.001 + w.phase) * 0.55) * w.roamR;
    const ringY = col.y + Math.sin(w.roamR2 + Math.cos(time * 0.0013 + w.phase) * 0.55) * w.roamR;

    const toCenter = Math.hypot(head.x - col.x, head.y - col.y);
    const centerRepel = clamp((120 - toCenter) / 120, 0, 1);

    const field = flowAngle(head.x, head.y, time);
    const jitter = Math.sin(time * 0.002 + w.phase) * 0.10;

    const toRing = Math.atan2(ringY - head.y, ringX - head.x);
    const toCol = Math.atan2(col.y - head.y, col.x - head.x);

    let desired = toRing;

    if (w.type === "DRIFTER") {
      desired = lerpAngle(toRing, field, 0.32 + w.roamBias);
    } else if (w.type === "ORBITER") {
      const orbit = toCol + w.orbitDir * (0.9 + 0.35 * Math.sin(time * 0.001 + w.phase));
      desired = lerpAngle(orbit, field, 0.28 + w.roamBias);
    } else {
      const orbit = toCol + w.orbitDir * (0.8 + 0.45 * Math.sin(time * 0.0012 + w.phase));
      desired = lerpAngle(lerpAngle(toRing, orbit, 0.55), field, 0.30 + w.roamBias);
    }

    if (centerRepel > 0) {
      const away = Math.atan2(head.y - col.y, head.x - col.x);
      desired = lerpAngle(desired, away, 0.55 * centerRepel);
    }

    if (w.huntT > 0) {
      w.huntT = Math.max(0, w.huntT - dt);
      desired = lerpAngle(desired, w.wanderA, 0.35);
    }

    const turnAmt = w.turn * (0.95 + 0.25 * Math.sin(time * 0.001 + w.phase));
    head.a = lerpAngle(head.a, desired, clamp(turnAmt * 9.0, 0.07, 0.24));
    head.a += (Math.random() - 0.5) * turnAmt + jitter * 0.55;

    const boost = w.isBoss ? 1.7 : 1.0;
    const sp = w.speed * 2.45 * boost * freezeSlow;
    head.x += Math.cos(head.a) * sp;
    head.y += Math.sin(head.a) * sp;

    const d = Math.hypot(head.x - col.x, head.y - col.y);
    const leash = 420 + 90 * col.dna.aura;
    if (d > leash) {
      head.x = col.x + (head.x - col.x) * 0.92;
      head.y = col.y + (head.y - col.y) * 0.92;
      head.a = lerpAngle(head.a, toCol, 0.22);
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

    // Boss ultimates
    if (w.isBoss) {
      if (!w.__nextBossUlt) w.__nextBossUlt = time + rand(15000, 20000);
      if (time >= w.__nextBossUlt) {
        w.__nextBossUlt = time + rand(15000, 20000);
        bossUltimateBySpecial(col, w, time);
      }
    }

    // decay breath particles
    if (w.breath?.length) {
      for (const p of w.breath) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.a *= 0.935;
        p.r *= 0.985;
      }
      w.breath = w.breath.filter(p => p.a > 0.05 && p.r > 0.7);
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
      addLimb(w, Math.random() < 0.4);
      msg = `Limb growth • Worm ${w.id}`;
    }

    addMutationToColony(c, msg);
    pushLog("mut", msg);
    playSfx("mut", 1);
    if (Math.random() < 0.25) shockwave(c, 0.9);
  }

  function maybeSpawnWorms(dt) {
    const g = growthScore();
    const target = clamp(Math.floor(3 + g * 2.1), 3, MAX_WORMS);

    const total = totalWorms();
    if (total >= target) return;
    if (total >= MAX_WORMS) return;

    spawnTimer += dt;
    const rate = clamp(1.2 - g * 0.035, 0.12, 1.2);
    if (spawnTimer >= rate) {
      spawnTimer = 0;
      const c = colonies[selected] || colonies[0];
      if (!canAddWorms(1)) return;
      c.worms.push(newWorm(c, Math.random() < 0.18));
      if (Math.random() < 0.22) shockwave(c, 0.55);
      pushLog("event", "New worm hatched");
    }
  }

  // =========================
  // Colonies spawning by MC (travel missions)
  // =========================
  function trySplitByMcap() {
    while (mcap >= nextSplitAt && colonies.length < MAX_COLONIES) {
      scheduleFounderMission();
      pushLog("event", `Milestone reached: ${fmt(nextSplitAt)} MC — expedition dispatched`);
      nextSplitAt += MC_STEP;
    }
  }

  // =========================
  // Milestones
  // =========================
  function announceBossSpawn(name) {
    pushLog("boss", `👑 BOSS SPAWNED: ${name}!`);
    pulseBigToast(`👑 BOSS SPAWNED: ${name}!`);
    playSfx("boss", 1.2);
  }

  function spawnBoss(col, name, specialKey, shockHue) {
    if (!canAddWorms(1)) return;
    const boss = newWorm(col, true, specialKey);
    col.worms.push(boss);
    shockwave(col, 2.8, shockHue ?? boss.hue);
    worldShake(18, 700);
    announceBossSpawn(name);
  }

  function checkMilestones() {
    const c = colonies[0];

    // existing 50k/100k/250k
    if (!milestone50k.hit && mcap >= 50000) {
      milestone50k.hit = true;
      spawnBoss(c, "SOLANA STORM WORM", "SOL_STORM", 175);
      setToast("⚡ Solana Storm Worm formed", 1800);
    }

    if (!milestone100k.hit && mcap >= 100000) {
      milestone100k.hit = true;
      spawnBoss(c, "FIRE DOGE WORM", "FIRE_DOGE", 22);
      setToast("🔥 Fire Doge Worm arrived", 1800);
    }

    if (!milestone250k.hit && mcap >= 250000) {
      milestone250k.hit = true;
      if (!canAddWorms(1)) return;
      const queen = newWorm(c, true, "ICE_QUEEN");
      c.worms.push(queen);
      c.freezeT = 2.8;
      shockwave(c, 2.8, 200);
      worldShake(18, 700);
      announceBossSpawn("ICE QUEEN");
      setToast("❄️ Ice Queen hatch", 1800);
    }

    // NEW boss ladder
    if (!milestone500k.hit && mcap >= 500000) {
      milestone500k.hit = true;
      spawnBoss(c, "HYDRAWORM", "HYDRAWORM", 120);
      setToast("🐉 Hydraworm awakened", 1800);
    }

    if (!milestone1m.hit && mcap >= 1000000) {
      milestone1m.hit = true;
      spawnBoss(c, "MOONJUDGE WYRM", "MOONJUDGE", 210);
      setToast("🌙 Moonjudge Wyrm descends", 1800);
    }

    if (!milestone1_5m.hit && mcap >= 1500000) {
      milestone1_5m.hit = true;
      spawnBoss(c, "WHALE SUMMONER", "WHALE_SUMMONER", 190);
      setToast("🐋 Whale Summoner surfaced", 1800);
    }

    if (!milestone2m.hit && mcap >= 2000000) {
      milestone2m.hit = true;
      spawnBoss(c, "BREAKER OF BOOKS", "BREAKER_OF_BOOKS", 35);
      setToast("📚 Breaker of Books arrived", 1800);
    }

    if (!milestone2_5m.hit && mcap >= 2500000) {
      milestone2_5m.hit = true;
      spawnBoss(c, "VIRAL VIPER WORM", "VIRAL_VIPER", 310);
      setToast("🧬 Viral Viper spreads", 1800);
    }

    if (!milestone3m.hit && mcap >= 3000000) {
      milestone3m.hit = true;
      spawnBoss(c, "PARABOLIC PHARAOHWORM", "PARABOLIC_PHARAOH", 48);
      setToast("📈 Parabolic Pharaoh rises", 1800);
    }

    if (!milestone3_5m.hit && mcap >= 3500000) {
      milestone3_5m.hit = true;
      spawnBoss(c, "MEMELORD MEGAWORM", "MEMELORD_MEGA", 285);
      setToast("👑 Memelord MegaWorm crowned", 1800);
    }

    if (!milestone4m.hit && mcap >= 4000000) {
      milestone4m.hit = true;
      spawnBoss(c, "VALIDATOR VORTEX LEVIATHAN", "VALIDATOR_VORTEX", 170);
      setToast("🌀 Validator Vortex Leviathan online", 1800);
    }

    if (!milestone4_5m.hit && mcap >= 4500000) {
      milestone4_5m.hit = true;
      spawnBoss(c, "EVENT HORIZON EEL", "EVENT_HORIZON_EEL", 260);
      setToast("🕳️ Event Horizon Eel bends reality", 1800);
    }

    if (!milestone5m.hit && mcap >= 5000000) {
      milestone5m.hit = true;
      spawnBoss(c, "THE FINAL FORM: WYRM EMPEROR", "WYRM_EMPEROR", 15);
      setToast("🛡️ WYRM EMPEROR: FINAL FORM", 2200);
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
    worldShake(10, 380);
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
      elWorms.textContent = String(totalWorms());
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
      if (c.foundingT > 0) c.foundingT = Math.max(0, c.foundingT - dt);

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

    if (toast) {
      const now = performance.now();
      if (now - toastT > toastHold) toast.textContent = "Simulation Active";
      else toast.textContent = toastMsg;
    }

    updateStats();
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    const sh = applyShake(time);

    ctx.save();
    ctx.translate(W / 2 + sh.sx, H / 2 + sh.sy);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    for (const c of colonies) drawColony(c, time);
    for (const c of colonies) for (const w of c.worms) drawWorm(w, time);

    ctx.restore();

    if (elStatus) elStatus.textContent = "Simulation Active";
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
    setToast("JS LOADED ✓ (rendering)", 1200);

    requestAnimationFrame(tick);
  }

  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
