let ML = null;
const merc = ([lon, lat]) => ({ x: (180 + lon) / 360, y: (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360 });
import { reelStyle, REEL_3D_LAYERS } from "../map-style.js";
import { t as T, country } from "./i18n.js";
const INK = "234,229,217", SOFT = "142,137,127", EMBER = "228,52,59", HOT = "246,201,69", RAIL = "240,160,92", NIGHT = "127,162,214";
const RIDES = new Set(["train", "tram", "metro", "bus", "flight"]);
const CHUNK = 32, OFF_SCREEN = -1e5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const turn = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
function lift(hex) {
  const n = parseInt((hex || "#888888").slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const k = l < 0.45 ? (0.45 - l) / (1 - l) + 0.1 : 0.1;
  r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  return `${r},${g},${b}`;
}
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
export class Strip {
  constructor(el, reel, { onPick, onExplore, tip } = {}) {
    this.el = el;
    this.reel = reel;
    this.onPick = onPick;
    this.onExplore = onExplore;
    this.tip = tip;
    el.innerHTML = `<div class="st-map"></div><canvas class="st-ink"></canvas><canvas class="st-ink st-dyn"></canvas>
      <div class="st-ctrl">
        <button type="button" data-z="in"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 V13 M3 8 H13"/></svg></button>
        <button type="button" data-z="out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8 H13"/></svg></button>
        <button type="button" data-z="all"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10"/></svg></button>
        <button type="button" data-z="3d" class="st-3d" aria-pressed="false"><span aria-hidden="true">3D</span></button>
      </div>
      <button type="button" class="st-compass" aria-label="Turn the map north up">
        <svg viewBox="-20 -20 40 40" aria-hidden="true"><circle r="15.5"/><g class="needle"><path d="M0 -12 L3 0 L0 2.5 L-3 0 Z"/><path class="s" d="M0 12 L3 0 L0 -2.5 L-3 0 Z"/><text y="-16.5">N</text></g></svg>
      </button>`;
    this.canvas = el.querySelector(".st-ink:not(.st-dyn)");
    this.ctx = this.canvas.getContext("2d");
    this.dyn = el.querySelector(".st-dyn");
    this.dctx = this.dyn.getContext("2d");
    this.compass = el.querySelector(".st-compass");
    this.needle = el.querySelector(".needle");
    const P = reel.route.pts;
    this.n = P.length;
    this.mx = new Float64Array(this.n); this.my = new Float64Array(this.n); this.R = new Float64Array(this.n);
    P.forEach((p, k) => { const m = merc(p); this.mx[k] = m.x; this.my[k] = m.y; this.R[k] = p[2]; });
    this.mode = new Array(this.n).fill("foot");
    for (const [m, a, b] of reel.route.pieces) for (let k = a; k < b; k++) this.mode[k] = m;
    this.sx = new Float32Array(this.n); this.sy = new Float32Array(this.n);
    this.chunks = [];
    for (let a = 0; a < this.n; a += CHUNK) {
      const b = Math.min(this.n - 1, a + CHUNK);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = a; k <= b; k++) { x0 = Math.min(x0, this.mx[k]); x1 = Math.max(x1, this.mx[k]); y0 = Math.min(y0, this.my[k]); y1 = Math.max(y1, this.my[k]); }
      this.chunks.push([x0, y0, x1, y1]);
    }
    this.clips = reel.clips.map((c, i) => ({ i, r: c.r, rgb: lift(c.color), dur: c.dur, x: 0, y: 0 }));
    this.towns = reel.towns.filter(t => t.rank >= 1).map(t => {
      const m = merc(t.at);
      return { ...t, mx: m.x, my: m.y, a: 0, s: 1, w: 0, x: 0, y: 0, side: 0 };
    });
    const key = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const nt of reel.nights) {
      let town = this.towns.find(x => key(x.name) === key(nt.town) && x.rank >= 3);
      if (!town) {
        const m = merc(nt.at);
        town = { name: nt.town, kind: "town", rank: 4, at: nt.at, r: nt.r, off: 0, mx: m.x, my: m.y, a: 0, s: 1, w: 0, x: 0, y: 0, side: 0 };
        this.towns.push(town);
      }
      town.slept = (town.slept || 0) + 1;
    }
    this.dayMarks = [];
    for (const d of reel.days.slice(1)) {
      const p = this.atLonLat(d.r), prev = this.dayMarks.at(-1);
      if (prev && prev.n.length === 1 && Math.hypot(p[0] - prev.p[0], (p[1] - prev.p[1]) * 1.6) < 0.012) prev.n.push(d.n);
      else this.dayMarks.push({ r: d.r, n: [d.n], p });
    }
    this.lands = [
      { name: "France", at: [3.02, 50.47], farAt: [2.7, 49.55], far: false },
      { name: "Belgium", at: [4.62, 50.66], farAt: [5.35, 50.15], far: false },
      { name: "Netherlands", at: [5.86, 50.93], farAt: [5.55, 51.85], far: false },
      { name: "Germany", at: [6.75, 50.62], far: true },
      { name: "Luxembourg", at: [6.1, 49.72], far: true },
      { name: "United Kingdom", at: [0.9, 51.35], far: true },
    ].map(l => { const m = merc(l.at), n = merc(l.farAt || l.at); return { ...l, mx: m.x, my: m.y, fx: n.x, fy: n.y }; });
    this.head = 0;
    this.current = -1;
    this.hover = null;
    this.pointer = null;
    this.state = "intro";
    this.reveal = 0;
    this.cam = null;
    this.bearTo = store.get("caminatas.north") === "1" ? 0 : 90;
    this.zoomBy = 0;
    this.three = false;
    this.zoom3 = 0;
    this.pitch3 = 60;
    this.speed = 0;
    this.bear = this.bearTo;
    this.t = performance.now();
  }
  async ready() {
    ML = await import("../vendor/maplibre-gl/maplibre-gl.mjs");
    const protocol = new pmtiles.Protocol();
    ML.addProtocol("pmtiles", protocol.tile);
    const here = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
    const style = reelStyle({
      tiles: this.reel.tiles ? `pmtiles://${here}${this.reel.tiles}` : null,
      world: this.reel.world ? `pmtiles://${here}${this.reel.world}` : null,
      terrain: this.reel.terrain ? `pmtiles://${here}${this.reel.terrain}` : null,
      glyphs: `${here}vendor/glyphs/{fontstack}/{range}.pbf`,
    });
    const b = new ML.LngLatBounds();
    this.reel.route.pts.forEach(p => b.extend([p[0], p[1]]));
    this.bounds = b;
    this.map = new ML.Map({
      container: this.el.querySelector(".st-map"), style,
      bounds: b, bearing: this.bear, fitBoundsOptions: { padding: 40, bearing: this.bear },
      interactive: true, attributionControl: { compact: true },
      fadeDuration: 0, maxPitch: 72, renderWorldCopies: false, minZoom: 4,
      pixelRatio: Math.min(2, devicePixelRatio || 1),
    });
    const m = this.map;
    m.on("error", e => { const x = e.error; if (x && x.name !== "AbortError" && x.message && !/Failed to fetch|NetworkError|Load failed/i.test(x.message)) console.error(`map: ${x.message}${x.status ? ` (${x.status})` : ""}${x.url ? ` ${x.url}` : ""}`); });
    for (const h of [m.dragRotate, m.keyboard, m.doubleClickZoom, m.touchPitch, m.boxZoom]) h.disable();
    m.touchZoomRotate.disableRotation();
    this.handlers(false);
    await new Promise(r => m.on("load", r));
    if (this.reel.tiles) m.addLayer({ id: "river-names", type: "symbol", source: "base", "source-layer": "water", minzoom: 9.5,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "kind"], ["literal", ["river", "canal"]]], ["has", "name"]],
      layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 10.5, 14, 13],
        "text-letter-spacing": 0.25, "symbol-spacing": 420, "text-max-angle": 28, "text-keep-upright": true },
      paint: { "text-color": ["match", ["get", "kind"], "river", "#6FA9CC", "#4F819F"], "text-halo-color": "rgba(11,12,14,.85)", "text-halo-width": 1.4 } });
    this.layers3d = REEL_3D_LAYERS.filter(id => m.getLayer(id));
    this._on3d = false;
    this.resize();
    m.on("render", () => { this._renderedAt = performance.now(); this.draw(); });
    document.fonts?.ready.then(() => { for (const t of this.towns) t.tw0 = 0; });
    m.on("resize", () => this.resize());
    const el = this.el;
    const coarse = matchMedia("(hover: none)").matches;
    this.coarse = coarse;
    this.compass.addEventListener("click", e => { e.stopPropagation(); this.turnNorth(); });
    this.compass.addEventListener("pointerup", e => e.stopPropagation());
    this.labels();
    for (const b of el.querySelectorAll(".st-ctrl button")) {
      b.addEventListener("click", e => { e.stopPropagation(); this.control(b.dataset.z); });
      b.addEventListener("pointerup", e => e.stopPropagation());
    }
    m.on("dragstart", () => { if (this.state === "follow") this.explore(true, { pull: false }); });
    el.addEventListener("wheel", e => {
      if (this.state !== "follow") return;
      e.preventDefault();
      if (this.three) this.zoom3 = clamp(this.zoom3 - e.deltaY * 0.0016, -3, 1.6);
      else this.zoomBy = clamp(this.zoomBy - e.deltaY * 0.0022, -7.5, 3);
    }, { passive: false });
    el.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; const r = el.getBoundingClientRect(); this.pointer = [e.clientX - r.left, e.clientY - r.top]; });
    el.addEventListener("pointerleave", () => { this.pointer = null; });
    let down = null;
    el.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
    el.addEventListener("pointerup", e => {
      const tap = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) <= (e.pointerType === "touch" ? 12 : 6);
      down = null;
      if (!tap) return;
      if (e.pointerType === "touch" || (coarse && e.pointerType !== "mouse")) {
        if (this.state === "follow") { this.explore(true); return; }
        if (this.state !== "explore") return;
        const r = el.getBoundingClientRect(), i = this.nearest(e.clientX - r.left, e.clientY - r.top, 44);
        if (i != null && i === this.sel) return this.open(i);
        this.select(i);
        return;
      }
      if (this.hover != null) this.onPick?.(this.hover);
    });
    this.tip?.addEventListener("click", () => { if (this.sel != null) this.open(this.sel); });
  }
  nearest(x, y, reach) {
    if (this.map.getPitch() > 1) return null;
    let best = null, d0 = reach;
    for (const cl of this.clips) {
      if (cl.x === OFF_SCREEN || (this.only && !this.only.has(cl.i))) continue;
      const d = Math.hypot(cl.x - x, cl.y - y);
      if (d < d0) { d0 = d; best = cl.i; }
    }
    return best;
  }
  select(i) {
    this.sel = i ?? null;
    this.tip?.classList.toggle("tap", this.sel != null);
    this._sig = null;
    if (this.sel == null) { this.hover = null; this.showTip(null); }
  }
  open(i) { this.select(null); this.explore(false); this.onPick?.(i); }
  way3d() {
    const m = this.map, P = this.reel.route.pts, feats = [];
    for (let k = 0; k < this.n - 1; k++) {
      if (this.mode[k] === "hidden") continue;
      feats.push({ type: "Feature", id: k, properties: { ride: RIDES.has(this.mode[k]) ? 1 : 0 }, geometry: { type: "LineString", coordinates: [[P[k][0], P[k][1]], [P[k + 1][0], P[k + 1][1]]] } });
    }
    m.addSource("way3d", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
    m.addSource("now3d", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const walked = ["boolean", ["feature-state", "w"], false];
    const w = (a, b) => ["interpolate", ["exponential", 1.6], ["zoom"], 12, a, 18, b];
    const L = [
      { id: "way3d-ahead", source: "way3d", filter: ["==", ["get", "ride"], 0], paint: { "line-color": `rgb(${INK})`, "line-width": w(1, 3), "line-opacity": ["case", walked, 0, 0.32] } },
      { id: "way3d-ride", source: "way3d", filter: ["==", ["get", "ride"], 1], paint: { "line-color": `rgb(${RAIL})`, "line-width": w(1.2, 3.5), "line-dasharray": [2, 1.6], "line-opacity": ["case", walked, 0, 0.35] } },
      { id: "way3d-ride-glow", source: "way3d", filter: ["==", ["get", "ride"], 1], paint: { "line-color": `rgb(${RAIL})`, "line-width": w(5, 16), "line-blur": w(3, 9), "line-opacity": ["case", walked, 0.18, 0] } },
      { id: "way3d-ride-walk", source: "way3d", filter: ["==", ["get", "ride"], 1], paint: { "line-color": `rgb(${RAIL})`, "line-width": w(1.6, 4.5), "line-opacity": ["case", walked, 0.8, 0] } },
      { id: "way3d-glow", source: "way3d", filter: ["==", ["get", "ride"], 0], paint: { "line-color": `rgb(${EMBER})`, "line-width": w(7, 22), "line-blur": w(4, 12), "line-opacity": ["case", walked, 0.32, 0] } },
      { id: "way3d-walk", source: "way3d", filter: ["==", ["get", "ride"], 0], paint: { "line-color": `rgb(${HOT})`, "line-width": w(2.2, 6), "line-opacity": ["case", walked, 1, 0] } },
      { id: "now3d-glow", source: "now3d", filter: ["==", ["get", "ride"], 0], paint: { "line-color": `rgb(${EMBER})`, "line-width": w(7, 22), "line-blur": w(4, 12), "line-opacity": 0.32 } },
      { id: "now3d-walk", source: "now3d", paint: { "line-color": ["case", ["==", ["get", "ride"], 1], `rgb(${RAIL})`, `rgb(${HOT})`], "line-width": w(2.2, 6) } },
    ];
    const under = m.getLayer("buildings-3d") ? "buildings-3d" : undefined;
    for (const l of L) m.addLayer({ type: "line", layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, ...l }, under);
    this.layers3d.push(...L.map(l => l.id));
    this._wk = 0;
    this._made3d = true;
  }
  sync3d() {
    const m = this.map, P = this.reel.route.pts, hp = this.at(Math.max(0, this.head)), K = hp.k;
    if (K !== this._wk) {
      const on = K > this._wk;
      for (let k = Math.min(K, this._wk); k < Math.max(K, this._wk); k++) if (this.mode[k] !== "hidden") m.setFeatureState({ source: "way3d", id: k }, { w: on });
      this._wk = K;
    }
    const key = `${K}:${hp.u.toFixed(4)}`;
    if (key === this._nowKey || performance.now() - (this._nowAt || 0) < 80) return;
    this._nowKey = key; this._nowAt = performance.now();
    const here = new ML.MercatorCoordinate(hp.x, hp.y).toLngLat();
    m.getSource("now3d").setData({ type: "FeatureCollection", features: this.mode[K] === "hidden" || this.head < 0 ? [] : [
      { type: "Feature", properties: { ride: RIDES.has(this.mode[K]) ? 1 : 0 }, geometry: { type: "LineString", coordinates: [[P[K][0], P[K][1]], [here.lng, here.lat]] } }] });
  }
  show3d(on) {
    if (on === this._on3d) return;
    if (on && !this._made3d) this.way3d();
    this._on3d = on;
    for (const id of this.layers3d) this.map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    if (this.map.getSource("dem")) this.map.setTerrain(on && !this._lite ? { source: "dem", exaggeration: 1.5 } : null);
    this._slowSince = null;
    if (on) { this._wk = 0; this._nowKey = null; this.map.removeFeatureState({ source: "way3d" }); }
  }
  setThree(on) {
    if (on === this.three) return;
    this.three = on;
    this.el.classList.toggle("three", on);
    if (this.state === "explore") this.explore(false);
    this.labels();
  }
  headingAt(r) {
    const a = this.at(r - 0.04), b = this.at(r + 0.12);
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.hypot(dx, dy) < 1e-9 ? this.bear : Math.atan2(dx, -dy) * 180 / Math.PI;
  }
  later(fn, ms) { clearTimeout(this._later); this._later = setTimeout(fn, ms); }
  handlers(on) {
    const m = this.map;
    m.dragPan.enable();
    for (const h of [m.scrollZoom, m.touchZoomRotate]) on ? h.enable() : h.disable();
    if (on) m.touchZoomRotate.disableRotation();
  }
  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const { width, height } = this.el.getBoundingClientRect();
    this.w = width; this.h = height; this.dpr = dpr;
    for (const cv of [this.canvas, this.dyn]) { cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr); }
    this.whole = null; this._sig = null;
  }
  control(z) {
    const m = this.map;
    if (z === "all") return this.explore(this.state !== "explore");
    if (z === "3d") return this.setThree(!this.three);
    const d = z === "in" ? 1 : -1;
    if (this.state === "follow" && this.three) this.zoom3 = clamp(this.zoom3 + d * 0.6, -3, 1.6);
    else if (this.state === "follow") this.zoomBy = clamp(this.zoomBy + d * 0.9, -7.5, 3);
    else m.easeTo({ zoom: m.getZoom() + d, duration: 350 });
  }
  turnNorth() {
    this.bearTo = this.bearTo === 90 ? 0 : 90;
    store.set("caminatas.north", this.bearTo === 0 ? "1" : "0");
    this.whole = null;
    this.labels();
    if (this.state === "explore" || this.state === "end") this.pull(900);
  }
  labels() {
    const north = this.bearTo === 0;
    const all = this.el.querySelector('[data-z="all"]');
    for (const [z, k] of [["in", "zoomIn"], ["out", "zoomOut"]]) { const b = this.el.querySelector(`[data-z="${z}"]`); b.setAttribute("aria-label", T[k]); b.title = T[k]; }
    const exploring = this.state === "explore";
    all.setAttribute("aria-label", exploring ? T.follow : T.whole); all.title = exploring ? T.follow : T.whole;
    all.setAttribute("aria-pressed", String(exploring));
    const b3 = this.el.querySelector('[data-z="3d"]');
    b3.setAttribute("aria-label", this.three ? T.view2d : T.view3d); b3.title = this.three ? T.view2d : T.view3d;
    b3.setAttribute("aria-pressed", String(this.three));
    this.compass.setAttribute("aria-label", north ? T.compassNorth : T.compassEast);
    this.compass.title = north ? T.compassNorth : T.compassEast;
  }
  overview() {
    if (!this.whole) {
      const c = this.map.cameraForBounds(this.bounds, { bearing: this.bearTo, padding: { top: 64, bottom: 40, left: 30, right: 30 } });
      this.whole = { center: c.center, zoom: c.zoom };
    }
    return this.whole;
  }
  pull(ms) { const o = this.overview(); this.map.easeTo({ center: o.center, zoom: o.zoom, bearing: this.bearTo, pitch: 0, duration: ms, easing: t => 1 - Math.pow(1 - t, 3) }); }
  followZoom() { return (this.w < 300 ? 11.7 : 12.1) + this.zoomBy; }
  explore(on, { pull = true } = {}) {
    clearTimeout(this._later);
    if (on && this.state !== "follow") return;
    if (!on && this.state !== "explore") return;
    this.state = on ? "explore" : "follow";
    this.el.classList.toggle("exploring", on);
    this.labels();
    this.handlers(on);
    const m = this.map;
    if (on) {
      if (!pull) {   }
      else if (this.coarse) setTimeout(() => { if (this.state === "explore") { m.resize(); this.whole = null; this.pull(1100); } }, 480);
      else this.pull(1100);
    } else {
      m.stop();
      this.catchUp();
      this.select(null);
    }
    this.onExplore?.(on);
  }
  catchUp() {
    const m = this.map, c = ML.MercatorCoordinate.fromLngLat(m.getCenter());
    this.cam = { x: c.x, y: c.y, z: m.getZoom(), p: m.getPitch(), vx: 0, vy: 0, vz: 0, vp: 0 };
    this.bear = m.getBearing();
  }
  begin() {
    if (this.state !== "intro") return;
    this.reveal = Infinity;
    const z = this.followZoom(), p = this.at(this.head), b = this.bearTo * Math.PI / 180;
    const ahead = (this.h * 0.1) / (512 * Math.pow(2, z));
    const center = new ML.MercatorCoordinate(p.x + Math.sin(b) * ahead, p.y - Math.cos(b) * ahead).toLngLat();
    this.state = "landing";
    this.map.flyTo({ center, zoom: z, bearing: this.bearTo, pitch: 0, duration: 1400, curve: 1.25, essential: true });
    this.map.once("moveend", () => { if (this.state === "landing") { this.state = "follow"; this.catchUp(); } });
  }
  home() {
    this.state = "intro";
    this.el.classList.remove("exploring");
    this.handlers(false);
    this.map.stop();
    this.reveal = 0;
    this._placed = false;
    for (const t of this.towns) t.litAt = 0;
    this.whole = null;
    this.select(null);
  }
  finale() { this.state = "end"; this.whole = null; const o = this.overview(); this.map.easeTo({ center: o.center, zoom: o.zoom, bearing: this.bearTo, pitch: 0, duration: 4200 }); }
  atLonLat(r) {
    const P = this.reel.route.pts;
    let k = 1;
    while (k < P.length - 1 && P[k][2] < r) k++;
    return [P[k - 1][0], P[k - 1][1]];
  }
  at(r) {
    const R = this.R;
    let lo = 0, hi = this.n - 1;
    if (r <= R[0]) return { k: 0, u: 0, x: this.mx[0], y: this.my[0] };
    if (r >= R[hi]) return { k: hi - 1, u: 1, x: this.mx[hi], y: this.my[hi] };
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (R[mid] <= r) lo = mid; else hi = mid; }
    const u = R[hi] > R[lo] ? (r - R[lo]) / (R[hi] - R[lo]) : 0;
    return { k: lo, u, x: this.mx[lo] + (this.mx[hi] - this.mx[lo]) * u, y: this.my[lo] + (this.my[hi] - this.my[lo]) * u };
  }
  frame(dt) {
    const m = this.map;
    if (!m) return;
    if (this.calm && this.state !== "explore" && performance.now() - (this._painted || 0) < 120) return;
    if (this.state === "intro") {
      const d = turn(this.bear, this.bearTo);
      this.bear += d * (1 - Math.exp(-dt / 0.4));
      if (!this._placed || Math.abs(d) > 0.01) { const o = this.overview(); m.jumpTo({ center: o.center, zoom: o.zoom, bearing: this.bear, pitch: 0 }); this._placed = true; }
    } else if (this.state === "follow") {
      const step = this._lastHead != null ? Math.abs(this.head - this._lastHead) : 0;
      const sp = !this.glide && step < 0.3 && dt > 0 ? step / dt : 0;
      this._lastHead = this.head;
      this.speed += (sp - this.speed) * (1 - Math.exp(-dt / 0.6));
      const three = this.three;
      const lift = three ? clamp(Math.max(Math.log2(1 + (this.glide || 0) / 0.3), Math.log2(1 + this.speed / 0.012)), 0, 5) : 0;
      const flying = (this.glide || 0) > 0.6;
      const lift2 = three ? 0 : clamp(Math.log2(1 + (this.glide || 0) / 1.2), 0, 3.2);
      this.bear += turn(this.bear, three ? (flying ? this.bear : this.headingAt(this.head)) : this.bearTo) * (1 - Math.exp(-dt / (three ? 1.3 : 0.45)));
      const z = three ? clamp(16.9 + this.zoom3 - lift, 12, 18.5) : this.followZoom() - lift2;
      const pitchTo = three ? clamp(this.pitch3 - lift * 8, 28, this.pitch3) : 0;
      const p = this.at(this.head);
      const cz = this.cam?.z ?? z, cp = this.cam?.p ?? 0;
      const ahead = (this.h * (three ? 0.17 : 0.1)) / (512 * Math.pow(2, cz)) / Math.max(0.35, Math.cos(cp * Math.PI / 180));
      const b = this.bear * Math.PI / 180;
      let tx = p.x + Math.sin(b) * ahead, ty = p.y - Math.cos(b) * ahead;
      if (!this.cam) this.cam = { x: tx, y: ty, z, p: 0, vx: 0, vy: 0, vz: 0, vp: 0 };
      const slow = Math.max(0, ((this.slowUntil || 0) - performance.now()) / 3000);
      const w = 3.4 * (1 - 0.65 * slow), wz = 2.2 * (1 - 0.6 * slow), wp = 1.8, c = this.cam;
      if (this._lp && dt > 0) {
        const k = 1 - Math.exp(-dt / 0.15);
        this._pv = this._pv || { x: 0, y: 0 };
        this._pv.x += ((p.x - this._lp.x) / dt - this._pv.x) * k; this._pv.y += ((p.y - this._lp.y) / dt - this._pv.y) * k;
      }
      this._lp = { x: p.x, y: p.y };
      if (three && this._pv) { tx += this._pv.x * 2 / w; ty += this._pv.y * 2 / w; }
      for (let s = 0, h = dt / 4; s < 4; s++) {
        c.vx += (w * w * (tx - c.x) - 2 * w * c.vx) * h; c.x += c.vx * h;
        c.vy += (w * w * (ty - c.y) - 2 * w * c.vy) * h; c.y += c.vy * h;
        c.vz += (wz * wz * (z - c.z) - 2 * wz * c.vz) * h; c.z += c.vz * h;
        c.vp += (wp * wp * (pitchTo - c.p) - 2 * wp * c.vp) * h; c.p += c.vp * h;
      }
      if (!three && c.p < 0.05) { c.p = 0; c.vp = 0; }
      c.p = clamp(c.p, 0, 72);
      const L = this._camLast, sc = 512 * Math.pow(2, c.z);
      if (!L || Math.hypot((c.x - L.x) * sc, (c.y - L.y) * sc) > 0.05 || Math.abs(c.z - L.z) > 1e-4 || Math.abs(this.bear - L.b) > 0.01 || Math.abs(c.p - L.p) > 0.01) {
        m.jumpTo({ center: new ML.MercatorCoordinate(c.x, c.y).toLngLat(), zoom: c.z, bearing: this.bear, pitch: c.p });
        this._camLast = { x: c.x, y: c.y, z: c.z, b: this.bear, p: c.p };
      }
    } else {
      this.bear = m.getBearing();
    }
    this.show3d((this.three && this.state === "follow") || m.getPitch() > 0.5);
    if (this._on3d) this.sync3d();
    if (this._on3d && !this._lite && this.map.getTerrain() && this.state === "follow" && !(this.glide > 0)) {
      this._fps = (this._fps ?? dt) + (dt - (this._fps ?? dt)) * 0.1;
      if (this._fps > 0.045) { this._slowSince ??= performance.now(); if (performance.now() - this._slowSince > 2000) { this._lite = true; this.map.setTerrain(null); } }
      else this._slowSince = null;
    }
    this.needle.setAttribute("transform", `rotate(${(-this.bear).toFixed(2)})`);
    this._painted = performance.now();
    if (performance.now() - (this._renderedAt || 0) > 20) this.draw();
  }
  viewBox(m, tilted, mc) {
    if (tilted) { const r = 2.4e-4; return [mc.x - r, mc.y - r, mc.x + r, mc.y + r]; }
    const xs = [], ys = [];
    for (const [px, py] of [[0, 0], [this.w, 0], [0, this.h], [this.w, this.h]]) { const q = ML.MercatorCoordinate.fromLngLat(m.unproject([px, py])); xs.push(q.x); ys.push(q.y); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mx = (x1 - x0) * 0.15, my = (y1 - y0) * 0.15;
    return [x0 - mx, y0 - my, x1 + mx, y1 + my];
  }
  draw() {
    const m = this.map;
    if (!this.w) return;
    const now = performance.now(), dt = Math.min(0.1, (now - this.t) / 1000); this.t = now;
    const c = m.getCenter(), ptr = this.pointer;
    const sig = [c.lng.toFixed(7), c.lat.toFixed(7), m.getZoom().toFixed(4), m.getBearing().toFixed(2), m.getPitch().toFixed(2), this.state,
      Math.round((this.head || 0) * 1000), this.hover, this.sel, ptr ? `${Math.round(ptr[0])},${Math.round(ptr[1])}` : "", Number.isFinite(this.reveal) ? Math.round(this.reveal * 100) : "all",
      this.current, this.only ? this.only.size : 0, this.riding ? 1 : 0, T.title?.() ?? "", this.w, this.h, this.revealAt ? 1 : 0].join("|");
    if (sig !== this._sig || this._animating) { this._sig = sig; this._animating = false; this.drawStill(now, dt); }
    this.drawMoving(now);
  }
  drawMoving(now) {
    const ctx = this.dctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const w = this._walker;
    if (!w) return;
    const { hx, hy, intro, dot } = w;
    if (!intro && this.riding && this.head > this.riding.r0 + 0.02 && this.head < this.riding.r1 - 0.02) this.vehicle(ctx, hx, hy, this.riding.mode);
    else if (!intro) {
      const pulse = (Math.sin(now / 420) + 1) / 2;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 34);
      g.addColorStop(0, `rgba(${EMBER},.45)`); g.addColorStop(1, `rgba(${EMBER},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 34, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,236,226,${0.25 + 0.35 * (1 - pulse)})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(hx, hy, 7 + pulse * 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#FFF4EC"; ctx.beginPath(); ctx.arc(hx, hy, 3.6, 0, Math.PI * 2); ctx.fill();
      if (this.progress != null) {
        ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(${HOT},.95)`; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(hx, hy, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, 1 - this.progress)); ctx.stroke();
      }
    } else if (dot) {
      ctx.fillStyle = "#FFF4EC"; ctx.beginPath(); ctx.arc(dot[0], dot[1], 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawStill(now, dt) {
    const m = this.map, ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const c = m.getCenter(), mc = ML.MercatorCoordinate.fromLngLat(c), e = 1e-5;
    const tilted = m.getPitch() > 0.5;
    let X, Y;
    if (!tilted) {
      const p0 = m.project(c), p1 = m.project(new ML.MercatorCoordinate(mc.x + e, mc.y).toLngLat()), p2 = m.project(new ML.MercatorCoordinate(mc.x, mc.y + e).toLngLat());
      const ax = (p1.x - p0.x) / e, ay = (p1.y - p0.y) / e, bx = (p2.x - p0.x) / e, by = (p2.y - p0.y) / e;
      X = (x, y) => p0.x + ax * (x - mc.x) + bx * (y - mc.y);
      Y = (x, y) => p0.y + ay * (x - mc.x) + by * (y - mc.y);
    } else {
      const pr = m.getPitch() * Math.PI / 180, br = m.getBearing() * Math.PI / 180;
      const dist = (m.transform?.cameraToCenterDistance || 1.5 * this.h) / (512 * Math.pow(2, m.getZoom()));
      const cam = { x: mc.x - Math.sin(br) * Math.sin(pr) * dist, y: mc.y + Math.cos(br) * Math.sin(pr) * dist, z: Math.cos(pr) * dist };
      const fx = mc.x - cam.x, fy = mc.y - cam.y, fz = -cam.z, back = Math.hypot(fx, fy);
      const far = Math.max(4e-5, back * 7);
      const OFF = [-1e5, -1e5];
      let lx = NaN, ly = NaN, lv = OFF;
      const proj = (x, y) => {
        if (x === lx && y === ly) return lv;
        lx = x; ly = y;
        const dx = x - cam.x, dy = y - cam.y;
        if ((dx * fx + dy * fy + -cam.z * fz) <= 0.15 * (fx * fx + fy * fy + fz * fz) || Math.hypot(x - mc.x, y - mc.y) > far) return (lv = OFF);
        const q = m.project(new ML.MercatorCoordinate(x, y, 0).toLngLat());
        return (lv = [q.x, q.y]);
      };
      X = (x, y) => proj(x, y)[0];
      Y = (x, y) => proj(x, y)[1];
    }
    const { sx, sy, mx, my, n } = this;
    const view = this._view = this.viewBox(m, tilted, mc);
    sx.fill(OFF_SCREEN); sy.fill(OFF_SCREEN);
    for (let ci = 0; ci < this.chunks.length; ci++) {
      const bx = this.chunks[ci];
      if (bx[2] < view[0] || bx[0] > view[2] || bx[3] < view[1] || bx[1] > view[3]) continue;
      const k1 = Math.min(n - 1, (ci + 1) * CHUNK + 3);
      for (let k = Math.max(0, ci * CHUNK - 3); k <= k1; k++) { sx[k] = X(mx[k], my[k]); sy[k] = Y(mx[k], my[k]); }
    }
    const zoom = m.getZoom();
    const intro = this.state === "intro";
    const shown = intro ? this.reveal : Infinity;
    const head = intro ? -1 : this.head;
    const hp = this.at(Math.max(0, head)), hx = X(hp.x, hp.y), hy = Y(hp.x, hp.y);
    const dirAt = r => {
      const k = this.at(r).k, k0 = Math.max(0, k - 2), k1 = Math.min(n - 1, k + 3);
      let dx = sx[k1] - sx[k0], dy = sy[k1] - sy[k0];
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };
    const kind = mode => RIDES.has(mode) ? "ride" : "foot";
    const paths = { wfoot: new Path2D(), afoot: new Path2D(), wride: new Path2D(), aride: new Path2D() };
    const last = {};
    const seg = (key, x0, y0, x1, y1) => {
      const l = last[key];
      if (!l || l[0] !== x0 || l[1] !== y0) paths[key].moveTo(x0, y0);
      paths[key].lineTo(x1, y1);
      last[key] = [x1, y1];
    };
    const W = this.w, H = this.h, pad = 60;
    for (let k = 0; k < (tilted ? 0 : n - 1); k++) {
      if (this.R[k] > shown) break;
      let x0 = sx[k], y0 = sy[k], x1 = sx[k + 1], y1 = sy[k + 1];
      if (x0 === OFF_SCREEN || x1 === OFF_SCREEN) continue;
      if (Math.max(x0, x1) < -pad || Math.min(x0, x1) > W + pad || Math.max(y0, y1) < -pad || Math.min(y0, y1) > H + pad) continue;
      if (this.mode[k] === "hidden") continue;
      const kd = kind(this.mode[k]);
      if (intro && this.R[k + 1] > shown) { const u = (shown - this.R[k]) / (this.R[k + 1] - this.R[k] || 1); x1 = x0 + (x1 - x0) * u; y1 = y0 + (y1 - y0) * u; }
      if (k < hp.k) seg("w" + kd, x0, y0, x1, y1);
      else if (k === hp.k && head >= 0) { seg("w" + kd, x0, y0, hx, hy); seg("a" + kd, hx, hy, x1, y1); }
      else seg("a" + kd, x0, y0, x1, y1);
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${INK},.28)`; ctx.lineWidth = 1.2; ctx.stroke(paths.afoot);
    ctx.strokeStyle = `rgba(${RAIL},.32)`; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.stroke(paths.aride); ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${EMBER},.16)`; ctx.lineWidth = 9; ctx.stroke(paths.wfoot);
    ctx.strokeStyle = `rgba(${EMBER},.22)`; ctx.lineWidth = 4.5; ctx.stroke(paths.wfoot);
    ctx.strokeStyle = `rgba(${HOT},1)`; ctx.lineWidth = 2.2; ctx.stroke(paths.wfoot);
    ctx.strokeStyle = `rgba(${RAIL},.14)`; ctx.lineWidth = 5; ctx.stroke(paths.wride);
    ctx.strokeStyle = `rgba(${RAIL},.7)`; ctx.lineWidth = 1.6; ctx.stroke(paths.wride);
    const sc = this.sel != null && !tilted ? this.clips[this.sel] : null;
    if (sc && sc.mx == null) { const q = this.at(sc.r); sc.mx = q.x; sc.my = q.y; }
    const ptr = sc ? [X(sc.mx, sc.my), Y(sc.mx, sc.my)] : this.pointer;
    this._aim = ptr;
    const base = clamp((zoom - 10.6) / 1.1, 0, 1);
    const close = zoom > 11.5;
    let near = null, nearD = 22;
    for (const cl of tilted ? [] : this.clips) {
      if (cl.r > shown) break;
      if (this.only && !this.only.has(cl.i)) continue;
      if (cl.mx == null) { const q = this.at(cl.r); cl.mx = q.x; cl.my = q.y; }
      if (cl.mx < view[0] || cl.mx > view[2] || cl.my < view[1] || cl.my > view[3]) { cl.x = OFF_SCREEN; cl.y = OFF_SCREEN; continue; }
      const x = X(cl.mx, cl.my), y = Y(cl.mx, cl.my);
      cl.x = x; cl.y = y;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      const cur = false, hov = cl.i === this.hover;
      let lens = 0;
      if (ptr) { const d = Math.hypot(ptr[0] - x, ptr[1] - y); lens = Math.exp(-(d * d) / (70 * 70)); if (d < nearD) { nearD = d; near = cl.i; } }
      const vis = cur || hov ? 1 : Math.max(base, lens);
      if (vis < 0.03) continue;
      const [dx, dy] = dirAt(cl.r);
      const played = !intro && cl.i <= this.current;
      const L = (close ? 4 + Math.min(9, cl.dur * 0.7) : 3 + Math.min(5, cl.dur * 0.4)) * (cur || hov ? 1.9 : 1);
      ctx.strokeStyle = cur || hov ? `rgba(255,250,240,1)` : `rgba(${cl.rgb},${(played ? 0.95 : 0.4) * vis})`;
      ctx.lineWidth = cur || hov ? 2.4 : close ? 1.8 : 1.3;
      ctx.beginPath(); ctx.moveTo(x - dy * L, y + dx * L); ctx.lineTo(x + dy * L, y - dx * L); ctx.stroke();
    }
    if (near !== this.hover) { this.hover = near; this.showTip(near); }
    if (near != null && this.tipEl) { const cl = this.clips[near]; this.placeTip(cl.x, cl.y); }
    const far = zoom < 8.6;
    ctx.font = `500 ${far ? 11 : 10}px "Noto Sans", sans-serif`;
    ctx.letterSpacing = far ? "6px" : "5px";
    for (const l of tilted ? [] : this.lands) {
      if (l.far && !far) continue;
      const cx = far ? X(l.fx, l.fy) : X(l.mx, l.my), cy = far ? Y(l.fx, l.fy) : Y(l.mx, l.my);
      const text = country(l.name).toUpperCase(), tw = ctx.measureText(text).width;
      const box = [cx - tw / 2 - 4, cy - 8, cx + tw / 2 + 4, cy + 8];
      if (box[2] < 0 || box[0] > W || box[3] < 0 || box[1] > H) continue;
      ctx.fillStyle = `rgba(${INK},${l.far ? 0.22 : 0.32})`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, cx, cy);
    }
    ctx.letterSpacing = "0px";
    const boxes = [];
    if (this.tipBox) boxes.push(this.tipBox);
    const hit = box => boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    if (tilted) this.names3d(ctx, X, Y, mc, dt, boxes);
    else this.names(ctx, X, Y, zoom, shown, hx, hy, dt, boxes, dirAt);
    ctx.font = `600 9px "Noto Sans", sans-serif`;
    ctx.letterSpacing = "1.5px";
    for (const d of tilted ? [] : this.dayMarks) {
      if (d.r > shown) continue;
      const p = this.at(d.r), x = X(p.x, p.y), y = Y(p.x, p.y);
      if (x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
      const [dx, dy] = dirAt(d.r);
      let nx = -dy, ny = dx;
      const upright = Math.abs(dy) >= Math.abs(dx);
      if ((upright && nx > 0) || (!upright && ny < 0)) { nx = -nx; ny = -ny; }
      ctx.strokeStyle = `rgba(${INK},.55)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - nx * 11, y - ny * 11); ctx.lineTo(x + nx * 11, y + ny * 11); ctx.stroke();
      const label = (d.n.length > 1 ? T.days(d.n[0], d.n[1]) : `${T.day} ${d.n[0]}`).toUpperCase(), tw = ctx.measureText(label).width;
      const place = s => {
        const lx = x + nx * 15 * s, ly = y + ny * 15 * s;
        const left = upright ? s > 0 : false;
        const box = upright ? (left ? [lx - tw - 2, ly - 7, lx + 2, ly + 7] : [lx - 2, ly - 7, lx + tw + 2, ly + 7])
          : (s > 0 ? [lx - tw / 2 - 2, ly - 2, lx + tw / 2 + 2, ly + 12] : [lx - tw / 2 - 2, ly - 12, lx + tw / 2 + 2, ly + 2]);
        return { lx, ly, box, align: upright ? (left ? "right" : "left") : "center", base: upright ? "middle" : s > 0 ? "top" : "bottom" };
      };
      let q = place(1);
      if (hit(q.box)) { q = place(-1); if (hit(q.box)) continue; }
      boxes.push(q.box);
      ctx.fillStyle = `rgba(${INK},.6)`;
      ctx.textAlign = q.align; ctx.textBaseline = q.base;
      ctx.fillText(label, q.lx, q.ly);
    }
    ctx.letterSpacing = "0px";
    for (const nt of tilted ? [] : this.reel.nights) {
      if (nt.r > shown) continue;
      const p = this.at(nt.r), x = X(p.x, p.y), y = Y(p.x, p.y);
      ctx.strokeStyle = `rgba(${NIGHT},.9)`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, close ? 5 : 3.2, 0, Math.PI * 2); ctx.stroke();
    }
    let dot = null;
    if (intro && Number.isFinite(shown)) { const p = this.at(shown); dot = [X(p.x, p.y), Y(p.x, p.y)]; }
    this._walker = { hx, hy, intro, dot };
  }
  vehicle(ctx, x, y, mode) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, `rgba(${RAIL},.45)`); g.addColorStop(1, `rgba(${RAIL},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    const w = mode === "bus" || mode === "tram" ? 20 : 22, h = 12;
    ctx.fillStyle = "#FFF4EC"; ctx.strokeStyle = "rgba(11,12,14,.9)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, mode === "bus" ? 2.5 : 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(11,12,14,.85)";
    const n = mode === "bus" ? 4 : 3, ww = (w - 6) / n - 1.2;
    for (let k = 0; k < n; k++) ctx.fillRect(-w / 2 + 3 + k * (ww + 1.2), -h / 2 + 2.2, ww, 3.6);
    if (mode === "bus") { ctx.beginPath(); ctx.arc(-w / 2 + 5, h / 2, 1.9, 0, Math.PI * 2); ctx.arc(w / 2 - 5, h / 2, 1.9, 0, Math.PI * 2); ctx.fill(); }
    if (mode === "tram") { ctx.strokeStyle = "#FFF4EC"; ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(-3, -h / 2 - 5); ctx.lineTo(3, -h / 2 - 5); ctx.stroke(); }
    ctx.restore();
  }
  names(ctx, X, Y, zoom, shown, hx, hy, dt, boxes, dirAt) {
    const W = this.w, H = this.h;
    const ptr = this._aim;
    const tip = this.state === "intro" && performance.now() - (this.revealAt || 0) < 250 ? shown : null;
    const overview = this.state !== "follow";
    const minRank = zoom >= 12.6 ? 1 : zoom >= 11.2 ? 3 : zoom >= 9.8 ? 4 : 5;
    const k = 1 - Math.exp(-dt / 0.16);
    const cand = [];
    const v = this._view, mg = 160 / (512 * Math.pow(2, zoom));
    for (const t of this.towns) {
      if (v && (t.mx < v[0] - mg || t.mx > v[2] + mg || t.my < v[1] - mg || t.my > v[3] + mg)) { t.a = 0; t.x = OFF_SCREEN; t.y = OFF_SCREEN; continue; }
      const x = X(t.mx, t.my), y = Y(t.mx, t.my);
      t.x = x; t.y = y;
      if (x < -140 || x > W + 140 || y < -30 || y > H + 30 || t.r > shown) { t.a = 0; continue; }
      const wp = ptr ? Math.exp(-(((ptr[0] - x) ** 2 + (ptr[1] - y) ** 2) / (95 * 95))) : 0;
      const wh = this.state === "follow" ? Math.exp(-(((hx - x) ** 2 + (hy - y) ** 2) / (80 * 80))) : 0;
      t.w = Math.max(wp, wh * 0.55);
      if (tip != null && (t.rank >= 5 || t.slept) && t.r <= tip && !t.litAt) t.litAt = performance.now();
      const wl = t.litAt ? Math.exp(-(performance.now() - t.litAt) / 650) : 0;
      const woken = wp > (t.rank >= 3 ? 0.3 : 0.65) || (wh > 0.55 && t.rank >= 2 && zoom >= 9.5);
      const kept = t.slept && overview;
      t.want = t.rank >= minRank || woken || kept ? Math.min(1, 0.62 + 0.38 * Math.max(t.w, wl) + (t.r <= this.head || kept ? 0.2 : 0)) : 0;
      t.grow = 1 + 0.35 * wp * wp + 0.1 * wh + 0.75 * wl;
      t.lit = wl;
      t.prio = t.rank * 2 + wp * 8 + wh * 2 + (t.slept ? 3 : 0) + (t.a > 0.5 ? 3 : 0);
      if (t.want > 0 || t.a > 0.01) cand.push(t);
    }
    cand.sort((a, b) => b.prio - a.prio);
    for (const t of cand) {
      const f = this.font(t);
      const size = f.size * t.s;
      ctx.font = f.css.replace("%", size.toFixed(1));
      ctx.letterSpacing = f.track;
      const text = f.caps ? t.name.toUpperCase() : t.name;
      if (!t.tw0) { ctx.font = f.css.replace("%", f.size.toFixed(1)); t.tw0 = ctx.measureText(text).width; ctx.font = f.css.replace("%", size.toFixed(1)); }
      const tw = t.tw0 * t.s;
      const rp = this.at(t.r), rx = X(rp.x, rp.y), ry = Y(rp.x, rp.y);
      const [dx, dy] = dirAt(t.r);
      const upright = Math.abs(dy) >= Math.abs(dx);
      const off = upright ? t.x - rx : t.y - ry;
      if (!t.side || t.upright !== upright || Math.abs(off) > 14) t.side = t.off < 150 ? 1 : Math.sign(off) || 1;
      t.upright = upright;
      const dotR = t.rank >= 4 ? 2.6 : t.rank >= 2 ? 1.8 : 1.2;
      const place = side => {
        if (upright) {
          const x = t.x + side * (dotR + 5), b0 = side > 0 ? x : x - tw;
          return { lx: x, ly: t.y, align: side > 0 ? "left" : "right", box: [b0 - 3, t.y - size * 0.62, b0 + tw + 3, t.y + size * 0.62] };
        }
        const y = t.y + side * (dotR + 4 + size * 0.55);
        return { lx: t.x, ly: y, align: "center", box: [t.x - tw / 2 - 3, y - size * 0.62, t.x + tw / 2 + 3, y + size * 0.62] };
      };
      const hits = b => boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
      let p = place(t.side);
      if (t.want > 0 && hits(p.box)) { const o = place(-t.side); if (!hits(o.box)) { t.side = -t.side; p = o; } }
      const { lx, ly, align, box } = p;
      const clash = t.want > 0 && hits(box);
      const want = clash ? 0 : t.want;
      if (want > 0) boxes.push(box);
      t.a += (want - t.a) * k;
      t.s += (t.grow - t.s) * k;
      if (Math.abs(want - t.a) > 0.01 || Math.abs(t.grow - t.s) > 0.005 || (t.lit || 0) > 0.01) this._animating = true;
      if (t.a < 0.02) continue;
      const passed = t.r <= this.head;
      const through = passed && t.off < 400;
      ctx.fillStyle = through ? `rgba(${HOT},${t.a})` : `rgba(${passed ? INK : SOFT},${t.a * (passed ? 0.8 : 0.9)})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, dotR, 0, Math.PI * 2); ctx.fill();
      const lit = Math.min(1, t.w * 1.4 + (t.lit || 0) * 2);
      const ink = t.lit > 0.2 ? `rgba(255,236,190,${t.a})` : `rgba(${passed || lit > 0.5 || (t.slept && overview) ? INK : SOFT},${t.a})`;
      ctx.fillStyle = ink;
      if (t.lit > 0.2) { ctx.shadowColor = `rgba(${EMBER},${0.9 * t.lit})`; ctx.shadowBlur = 14 * t.lit; }
      else { ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = `rgba(8,9,11,${0.85 * t.a})`; }
      const x0 = align === "left" ? lx : align === "right" ? lx - tw : lx - tw / 2;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      if (t.lit <= 0.2) ctx.strokeText(text, x0, ly + (f.caps ? 0.5 : 0));
      ctx.fillText(text, x0, ly + (f.caps ? 0.5 : 0));
      ctx.shadowBlur = 0;
    }
    ctx.letterSpacing = "0px";
  }
  names3d(ctx, X, Y, mc, dt, boxes) {
    const W = this.w, H = this.h, k = 1 - Math.exp(-dt / 0.25), R = 9e-5;
    const cand = [];
    for (const t of this.towns) {
      const d = Math.hypot(t.mx - mc.x, t.my - mc.y);
      const x = d < R ? X(t.mx, t.my) : -1e5, y = d < R ? Y(t.mx, t.my) : -1e5;
      t.x3 = x; t.y3 = y; t.d3 = d;
      if (x < -60 || x > W + 60 || y < 10 || y > H) { t.a3 = 0; continue; }
      cand.push(t);
    }
    cand.sort((a, b) => b.rank - a.rank || a.d3 - b.d3);
    for (const t of cand) {
      const near = 1 - t.d3 / R, f = this.font(t), size = f.size * (0.75 + 0.35 * near);
      ctx.font = f.css.replace("%", size.toFixed(1)); ctx.letterSpacing = f.track;
      const text = f.caps ? t.name.toUpperCase() : t.name, tw = ctx.measureText(text).width;
      const box = [t.x3 - tw / 2 - 3, t.y3 - size - 8, t.x3 + tw / 2 + 3, t.y3 - 2];
      const clash = boxes.some(q => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);
      if (!clash) boxes.push(box);
      const want3 = clash ? 0 : Math.min(1, 0.35 + near);
      t.a3 = (t.a3 || 0) + (want3 - (t.a3 || 0)) * k;
      if (Math.abs(want3 - t.a3) > 0.01) this._animating = true;
      if (t.a3 < 0.03) continue;
      ctx.strokeStyle = `rgba(${INK},${0.35 * t.a3})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(t.x3, t.y3); ctx.lineTo(t.x3, t.y3 - 6); ctx.stroke();
      ctx.fillStyle = `rgba(${INK},${0.9 * t.a3})`; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = `rgba(8,9,11,${0.85 * t.a3})`;
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.strokeText(text, t.x3, t.y3 - 8);
      ctx.fillText(text, t.x3, t.y3 - 8);
    }
    ctx.letterSpacing = "0px";
  }
  font(t) {
    if (t.rank >= 5) return { css: `italic 400 %px Lora, Georgia, serif`, size: 17, track: "0px", caps: false };
    if (t.rank >= 4) return { css: `italic 400 %px Lora, Georgia, serif`, size: 13.5, track: "0px", caps: false };
    if (t.rank >= 2) return { css: `500 %px "Noto Sans", sans-serif`, size: 9, track: "1.5px", caps: true };
    return { css: `500 %px "Noto Sans", sans-serif`, size: 8.2, track: "1.3px", caps: true };
  }
  showTip(i) {
    const el = this.tip;
    if (!el) return;
    if (i == null) { el.classList.remove("on"); this.tipEl = null; this.tipBox = null; return; }
    el.innerHTML = (this.describe?.(i) || "") + (i === this.sel ? `<span class="tip-go">▶ ${T.watch}</span>` : "");
    el.classList.add("on");
    this.tipEl = el;
  }
  placeTip(x, y) {
    const r = this.el.getBoundingClientRect(), el = this.tip;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = r.left + x - w - 22, top = r.top + y - h / 2;
    if (left < 8) left = r.left + x + 22;
    top = clamp(top, 8, innerHeight - h - 8);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    this.tipBox = [left - r.left - 6, top - r.top - 6, left - r.left + w + 6, top - r.top + h + 6];
  }
}
