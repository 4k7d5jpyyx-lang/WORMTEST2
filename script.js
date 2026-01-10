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

  // Inspector overlay
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
  // Event log
  // =========================
  const LOG_CAP = 40;
  let lastLog = { msg: "", t: 0, count: 0, badge: "" };

  function pushLog(badge, msg, meta = "") {
    if (!eventLogEl) return;
    const now = Date.now();

    // merge spam
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
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    } else if (type === "ice") {
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.20, now + A);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    } else if (type === "storm") {
      o.type = "sawtooth";
      o.frequency.setValueAtTime(140, now);
      o.frequency.exponentialRampToValueAtTime(520, now + 0.10);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.28, now + A);
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
    o.stop(now + 0.7);

    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(1.0, now + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
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
    };
  }

  function addLimb(w, big = false) {
    if (!w.segs.length) return;
    const at = randi(2, w.segs.length - 3);
    w.limbs.push({
      at,
      len: big ? rand(40, 110) : rand(24, 78),
      ang: rand(-1.4, 1.4),
      wob: rand(0.7, 1.9)
    });
  }

  function newWorm(col, big = false, special = null) {
    const type = ["DRIFTER", "ORBITER", "HUNTER"][randi(0, 2)];
    const segCount = big ? randi(18, 30) : randi(12, 20);
    const baseLen = big ? rand(10, 16) : rand(7, 12);

    // spawn around colony
    const spawnAng = rand(0, Math.PI * 2);
    const spawnRad = rand(60, 140);
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
      turn: rand(0.010, 0.024) * col.dna.chaos,
      phase: rand(0, Math.PI * 2),

      orbitDir: Math.random() < 0.5 ? -1 : 1,
      roamBias: rand(0.10, 0.28),

      // Better movement: habitat ring + waypoint goal
      goal: { x: col.x, y: col.y, t: 0 },
      homeRing: {
        inner: 95 + rand(-20, 25),
        outer: 260 + rand(-40, 55),
      },

      // Colony founding
      role: "NORMAL",    // NORMAL | SCOUT
      travel: null,      // {x,y}
      arrived: false,

      // patterns
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
      bolts: [],
      embers: [],
      buffT: 0,
      __sparkT: 0,
      __nextUlt: 0,
    };

    for (let i = 0; i < segCount; i++) {
      w.segs.push({ x: px, y: py, a: ang, len: baseLen * rand(0.85, 1.22) });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.35, 0.35) * col.dna.chaos;
    }

    const limbChance = clamp(0.10 + col.dna.limbiness * 0.22, 0.12, 0.55);
    if (Math.random() < limbChance) addLimb(w, big);

    if (special === "SOL_STORM") {
      w.isBoss = true;
      w.width *= 2.1;
      w.speed *= 0.92;
      w.hue = 175;
      w.pat.hue2 = 285;
      w.pat.sparkle = true;
      for (let i = 0; i < 6; i++) addLimb(w, true);
      w.__nextUlt = performance.now() + rand(15000, 20000);
    } else if (special === "FIRE_DOGE") {
      w.isBoss = true;
      w.width *= 2.0;
      w.speed *= 0.94;
      w.hue = 22;
      w.pat.hue2 = 55;
      w.pat.sparkle = true;
      for (let i = 0; i < 6; i++) addLimb(w, true);
      w.__nextUlt = performance.now() + rand(15000, 20000);
    } else if (special === "ICE_QUEEN") {
      w.isBoss = true;
      w.width *= 2.2;
      w.speed *= 0.88;
      w.hue = 200;
      w.pat.hue2 = 265;
      w.pat.sparkle = true;
      for (let i = 0; i < 7; i++) addLimb(w, true);
      w.__nextUlt = performance.now() + rand(15000, 20000);
    }

    return w;
  }

  // World state
  const colonies = [newColony(0, 0, 150)];
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], true));

  // =========================
  // Inspector logic (tap colony)
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
  function shockwave(col, strength = 1, hueOverride = null, rings = 1) {
    for (let i = 0; i < rings; i++) {
      col.shock.push({
        r: i * 18,
        v: (2.8 + strength * 1.4) * (1.0 + i * 0.12),
        a: 0.92,
        w: (2 + strength * 1.2) * (1.0 - i * 0.08),
        hue: hueOverride
      });
    }
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

  function lerpAngle(a, b, t) {
    const d = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    return a + d * t;
  }

  // =========================
  // Better movement helpers
  // =========================
  function pickRingGoal(col, w, timeNow) {
    const inner = w.homeRing.inner * col.dna.aura;
    const outer = w.homeRing.outer * col.dna.aura;

    const baseA = (w.orbitDir > 0 ? 1 : -1) * rand(0.6, 1.5) + rand(-0.35, 0.35);
    const a = baseA + (timeNow * 0.0002) * w.orbitDir;
    const r = rand(inner, outer);

    w.goal.x = col.x + Math.cos(a) * r;
    w.goal.y = col.y + Math.sin(a) * r;
    w.goal.t = timeNow + rand(2000, 5200);
  }

  function separationPush(col, w) {
    const head = w.segs[0];
    let pushX = 0, pushY = 0, n = 0;
    const maxCheck = 6;
    const worms = col.worms;

    for (let i = 0; i < worms.length && n < maxCheck; i++) {
      const o = worms[i];
      if (o === w) continue;
      const oh = o.segs[0];
      const dx = head.x - oh.x;
      const dy = head.y - oh.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 70 * 70 && d2 > 0.0001) {
        const inv = 1 / Math.sqrt(d2);
        pushX += dx * inv;
        pushY += dy * inv;
        n++;
      }
    }
    if (n === 0) return { x: 0, y: 0 };
    return { x: pushX / n, y: pushY / n };
  }

  // =========================
  // Boss ultimates (15–20 sec)
  // =========================
  function bossUltimate(col, w, timeMs) {
    if (!w.isBoss) return;
    if (!w.__nextUlt) w.__nextUlt = timeMs + rand(15000, 20000);
    if (timeMs < w.__nextUlt) return;

    w.__nextUlt = timeMs + rand(15000, 20000);

    if (w.special === "SOL_STORM") {
      shockwave(col, 3.2, 175, 4);
      pushLog("boss", "⚡ SOLANA STORM ULT: Chain Lightning Surge!");
      playSfx("storm", 1.4);

      const h = w.segs[0];
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(35, 130);
        w.bolts.push({
          x1: h.x + rand(-10, 10),
          y1: h.y + rand(-10, 10),
          x2: h.x + Math.cos(a) * r,
          y2: h.y + Math.sin(a) * r,
          a: rand(0.45, 0.85),
          w: rand(1.2, 2.4),
          h: rand(165, 295)
        });
      }

      for (const ww of col.worms) {
        if (ww === w || ww.isBoss) continue;
        const hh = ww.segs[0];
        const d = Math.hypot(hh.x - h.x, hh.y - h.y);
        if (d < 280) ww.buffT = 2.2;
      }

    } else if (w.special === "FIRE_DOGE") {
      shockwave(col, 3.0, 22, 4);
      pushLog("boss", "🔥 FIRE DOGE ULT: Inferno Cone Blast!");
      playSfx("fire", 1.4);

      const head = w.segs[0];
      const dir = head.a;

      for (let k = 0; k < 140; k++) {
        const spread = rand(-0.55, 0.55);
        const sp = rand(3.4, 6.2);
        const a = dir + spread;
        w.breath.push({
          x: head.x + Math.cos(a) * rand(12, 30) + rand(-10, 10),
          y: head.y + Math.sin(a) * rand(12, 30) + rand(-10, 10),
          vx: Math.cos(a) * sp + rand(-0.6, 0.6),
          vy: Math.sin(a) * sp + rand(-0.6, 0.6),
          r: rand(2.6, 6.2),
          a: rand(0.55, 0.95),
          h: rand(10, 55)
        });
      }

      for (let i = 0; i < 110; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(80, 240);
        w.embers.push({
          x: col.x + Math.cos(a) * r,
          y: col.y + Math.sin(a) * r,
          vx: rand(-0.6, 0.6),
          vy: rand(-0.6, 0.6),
          r: rand(1.4, 3.4),
          a: rand(0.35, 0.80),
          h: rand(12, 65)
        });
      }

    } else if (w.special === "ICE_QUEEN") {
      shockwave(col, 3.1, 200, 4);
      pushLog("boss", "❄️ ICE QUEEN ULT: Absolute Zero Pulse!");
      playSfx("ice", 1.4);

      col.freezeT = 3.4;

      const head = w.segs[0];
      for (let i = 0; i < 140; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(1.8, 5.0);
        w.shards.push({
          x: head.x + rand(-10, 10),
          y: head.y + rand(-10, 10),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          a: rand(0.45, 0.90),
          h: rand(190, 265)
        });
      }
    }
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

  function drawBossFX(w, time) {
    const head = w.segs[0];
    if (!head) return;

    const pulse = 0.5 + 0.5 * Math.sin(time * 0.003 + w.bossPulse);
    const ringR = 18 + w.width * 1.2 + pulse * 8;

    ctx.globalCompositeOperation = "lighter";
    aura(head.x, head.y, ringR * 3.6, w.hue, 0.08 + pulse * 0.05);

    ctx.strokeStyle = `hsla(${w.hue}, 95%, 74%, ${0.50 + pulse * 0.28})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(head.x, head.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${(w.hue + 70) % 360}, 95%, 75%, ${0.32 + pulse * 0.30})`;
    ctx.lineWidth = 1.8;
    const spikes = 12;
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

    ctx.globalCompositeOperation = "source-over";
    ctx.font = "900 12px system-ui, -apple-system, Inter, sans-serif";
    ctx.fillStyle = "rgba(235,245,255,.94)";
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
      ? `hsla(${w.hue}, 95%, 65%, .40)`
      : `hsla(${w.hue}, 95%, 65%, .14)`;

    if (!isInteracting) {
      strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .92)`, glowA);
    } else {
      strokePath(pts, w.width, `hsla(${w.hue}, 95%, 65%, .92)`, null);
    }

    if (!isInteracting) {
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        const t = i / Math.max(1, pts.length - 1);
        const stripeOn = w.pat.stripe && (i % 6 < 3);
        const useHue = (w.pat.dual && stripeOn) ? w.pat.hue2 : w.hue;

        const r = Math.max(1.6, w.width * (0.30 + 0.18 * Math.sin(t * 10 + w.phase)));
        ctx.fillStyle = `hsla(${useHue}, 95%, ${stripeOn ? 68 : 62}%, .85)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (w.pat.dots && (i % 8 === 0)) {
          ctx.fillStyle = `hsla(${(useHue + 30) % 360}, 95%, 76%, .75)`;
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
          ctx.strokeStyle = `hsla(${(useHue + 90) % 360}, 95%, 85%, .25)`;
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

        ctx.strokeStyle = `hsla(${(w.hue + 40) % 360}, 95%, 66%, ${isInteracting ? 0.30 : 0.55})`;
        ctx.lineWidth = Math.max(2, w.width * 0.35);
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

    // Fire particles
    if (w.special === "FIRE_DOGE") {
      ctx.globalCompositeOperation = "lighter";
      for (const p of w.breath) {
        ctx.fillStyle = `hsla(${p.h}, 95%, 65%, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const e of w.embers) {
        ctx.fillStyle = `hsla(${e.h}, 95%, 65%, ${e.a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Ice shards
    if (w.special === "ICE_QUEEN") {
      ctx.globalCompositeOperation = "lighter";
      for (const s of w.shards) {
        ctx.strokeStyle = `hsla(${s.h}, 95%, 80%, ${s.a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.vx * 3.0, s.y + s.vy * 3.0);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Lightning bolts
    if (w.special === "SOL_STORM") {
      ctx.globalCompositeOperation = "lighter";
      for (const b of w.bolts) {
        ctx.strokeStyle = `hsla(${b.h}, 95%, 75%, ${b.a})`;
        ctx.lineWidth = b.w;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
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

    // irregular outline
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

    // ice queen freeze aura pulse
    if (col.freezeT > 0) {
      ctx.globalCompositeOperation = "lighter";
      aura(col.x, col.y, 260 * col.dna.aura, 200, 0.12 * clamp(col.freezeT / 3.4, 0, 1));
      ctx.globalCompositeOperation = "source-over";
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
      w.width = clamp(w.width * rand(1.05, 1.35), 3.5, 20);
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

  // =========================
  // Colonies founded by scouts (instead of instant pop)
  // =========================
  const pendingFoundations = [];

  function scheduleFoundation(fromIdx, x, y, atMc) {
    pendingFoundations.push({
      x, y,
      fromIdx,
      scoutsNeeded: randi(4, 6),
      scoutsArrived: 0,
      spawnedAtMc: atMc,
      active: true,
      started: false,
      created: false,
    });
  }

  function startFoundationScouts(f, timeNow) {
    if (!f.active || f.started) return;
    const from = colonies[f.fromIdx];
    if (!from) return;

    const need = f.scoutsNeeded;
    const nonBoss = from.worms.filter(w => !w.isBoss);
    for (let k = nonBoss.length; k < need; k++) {
      from.worms.push(newWorm(from, false));
    }

    const candidates = from.worms.filter(w => !w.isBoss);
    for (let i = 0; i < need; i++) {
      const w = candidates[i % candidates.length];
      w.role = "SCOUT";
      w.travel = { x: f.x, y: f.y };
      w.arrived = false;
      w.roamBias = 0.05;
      w.speed *= 1.05;
      w.goal.t = timeNow + 999999; // ignore roaming while traveling
    }

    f.started = true;
    pushLog("event", `Scouts deployed to found a new colony (${fmt(f.spawnedAtMc)} MC)`);
  }

  function checkFoundationArrivals() {
    for (const f of pendingFoundations) {
      if (!f.active || !f.started || f.created) continue;
      const from = colonies[f.fromIdx];
      if (!from) { f.active = false; continue; }

      let arrivedNow = 0;
      for (const w of from.worms) {
        if (w.role !== "SCOUT" || !w.travel || w.arrived) continue;
        const head = w.segs[0];
        const d = Math.hypot(head.x - f.x, head.y - f.y);
        if (d < 70) {
          w.arrived = true;
          arrivedNow++;
        }
      }
      if (arrivedNow > 0) {
        f.scoutsArrived += arrivedNow;
        pushLog("event", `Scouts arrived: ${f.scoutsArrived}/${f.scoutsNeeded}`);
      }

      if (f.scoutsArrived >= f.scoutsNeeded) {
        if (colonies.length >= MAX_COLONIES) { f.active = false; continue; }

        const base = colonies[f.fromIdx] || colonies[0];
        const nc = newColony(f.x, f.y, (base.dna.hue + rand(-100, 100) + 360) % 360);

        const transferred = [];
        for (const w of base.worms) {
          if (w.role === "SCOUT" && w.arrived) transferred.push(w);
        }
        base.worms = base.worms.filter(w => !(w.role === "SCOUT" && w.arrived));

        for (const w of transferred) {
          w.role = "NORMAL";
          w.travel = null;
          w.arrived = false;
          w.goal.t = 0;
          nc.worms.push(w);
        }

        const g = growthScore();
        const starters = clamp(Math.floor(1 + g / 2), 1, 5);
        for (let i = 0; i < starters; i++) nc.worms.push(newWorm(nc, Math.random() < 0.25));

        colonies.push(nc);
        shockwave(nc, 1.25, null, 2);
        pushLog("event", `New colony founded at ${fmt(f.spawnedAtMc)} MC`);

        f.created = true;
        f.active = false;
      }
    }
  }

  function trySplitByMcap(timeNow) {
    while (mcap >= nextSplitAt && colonies.length < MAX_COLONIES) {
      const baseIdx = selected ?? 0;
      const base = colonies[baseIdx] || colonies[0];

      const ang = rand(0, Math.PI * 2);
      const dist = rand(320, 520);
      const x = base.x + Math.cos(ang) * dist;
      const y = base.y + Math.sin(ang) * dist;

      scheduleFoundation(baseIdx, x, y, nextSplitAt);

      // start scouts immediately
      startFoundationScouts(pendingFoundations[pendingFoundations.length - 1], timeNow);

      nextSplitAt += MC_STEP;
    }
  }

  // =========================
  // Milestone Specials (spawn bosses)
  // =========================
  function checkMilestones(timeNow) {
    if (!milestone50k.hit && mcap >= 50000) {
      milestone50k.hit = true;
      const c = colonies[0];
      const stormBoss = newWorm(c, true, "SOL_STORM");
      c.worms.push(stormBoss);
      shockwave(c, 2.0, 175, 2);
      pushLog("boss", "⚡ 50k Milestone: Solana Storm Worm has formed!");
      playSfx("storm", 1.2);
    }

    if (!milestone100k.hit && mcap >= 100000) {
      milestone100k.hit = true;
      const c = colonies[0];
      const fire = newWorm(c, true, "FIRE_DOGE");
      c.worms.push(fire);
      shockwave(c, 2.0, 22, 2);
      pushLog("mile", "🔥 100k Milestone: Fire-Breathing Doge Worm has arrived!");
      playSfx("fire", 1.2);
    }

    if (!milestone250k.hit && mcap >= 250000) {
      milestone250k.hit = true;
      const c = colonies[0];
      const queen = newWorm(c, true, "ICE_QUEEN");
      c.worms.push(queen);

      c.freezeT = 2.6;
      shockwave(c, 2.2, 200, 2);
      pushLog("mile", "❄️ 250k Milestone: Ice Queen hatch — the colony chills!");
      playSfx("ice", 1.2);
    }
  }

  // =========================
  // Worm behavior
  // =========================
  function wormBehavior(col, w, timeMs, dt) {
    const head = w.segs[0];
    if (!head) return;

    if (w.buffT > 0) w.buffT = Math.max(0, w.buffT - dt);

    const freezeSlow = col.freezeT > 0 ? 0.58 : 1.0;
    const buffBoost = w.buffT > 0 ? 1.22 : 1.0;

    // if boss, maybe ultimate
    if (w.isBoss) bossUltimate(col, w, timeMs);

    // Travel mode for scouts
    if (w.role === "SCOUT" && w.travel) {
      const dx = w.travel.x - head.x;
      const dy = w.travel.y - head.y;
      const toward = Math.atan2(dy, dx);
      head.a = lerpAngle(head.a, toward, 0.18);
    } else {
      if (!w.goal.t || timeMs >= w.goal.t) pickRingGoal(col, w, timeMs);

      const dxg = w.goal.x - head.x;
      const dyg = w.goal.y - head.y;
      const goalA = Math.atan2(dyg, dxg);

      const dx = head.x - col.x;
      const dy = head.y - col.y;
      const dist = Math.hypot(dx, dy);
      const inner = w.homeRing.inner * col.dna.aura;
      const outer = w.homeRing.outer * col.dna.aura;

      let centerPushA = null;
      if (dist < inner * 0.82) centerPushA = Math.atan2(dy, dx);
      else if (dist > outer * 1.05) centerPushA = Math.atan2(-dy, -dx);

      const field = flowAngle(head.x, head.y, timeMs);
      const jitter = Math.sin(timeMs * 0.002 + w.phase) * 0.10;

      const sep = separationPush(col, w);
      const sepA = (sep.x || sep.y) ? Math.atan2(sep.y, sep.x) : null;

      let desired = lerpAngle(goalA, field, w.roamBias + 0.06);

      if (w.type === "ORBITER") {
        const toC = Math.atan2(col.y - head.y, col.x - head.x);
        const orbit = toC + w.orbitDir * (0.9 + 0.35 * Math.sin(timeMs * 0.001 + w.phase));
        desired = lerpAngle(desired, orbit, 0.20);
      } else if (w.type === "HUNTER") {
        desired = lerpAngle(desired, field, 0.10);
      }

      if (centerPushA !== null) desired = lerpAngle(desired, centerPushA, 0.35);
      if (sepA !== null) desired = lerpAngle(desired, sepA, 0.15);
      desired += jitter * 0.35;

      const turnAmt = w.turn * (0.9 + 0.25 * Math.sin(timeMs * 0.001 + w.phase));
      head.a = lerpAngle(head.a, desired, clamp(turnAmt * 10.0, 0.08, 0.24));
    }

    // movement
    const boost = w.isBoss ? 1.55 : 1.0;
    const sp = w.speed * 2.25 * boost * freezeSlow * buffBoost;
    head.x += Math.cos(head.a) * sp;
    head.y += Math.sin(head.a) * sp;

    // keep within leash (larger to allow roaming)
    const d = Math.hypot(head.x - col.x, head.y - col.y);
    const leash = 360 + 110 * col.dna.aura;
    if (d > leash) {
      const toward = Math.atan2(col.y - head.y, col.x - head.x);
      head.x = col.x + (head.x - col.x) * 0.92;
      head.y = col.y + (head.y - col.y) * 0.92;
      head.a = lerpAngle(head.a, toward, 0.25);
    }

    // follow segments
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

    // maintain FX particles
    // FIRE breath decay
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

      for (const e of w.embers) {
        e.x += e.vx;
        e.y += e.vy;
        e.vx *= 0.97;
        e.vy *= 0.97;
        e.a *= 0.94;
        e.r *= 0.99;
      }
      w.embers = w.embers.filter(e => e.a > 0.05 && e.r > 0.6);
    }

    // ICE shards decay
    if (w.special === "ICE_QUEEN") {
      for (const s of w.shards) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy *= 0.97;
        s.a *= 0.94;
      }
      w.shards = w.shards.filter(s => s.a > 0.06);
    }

    // SOL bolts decay
    if (w.special === "SOL_STORM") {
      for (const b of w.bolts) b.a *= 0.92;
      w.bolts = w.bolts.filter(b => b.a > 0.08);
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
  function step(dt, timeNowMs) {
    trySplitByMcap(timeNowMs);
    checkFoundationArrivals();
    checkMilestones(timeNowMs);

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

    // worms
    for (const c of colonies) {
      for (const w of c.worms) wormBehavior(c, w, timeNowMs, dt);
    }

    if (focusOn) centerOnSelected(true);

    // auto mutations
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

  function render(timeNowMs) {
    ctx.clearRect(0, 0, W, H);

    drawBackground();

    // camera
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    for (const c of colonies) drawColony(c, timeNowMs);
    for (const c of colonies) for (const w of c.worms) drawWorm(w, timeNowMs);

    ctx.restore();

    if (toast) toast.textContent = "JS LOADED ✓ (rendering)";
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
    if (toast) toast.textContent = "Loading…";
    requestAnimationFrame(tick);
  }

  window.addEventListener("load", boot);
  if (document.readyState === "complete") boot();
})();
