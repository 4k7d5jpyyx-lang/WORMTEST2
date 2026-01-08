(() => {
  "use strict";

  // ---------- Tiny on-screen debug so you can see if JS is running ----------
  const dbg = document.createElement("div");
  dbg.style.cssText = `
    position:fixed; left:10px; top:10px; z-index:999999;
    padding:8px 10px; border-radius:10px;
    background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.18);
    color:rgba(235,240,248,.92); font:600 12px/1.2 system-ui, -apple-system, Inter, sans-serif;
    backdrop-filter: blur(10px);
  `;
  dbg.textContent = "JS LOADED ✓";
  document.body.appendChild(dbg);

  function showErr(e) {
    dbg.textContent = "JS ERROR ✕ " + (e?.message || e);
    dbg.style.background = "rgba(120,0,20,.55)";
    console.error(e);
  }

  window.addEventListener("error", (ev) => showErr(ev.error || ev.message));
  window.addEventListener("unhandledrejection", (ev) => showErr(ev.reason));

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const fmtMoney = (n) =>
    "$" + Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

  // ---------- Grab DOM safely ----------
  const canvas = $("simCanvas") || $("c"); // supports either id
  if (!canvas) {
    showErr("Canvas not found (expected #simCanvas or #c)");
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) {
    showErr("Canvas context failed");
    return;
  }

  // Optional stat IDs (won't crash if missing)
  const elBuyers = $("buyers");
  const elVolume = $("volume");
  const elMcap = $("mcap");
  const elColonies = $("colonies");
  const elWorms = $("worms");
  const logEl = $("log");

  // ---------- iOS-safe canvas sizing ----------
  let W = 1,
    H = 1,
    DPR = 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);

    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);

    // Draw in CSS pixels:
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Run resize at the right times
  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener("orientationchange", () =>
    setTimeout(resizeCanvas, 100)
  );
  // IMPORTANT: load guarantees layout is ready
  window.addEventListener("load", () => {
    resizeCanvas();
    // prove rendering works
    dbg.textContent = "JS LOADED ✓ (rendering)";
  });

  // In case load already happened
  setTimeout(resizeCanvas, 0);

  // ---------- Simulation State ----------
  let buyers = 0;
  let volume = 0;
  let mcap = 0;

  const MAX_COLONIES = 8;
  const MC_STEP = 50000; // spawn new colony each $50k
  let nextSplitAt = MC_STEP;

  // Log with cap + spam merge
  const LOG_CAP = 40;
  let lastLog = { msg: "", t: 0, count: 0 };

  function log(msg, kind = "INFO") {
    const now = Date.now();
    if (!logEl) return;

    // merge spam if same msg within 1.5s
    if (msg === lastLog.msg && now - lastLog.t < 1500) {
      lastLog.count++;
      const top = logEl.firstChild;
      if (top) top.textContent = `${kind}: ${msg} (x${lastLog.count})`;
      lastLog.t = now;
      return;
    }

    lastLog = { msg, t: now, count: 1 };

    const d = document.createElement("div");
    d.textContent = `${kind}: ${msg}`;
    logEl.prepend(d);

    while (logEl.children.length > LOG_CAP) {
      logEl.removeChild(logEl.lastChild);
    }
  }

  // Colony / Worm model: irregular “noodle” with segments and drifting
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function newColony(x, y, seedHue = rand(0, 360)) {
    const dna = {
      hue: seedHue,
      drift: rand(0.4, 1.3),
      chaos: rand(0.4, 1.2),
      aura: rand(0.6, 1.4),
      limbiness: rand(0.2, 1.0),
    };

    return {
      x,
      y,
      vx: rand(-0.2, 0.2),
      vy: rand(-0.2, 0.2),
      zoom: 1,
      dna,
      worms: [],
      shockwaves: [],
      id: Math.random().toString(16).slice(2, 6),
    };
  }

  function newWorm(col, big = false) {
    const segCount = big ? Math.floor(rand(18, 28)) : Math.floor(rand(10, 18));
    const baseLen = big ? rand(10, 16) : rand(7, 12);

    const hueShift = rand(-35, 35);
    const hue = (col.dna.hue + hueShift + 360) % 360;

    const worm = {
      id: Math.random().toString(16).slice(2, 6),
      hue,
      width: big ? rand(6, 10) : rand(4, 7),
      speed: big ? rand(0.35, 0.7) : rand(0.45, 0.95),
      turn: rand(0.008, 0.02) * col.dna.chaos,
      phase: rand(0, Math.PI * 2),
      segs: [],
      limbs: [],
      alive: true,
    };

    // start near colony core
    let px = col.x + rand(-40, 40);
    let py = col.y + rand(-40, 40);
    let ang = rand(0, Math.PI * 2);

    for (let i = 0; i < segCount; i++) {
      worm.segs.push({
        x: px,
        y: py,
        a: ang,
        len: baseLen * rand(0.85, 1.2),
      });
      px -= Math.cos(ang) * baseLen;
      py -= Math.sin(ang) * baseLen;
      ang += rand(-0.25, 0.25) * col.dna.chaos;
    }

    return worm;
  }

  // Build initial colony
  const colonies = [newColony(0, 0, 160)];
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], false));
  colonies[0].worms.push(newWorm(colonies[0], true));

  // Boss worm hook: becomes active once MC passes 50k
  let bossSpawned = false;

  function ensureBoss() {
    if (bossSpawned) return;
    if (mcap >= 50000) {
      const c = colonies[0];
      const boss = newWorm(c, true);
      boss.width *= 1.6;
      boss.speed *= 0.7;
      boss.hue = 120; // neon green boss vibe
      boss.isBoss = true;
      c.worms.push(boss);
      bossSpawned = true;
      c.shockwaves.push({ x: c.x, y: c.y, r: 0, v: 3.2, a: 0.85 });
      log("Boss worm emerged", "EVENT");
    }
  }

  // Spawn new colony each 50k mcap increment, cap at 8
  function trySplitByMcap() {
    while (mcap >= nextSplitAt && colonies.length < MAX_COLONIES) {
      const base = colonies[0];
      const angle = rand(0, Math.PI * 2);
      const dist = rand(180, 320);

      const nc = newColony(
        base.x + Math.cos(angle) * dist,
        base.y + Math.sin(angle) * dist,
        (base.dna.hue + rand(-60, 60) + 360) % 360
      );

      // give it starter worms
      nc.worms.push(newWorm(nc, false));
      nc.worms.push(newWorm(nc, false));
      if (Math.random() < 0.35) nc.worms.push(newWorm(nc, true));

      // shockwave on spawn
      nc.shockwaves.push({ x: nc.x, y: nc.y, r: 0, v: 3.6, a: 0.9 });

      colonies.push(nc);
      log(`New colony spawned at $${nextSplitAt.toLocaleString()} MC`, "EVENT");
      nextSplitAt += MC_STEP;
    }
  }

  // ---------- Controls (won't crash if buttons missing) ----------
  function bindAction(action, fn) {
    const btn = document.querySelector(`button[data-action="${action}"]`);
    if (btn) btn.addEventListener("click", fn);
  }

  bindAction("feed", () => {
    volume += rand(30, 90);
    mcap += rand(150, 450);
    log("Feed + growth", "INFO");
  });

  bindAction("smallBuy", () => {
    buyers += 1;
    volume += rand(150, 650);
    mcap += rand(900, 2600);
    log(`Buy • +1 buyers • +${fmtMoney(volume)} vol`, "INFO");
  });

  bindAction("whaleBuy", () => {
    buyers += Math.floor(rand(2, 5));
    volume += rand(1800, 5200);
    mcap += rand(8000, 18000);
    log("Whale buy spike", "EVENT");
  });

  bindAction("sell", () => {
    const dv = rand(400, 1200);
    const dm = rand(1800, 5200);
    volume = Math.max(0, volume - dv);
    mcap = Math.max(0, mcap - dm);
    log("Sell-off pressure", "WARN");
  });

  bindAction("storm", () => {
    volume += rand(3000, 12000);
    mcap += rand(1500, 6000);
    log("Volume storm surge", "EVENT");
  });

  bindAction("mutate", () => {
    const c = colonies[Math.floor(rand(0, colonies.length))];
    const w = c.worms[Math.floor(rand(0, c.worms.length))];
    if (!w) return;

    const r = Math.random();
    if (r < 0.5) {
      // color shift
      w.hue = (w.hue + rand(25, 90)) % 360;
      log(`Color shift • Worm ${w.id} (Colony ${c.id})`, "MUTATION");
    } else if (r < 0.85) {
      // grow limbs (visual appendages)
      const limbCount = Math.floor(rand(1, 3));
      for (let i = 0; i < limbCount; i++) {
        w.limbs.push({
          at: Math.floor(rand(2, w.segs.length - 2)),
          len: rand(18, 60),
          ang: rand(-1.2, 1.2),
          wob: rand(0.6, 1.4),
        });
      }
      log(`Limb growth • Worm ${w.id}`, "MUTATION");
    } else {
      // aggression spike (speed)
      w.speed *= rand(1.05, 1.25);
      log(`Aggression spike • Worm ${w.id}`, "MUTATION");
    }
  });

  bindAction("reset", () => {
    location.reload();
  });

  // ---------- Rendering helpers ----------
  function drawGlowCircle(x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${color}, 95%, 65%, ${alpha})`);
    g.addColorStop(1, `hsla(${color}, 95%, 65%, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function strokeNoodle(points, hue, width, alpha) {
    ctx.strokeStyle = `hsla(${hue}, 92%, 62%, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  // ---------- Camera / interaction (tap select, drag pan, pinch zoom) ----------
  let camX = 0,
    camY = 0,
    zoom = 1;

  let dragging = false;
  let lastX = 0,
    lastY = 0;

  let selected = 0;

  function toWorld(px, py) {
    return {
      x: (px - W / 2) / zoom - camX,
      y: (py - H / 2) / zoom - camY,
    };
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx,
      dy = ay - by;
    return dx * dx + dy * dy;
  }

  function pickColony(wx, wy) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < colonies.length; i++) {
      const c = colonies[i];
      const d = dist2(wx, wy, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // only select if within a reasonable radius
    if (best !== -1 && bestD < 220 * 220) return best;
    return -1;
  }

  // pointer events (works on iOS)
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    },
    { passive: true }
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camX += dx / zoom;
      camY += dy / zoom;
    },
    { passive: true }
  );

  canvas.addEventListener(
    "pointerup",
    (e) => {
      dragging = false;

      // tap select (if tiny movement)
      const wxwy = toWorld(e.clientX, e.clientY);
      const idx = pickColony(wxwy.x, wxwy.y);
      if (idx !== -1) {
        selected = idx;
        log(`Selected Colony #${idx + 1}`, "INFO");
      }
    },
    { passive: true }
  );

  // pinch zoom (simple: wheel + gesture fallback)
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const k = e.deltaY > 0 ? 0.92 : 1.08;
      zoom = Math.max(0.6, Math.min(2.4, zoom * k));
    },
    { passive: false }
  );

  // ---------- Update UI stats ----------
  function updateStats() {
    if (elBuyers) elBuyers.textContent = String(buyers);
    if (elVolume) elVolume.textContent = fmtMoney(volume);
    if (elMcap) elMcap.textContent = fmtMoney(mcap);
    if (elColonies) elColonies.textContent = String(colonies.length);
    if (elWorms) {
      const w = colonies.reduce((a, c) => a + c.worms.length, 0);
      elWorms.textContent = String(w);
    }
  }

  // ---------- Main simulation step ----------
  function step() {
    // logic triggers
    ensureBoss();
    trySplitByMcap();

    // drift colonies
    for (const c of colonies) {
      c.vx += rand(-0.02, 0.02) * c.dna.drift;
      c.vy += rand(-0.02, 0.02) * c.dna.drift;
      c.vx *= 0.98;
      c.vy *= 0.98;
      c.x += c.vx;
      c.y += c.vy;

      // shockwaves
      for (const s of c.shockwaves) {
        s.r += s.v;
        s.a *= 0.96;
      }
      c.shockwaves = c.shockwaves.filter((s) => s.a > 0.06);
    }

    // move worms irregularly (no perfect circles)
    for (const c of colonies) {
      for (const w of c.worms) {
        if (!w.alive) continue;

        // head segment = segs[0]
        const head = w.segs[0];
        const jitter = Math.sin(perfTime * 0.002 + w.phase) * 0.12;
        head.a += (Math.random() - 0.5) * w.turn + jitter;

        // bias toward colony center + some orbit chaos
        const dx = c.x - head.x;
        const dy = c.y - head.y;
        const toward = Math.atan2(dy, dx);
        head.a = head.a * 0.92 + toward * 0.08;

        // advance head
        head.x += Math.cos(head.a) * w.speed * 2.2;
        head.y += Math.sin(head.a) * w.speed * 2.2;

        // keep within a loose radius (bounce)
        const dist = Math.hypot(head.x - c.x, head.y - c.y);
        if (dist > 240) {
          head.a += Math.PI * 0.7 * (Math.random() > 0.5 ? 1 : -1);
          head.x = c.x + (head.x - c.x) * 0.92;
          head.y = c.y + (head.y - c.y) * 0.92;
        }

        // pull body segments toward previous segment (noodle physics)
        for (let i = 1; i < w.segs.length; i++) {
          const prev = w.segs[i - 1];
          const seg = w.segs[i];

          const vx = seg.x - prev.x;
          const vy = seg.y - prev.y;
          const ang = Math.atan2(vy, vx);

          const targetX = prev.x + Math.cos(ang) * seg.len;
          const targetY = prev.y + Math.sin(ang) * seg.len;

          seg.x = seg.x * 0.2 + targetX * 0.8;
          seg.y = seg.y * 0.2 + targetY * 0.8;
          seg.a = ang;
        }
      }
    }

    updateStats();
  }

  // ---------- Render ----------
  let perfTime = 0;

  function render() {
    perfTime = performance.now();

    // background
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // camera transform
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(camX, camY);

    // colony auras + shockwaves
    colonies.forEach((c, idx) => {
      const hue = c.dna.hue;
      const auraR = 110 * c.dna.aura + 18 * Math.sin(perfTime * 0.001 + idx);

      drawGlowCircle(c.x, c.y, auraR, hue, 0.28);
      drawGlowCircle(c.x, c.y, auraR * 0.65, (hue + 40) % 360, 0.18);

      // selected ring
      if (idx === selected) {
        ctx.strokeStyle = `hsla(${hue}, 95%, 65%, .55)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, auraR * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }

      // shockwaves
      for (const s of c.shockwaves) {
        ctx.strokeStyle = `hsla(${hue}, 92%, 62%, ${s.a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // worms
    colonies.forEach((c) => {
      for (const w of c.worms) {
        const pts = w.segs;
        // soft outer glow
        ctx.globalCompositeOperation = "lighter";
        strokeNoodle(pts, w.hue, w.width + 6, w.isBoss ? 0.26 : 0.18);

        // core
        ctx.globalCompositeOperation = "source-over";
        strokeNoodle(pts, w.hue, w.width, w.isBoss ? 0.95 : 0.9);

        // segment beads (more detail than a line)
        for (let i = 0; i < pts.length; i += 2) {
          const p = pts[i];
          ctx.fillStyle = `hsla(${w.hue}, 95%, 65%, .85)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(2.2, w.width * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }

        // limbs
        if (w.limbs && w.limbs.length) {
          for (const L of w.limbs) {
            const base = pts[Math.max(0, Math.min(pts.length - 1, L.at))];
            const ang =
              pts[L.at]?.a +
              L.ang +
              Math.sin(perfTime * 0.002 * L.wob + w.phase) * 0.35;

            const lx = base.x + Math.cos(ang) * L.len;
            const ly = base.y + Math.sin(ang) * L.len;

            ctx.strokeStyle = `hsla(${w.hue + 30}, 95%, 66%, .75)`;
            ctx.lineWidth = Math.max(2, w.width * 0.35);
            ctx.beginPath();
            ctx.moveTo(base.x, base.y);
            ctx.quadraticCurveTo(
              base.x + Math.cos(ang) * (L.len * 0.55),
              base.y + Math.sin(ang) * (L.len * 0.55),
              lx,
              ly
            );
            ctx.stroke();
          }
        }
      }
    });

    ctx.restore();

    // if nothing is visible, show hint
    if (colonies.length && colonies[0].worms.length) {
      dbg.textContent = "JS LOADED ✓ (rendering)";
    }
  }

  // ---------- Main loop ----------
  function tick() {
    step();
    render();
    requestAnimationFrame(tick);
  }

  // Ensure initial sizing & start loop after load/layout
  window.addEventListener("load", () => {
    resizeCanvas();
    updateStats();
    log("Simulation ready", "INFO");
    tick();
  });

  // If load already fired
  if (document.readyState === "complete") {
    resizeCanvas();
    updateStats();
    log("Simulation ready", "INFO");
    tick();
  }
})();
