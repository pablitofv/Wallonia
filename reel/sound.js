let ctx = null, bus, noise, last = 0, muted = false;
export function unlock() {
  if (ctx) { ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  bus = ctx.createGain(); bus.gain.value = 0.16; bus.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
}
export function tick(level = 1) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  if (t - last < 0.04) return;
  last = t;
  const src = ctx.createBufferSource(); src.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600 + Math.random() * 900; bp.Q.value = 2.5;
  const g = ctx.createGain(); g.gain.value = 0.5 * level;
  src.connect(bp).connect(g).connect(bus);
  src.start(t);
}
export function setMuted(m) { muted = m; }
export const audioContext = () => ctx;
export function suspend(p) { if (ctx) p ? ctx.suspend() : ctx.resume(); }
