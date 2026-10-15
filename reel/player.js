export class Player {
  constructor(el) {
    this.el = el;
    el.insertAdjacentHTML("afterbegin", `
      <video class="p-v" playsinline preload="auto"></video>
      <video class="p-v" playsinline preload="auto"></video>`);
    this.v = [...el.querySelectorAll(".p-v")];
    this.front = 0;
    this.muted = false;
    this.paused = false;
    this.gen = 0;
  }
  get current() { return this.v[this.front]; }
  route(ctx) {
    if (this.gains || !ctx) return;
    try {
      this.gains = this.v.map(v => { const g = ctx.createGain(); ctx.createMediaElementSource(v).connect(g).connect(ctx.destination); return g; });
      this.ctx = ctx;
    } catch { this.gains = null; }
  }
  level(v, clip) {
    const gain = clip.gain ?? 1, k = this.v.indexOf(v);
    if (this.gains) { this.gains[k].gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05); v._top = 1; }
    else v._top = Math.min(1, gain);
  }
  time() { return this.current.currentTime || 0; }
  preload(clip) {
    const back = this.v[1 - this.front];
    if (clip && back.dataset.src !== clip.src) { back.dataset.src = clip.src; back.src = clip.src; back.preload = "auto"; back.load(); }
  }
  play(clip, { cap = null } = {}) {
    const gen = ++this.gen;
    const v = this.v[1 - this.front], old = this.v[this.front];
    this.front = 1 - this.front;
    if (v.dataset.src !== clip.src) { v.dataset.src = clip.src; v.src = clip.src; }
    v.currentTime = 0;
    v.muted = this.muted;
    v.volume = 0;
    this.level(v, clip);
    v.classList.add("on");
    old.classList.remove("on");
    fade(old, 0, 280, () => { if (!old.classList.contains("on")) old.pause(); });
    const start = () => v.play().then(() => fade(v, v._top ?? 1, 260)).catch(() => { v.muted = true; return v.play().catch(() => {}); });
    if (!this.paused) start();
    return new Promise(res => {
      let stall = null;
      const done = ok => { v.removeEventListener("ended", end); clearInterval(watch); res(ok); };
      const end = () => { if (gen === this.gen) done(true); };
      v.addEventListener("ended", end);
      let last = -1, still = 0;
      const watch = setInterval(() => {
        if (gen !== this.gen) return done(false);
        if (this.paused) return;
        if (cap && v.currentTime >= cap) { fade(v, 0, 200); return done(true); }
        if (v.currentTime === last) { still += 0.25; if (still > 10) done(true); } else { still = 0; last = v.currentTime; }
      }, 250);
    });
  }
  stop() {
    this.gen++;
    for (const v of this.v) { fade(v, 0, 200, () => v.pause()); v.classList.remove("on"); }
  }
  setPaused(p) {
    this.paused = p;
    const v = this.current;
    if (p) v.pause(); else v.play().then(() => fade(v, v._top ?? 1, 200)).catch(() => {});
  }
  setMuted(m) { this.muted = m; for (const v of this.v) v.muted = m; }
}
function fade(video, to, ms, then) {
  const from = video.volume, t0 = performance.now();
  cancelAnimationFrame(video._fade);
  const tick = now => {
    const f = Math.min(1, (now - t0) / ms);
    video.volume = Math.max(0, Math.min(1, from + (to - from) * f));
    if (f < 1) video._fade = requestAnimationFrame(tick); else then?.();
  };
  video._fade = requestAnimationFrame(tick);
}
