import { Strip } from "./strip.js";
import { Player } from "./player.js";
import { Odometer, digits, hours } from "./odometer.js";
import { unlock, tick, setMuted as muteTicks, suspend, audioContext } from "./sound.js";
import { t, lang, setLang, onLang, longDate, country } from "./i18n.js";
import { esc, clamp, lerp } from "../js/util.js";
const $ = s => document.querySelector(s);
const SHORT_CAP = 5.5;
const index = await (await fetch("data/trips.json")).json();
const [wanted, at] = location.hash.slice(1).split("/");
const trip = index.trips.find(x => x.id === wanted && x.reel) || index.trips.find(x => x.reel);
if (!trip) {
  $("#start").innerHTML = `<div class="s-in"><p class="s-lede">node tools/build.mjs</p></div>`;
  throw new Error("no reel");
}
const reel = await (await fetch(`data/${trip.id}-reel.json`)).json();
const clips = reel.clips, days = reel.days;
const extra = { cover: () => "", label: () => {}, key: () => false };
const local = !index.public && ["localhost", "127.0.0.1"].includes(location.hostname);
const sharedAt = /^\d+$/.test(at || "") && +at < clips.length ? +at : null;
const tz = /^([+-])(\d\d):(\d\d)$/.exec(reel.timezone || "+00:00");
const OFF = (tz[1] === "-" ? -1 : 1) * (+tz[2] * 60 + +tz[3]) * 60000;
const minutes = ms => (ms + OFF) / 60000;
const clockText = ms => new Date(ms + OFF).toISOString().slice(11, 16);
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const km1 = v => v.toFixed(1).replace(".", t.decimal);
const RADIUS = { 5: 5, 4: 2.2, 3: 1.1, 2: 0.9, 1: 0.55 };
const dist = (a, b) => Math.hypot((b[0] - a[0]) * 111.32 * Math.cos(a[1] * Math.PI / 180), (b[1] - a[1]) * 110.57);
function placeOf(p) {
  let best = null, score = Infinity, big = null, bigScore = Infinity, near = null, nearD = Infinity;
  for (const town of reel.towns) {
    if (town.rank < 1 || Math.abs(town.at[1] - p[1]) > 0.08) continue;
    const d = dist(p, town.at), s = d / RADIUS[town.rank];
    if (s < score) { score = s; best = town; }
    if (town.rank >= 4 && s < bigScore) { bigScore = s; big = town; }
    if (town.rank >= 3 && d < nearD) { nearD = d; near = town; }
  }
  if (best && score <= 1) return { name: best.name, in: true, big: big && bigScore <= 1 && big !== best ? big.name : null };
  return near ? { name: near.name, in: false } : null;
}
const places = [];
clips.forEach((c, i) => { places[i] = c.at ? placeOf(c.at) : places[i - 1] || null; });
const countryAt = r => (reel.countries || []).find(c => r >= c.r0 - 0.001 && r <= c.r1 + 0.001)?.name || null;
const dayStart = days.map(d => clips[d.clip].t);
const dayEnd = days.map((d, k) => { const next = days[k + 1]?.clip ?? clips.length; const c = clips[next - 1]; return c.t + c.dur * 1000; });
const filmedBefore = [0];
clips.forEach((c, i) => filmedBefore.push(filmedBefore[i] + c.dur));
const span = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
const player = new Player($("#frame"));
const strip = new Strip($("#strip"), reel, {
  tip: $("#tip"),
  onPick: i => {
    if (!started) return begin("walk", i);
    if (mode === "short" && reel.short.includes(i)) pos = reel.short.indexOf(i);
    go(i, { jump: true });
  },
  onExplore: on => {
    const touch = strip.coarse;
    $("#close-map").hidden = !(on && touch);
    document.body.classList.toggle("exploring", on);
    clearTimeout(hintTimer);
    $("#map-hint").classList.toggle("on", on && touch);
    if (on && touch) hintTimer = setTimeout(() => $("#map-hint").classList.remove("on"), 4500);
    if (on && touch && !history.state?.map) history.pushState({ ...history.state, map: 1 }, "", location.href);
    if (!on && history.state?.map) history.back();
  },
});
let hintTimer = null;
strip.describe = i => {
  const c = clips[i], d = days[c.day], pl = places[i];
  return `<img src="${esc(c.still)}" alt=""><p>${pl ? `<i>${esc(pl.name)}</i>` : ""}${t.day} ${d.n}, ${esc(longDate(d.date))}<br>${clockText(c.t)} <span>· ${t.tipKm(km1(c.f))}</span></p>`;
};
let kmOdo;
const dayOdo = new Odometer($(".g-dayn"), [{ labels: days.map(d => String(d.n)) }]);
const clockOdo = new Odometer($(".g-clock"), [{ labels: hours }, ":", { labels: digits(6) }, { labels: digits(10) }]);
const makeKm = () => { kmOdo = new Odometer($(".g-kmodo"), [{ labels: digits(10) }, { labels: digits(10) }, { labels: digits(10) }, t.decimal, { labels: digits(10) }], { lead: true }); };
makeKm();
const shown = { r: 0, f: 0, clock: minutes(clips[0].t), day: 0 };
let cur = -1, glide = null, lastHour = null, paused = false, started = false, glowTimer = null;
let waiting = false, rideTimer = null, startTimer = null, pendingStart = null, entryTimers = [];
let mode = "walk", pos = 0;
const cap = () => mode === "short" ? SHORT_CAP : null;
function words() {
  document.title = t.docTitle;
  document.querySelectorAll("#lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $("#home span").textContent = t.home;
  $("#prev").setAttribute("aria-label", t.prev); $("#prev").title = t.prev;
  $("#next").setAttribute("aria-label", t.next); $("#next").title = t.next;
  $("#share").setAttribute("aria-label", t.share); $("#share").title = t.share;
  $("#jump").setAttribute("aria-label", t.jump); $("#jump").title = t.jump;
  $("#close-map").textContent = t.backToFilm;
  $("#map-hint").textContent = t.mapHint;
  $(".g-k").textContent = t.day;
  $(".g-of").textContent = t.of(days.length);
  $(".g-unit-k").textContent = t.kmUnit;
  $(".g-from").textContent = t.fromDoor(reel.from);
  $(".f-pause").textContent = t.paused;
  $("#frame").setAttribute("aria-label", `${reel.from} ${t.to} ${reel.to}`);
  $("#strip").setAttribute("aria-label", lang === "es" ? "El camino, con el este arriba" : "The way, east up");
  pauseLabel(); soundLabel(); extra.label();
  strip.labels?.();
  cover();
  if (!$("#end").hidden) ending();
  if (cur >= 0) { $(".g-date").dataset.v = ""; $(".g-place").dataset.v = ""; describe(cur, 1); ratio(); }
  const v = kmOdo.value; makeKm(); if (v != null) kmOdo.set(v);
}
function cover() {
  const when = sharedAt != null ? `${t.day} ${days[clips[sharedAt].day].n}, ${clockText(clips[sharedAt].t)}` : null;
  $(".s-in").innerHTML = `
    <h1>${t.title()}</h1>
    <p class="s-sub">${t.sub(Math.round(reel.km))}</p>
    <p class="s-lede">${t.lede()}</p>
    <div class="s-ways">
      <button type="button" class="s-way s-main" data-way="walk"><b>${t.walk}</b></button>
    </div>
    <p class="s-alt"><button type="button" class="s-link" data-way="short">${t.orShort}</button></p>
    ${when ? `<p class="s-shared"><button type="button" data-way="shared">${esc(t.shared(when))}</button></p>` : ""}
    ${extra.cover()}`;
  $(".s-made").innerHTML = t.made;
  if (!performance.getEntriesByName("caminatas:cover").length) performance.mark("caminatas:cover");
  document.querySelectorAll("[data-way]").forEach(b => b.onclick = () => b.dataset.way === "shared" ? begin("walk", sharedAt) : begin(b.dataset.way));
}
const field = { el: $(".s-field"), live: 0, timer: null };
const pool = clips.map((c, i) => i).filter(i => clips[i].dur >= 6);
function fragment() {
  const W = field.el.clientWidth, H = field.el.clientHeight;
  if (!W || !H) return;
  const i = pool[Math.floor(Math.random() * pool.length)], c = clips[i], pl = places[i];
  const tall = H * (strip.coarse ? 0.62 + Math.random() * 0.4 : 0.42 + Math.random() * 0.46), wide = tall * 9 / 16;
  let left = 0, top = 0;
  for (let k = 0; k < 12; k++) {
    left = Math.random() * (W - wide * 0.55) - wide * 0.2; top = Math.random() * (H - tall * 0.7) - tall * 0.15;
    const sx = left + wide / 2, sy = top + tall * 0.73;
    if (![...field.el.querySelectorAll(".s-frag")].some(o => Math.abs(+o.dataset.sx - sx) < 260 && Math.abs(+o.dataset.sy - sy) < 90)) break;
  }
  const f = document.createElement("figure");
  f.className = "s-frag";
  f.tabIndex = 0;
  f.setAttribute("role", "button");
  f.dataset.clip = i;
  f.setAttribute("aria-label", t.enterAt(days[c.day].n, clockText(c.t), pl?.name));
  f.dataset.sx = left + wide / 2; f.dataset.sy = top + tall * 0.73;
  Object.assign(f.style, { width: `${wide}px`, height: `${tall}px`, left: `${left}px`, top: `${top}px` });
  f.style.setProperty("--o", (0.15 + Math.random() * 0.15).toFixed(2));
  f.innerHTML = `<video muted playsinline preload="auto"></video><figcaption>${t.day} ${days[c.day].n} · ${clockText(c.t)}${pl ? " · " + esc(pl.name) : ""}</figcaption>`;
  const v = f.querySelector("video");
  const hold = Math.min(2800 + Math.random() * 2600, (c.dur - 2.6) * 1000);
  v.src = `${c.src}#t=${(Math.random() * Math.max(0, c.dur - hold / 1000 - 2.4)).toFixed(1)}`;
  field.el.append(f);
  field.live++;
  let shown = false, gone = false;
  const drop = () => { if (gone) return; gone = true; v.pause(); v.removeAttribute("src"); v.load(); f.remove(); field.live--; };
  let leaving = null;
  const fadeOut = ms => { clearTimeout(leaving); if (!stillness) leaving = setTimeout(() => { if (f.matches(":hover, :focus")) return; f.classList.remove("on"); leaving = setTimeout(drop, 1900); }, ms); };
  const hold_ = () => { clearTimeout(leaving); v.loop = true; f.classList.add("on", "held"); };
  const release = () => { f.classList.remove("held"); fadeOut(1200); };
  f.addEventListener("pointerenter", hold_); f.addEventListener("focus", hold_);
  f.addEventListener("pointerleave", release); f.addEventListener("blur", release);
  const enter = () => { if (!started) begin("walk", i); };
  f.addEventListener("click", enter);
  f.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); } });
  v.addEventListener("canplay", () => {
    if (shown || gone || started) return;
    shown = true;
    v.play().catch(() => {});
    requestAnimationFrame(() => f.classList.add("on"));
    if (!performance.getEntriesByName("caminatas:fragment").length) performance.mark("caminatas:fragment");
    fadeOut(hold);
  }, { once: true });
  setTimeout(() => { if (!shown) drop(); }, 4000);
}
const saveData = !!navigator.connection?.saveData;
const stillness = matchMedia("(prefers-reduced-motion: reduce)").matches;
function heroStep() {
  clearTimeout(field.timer);
  if (started) return;
  if (stillness && field.live >= 1) return;
  if (field.live < (saveData || strip.coarse ? 1 : 3)) fragment();
  field.timer = setTimeout(heroStep, 900 + Math.random() * 1500);
}
function heroStop() { clearTimeout(field.timer); for (const v of field.el.querySelectorAll("video")) { v.pause(); v.removeAttribute("src"); v.load(); } field.el.innerHTML = ""; field.live = 0; }
const snap = m => { const w = Math.floor(m), f = m - w; return w + ease(clamp((f - 0.97) / 0.03, 0, 1)); };
const live = c => ({
  r: c.move && !waiting ? c.r + Math.min(c.move.max, c.move.v * player.time()) : c.r,
  f: Math.round(c.f * 10) / 10, clock: snap(minutes(c.t + (waiting ? 0 : player.time()) * 1000)), day: c.day });
let last = performance.now(), ratioAt = 0, countShown = null;
const RING = 2 * Math.PI * 15;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (cur >= 0 && started) {
    const target = live(clips[cur]);
    if (glide) {
      const u = clamp((now - glide.t0) / (glide.dur * 1000), 0, 1), e = ease(u);
      for (const k of ["r", "f", "clock", "day"]) shown[k] = lerp(glide.from[k], target[k], e);
      if (u >= 1) glide = null;
    } else Object.assign(shown, target);
    const len = Math.min(clips[cur].dur, cap() ?? Infinity), gone = clamp(player.time() / len, 0, 1);
    const left = Math.max(0, Math.ceil(len - player.time() - 0.05));
    if (left !== countShown) { countShown = left; $(".f-count b").textContent = left; }
    $(".f-ring").style.strokeDashoffset = (RING * gone).toFixed(1);
    $(".f-prog i").style.transform = `scaleX(${gone.toFixed(4)})`;
    strip.progress = waiting ? null : gone;
  } else strip.progress = null;
  const hr = Math.floor(shown.clock / 60);
  if (glide && lastHour != null && hr !== lastHour) tick(0.9);
  lastHour = hr;
  clockOdo.set(shown.clock);
  kmOdo.set(Math.round(shown.f * 1000) / 100);
  dayOdo.set(shown.day);
  if (!glide) { clockOdo.settle(); kmOdo.settle(); dayOdo.settle(); }
  strip.head = shown.r;
  strip.glide = glide && cur >= 0 ? Math.abs(live(clips[cur]).r - glide.from.r) : 0;
  strip.calm = paused || document.hidden;
  strip.frame(dt);
  if (cur >= 0 && started && now - ratioAt > 250) { ratioAt = now; ratio(); }
  requestAnimationFrame(frame);
}
function ratio() {
  const c = clips[cur];
  const filmed = filmedBefore[cur] + player.time();
  let road = 0;
  for (let d = 0; d < c.day; d++) road += dayEnd[d] - dayStart[d];
  road += Math.max(0, c.t + player.time() * 1000 - dayStart[c.day]);
  const f = filmed >= 60 ? `${Math.floor(filmed / 60)} min ${String(Math.floor(filmed % 60)).padStart(2, "0")} s` : `${Math.floor(filmed)} s`;
  $(".g-ratio").innerHTML = t.ratio(f, span(road));
}
function slide(el, html, dir = 1) {
  if (el.dataset.v === html) return;
  el.dataset.v = html;
  const back = dir < 0 ? " back" : "";
  for (const o of [...el.children]) { o.className = "leave" + back; setTimeout(() => o.remove(), 750); }
  const s = document.createElement("span");
  s.innerHTML = html;
  s.className = "enter" + back;
  el.append(s);
  void s.offsetWidth;
  s.className = "";
}
function describe(i, dir) {
  const c = clips[i], pl = places[i];
  slide($(".g-date"), esc(longDate(days[c.day].date)), dir);
  const land = countryAt(c.r), under = [pl && !pl.in ? t.near : null, pl?.big, land && country(land)].filter(Boolean).join(" · ");
  slide($(".g-place"), pl ? `${esc(pl.name)}${under ? `<small>${esc(under)}</small>` : ""}` : "", dir);
  const site = c.site != null ? reel.sites[c.site] : null, el = $(".g-site");
  if (site) el.innerHTML = `<b>UNESCO</b><i>${esc(site[lang] || site.en)}</i>`;
  el.classList.toggle("on", !!site);
}
const ICON = {
  bus: '<path d="M6 17 V6 C6 4.5 7 4 9 4 H15 C17 4 18 4.5 18 6 V17 M6 12 H18 M6 8 H18 M8.5 17 V19.5 M15.5 17 V19.5 M6 17 H18"/>',
  train: '<path d="M7 16 V6 C7 4.5 8.5 3.5 12 3.5 C15.5 3.5 17 4.5 17 6 V16 C17 17 16 17.5 15 17.5 H9 C8 17.5 7 17 7 16 Z M7 11 H17 M9.5 17.5 L7.5 20.5 M14.5 17.5 L16.5 20.5 M10 14.3 H10.01 M14 14.3 H14.01"/>',
  tram: '<path d="M7 17 V8 C7 7 8 6.5 9 6.5 H15 C16 6.5 17 7 17 8 V17 Z M7 12.5 H17 M9 3.5 H15 M12 3.5 V6.5 M9.5 17 L8 20 M14.5 17 L16 20"/>',
  metro: '<path d="M7 16 V6 C7 4.5 8.5 3.5 12 3.5 C15.5 3.5 17 4.5 17 6 V16 C17 17 16 17.5 15 17.5 H9 C8 17.5 7 17 7 16 Z M9.5 8.5 L12 11.5 L14.5 8.5 M9.5 13 V8.5 M14.5 13 V8.5 M9.5 17.5 L7.5 20.5 M14.5 17.5 L16.5 20.5"/>',
};
function showRide(ride, secs) {
  const el = $(".f-ride"), clean = s => String(s || "").replace(/ \((metro|tram)\)$/, "");
  el.dataset.mode = ride.mode;
  el.innerHTML = ride.mode === "metro"
    ? `<div class="r-sign r-metro"><svg class="r-ring" viewBox="0 0 80 80"><rect x="4" y="4" width="72" height="72" rx="14"/><rect class="r-fill" x="4" y="4" width="72" height="72" rx="14" pathLength="100"/></svg><b>M</b></div>`
    : `<div class="r-sign"><svg class="r-ring" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36"/><circle class="r-fill" cx="40" cy="40" r="36" pathLength="100"/></svg>
    <svg class="r-ico" viewBox="0 0 24 24">${ICON[ride.mode] || ICON.train}</svg></div>`;
  el.innerHTML += `
<p><b>${esc(t.onBoard[ride.mode] || ride.mode)}${ride.line ? " " + esc(ride.line) : ""}</b>${esc(clean(ride.from))} → ${esc(clean(ride.to))}</p>`;
  el.querySelector(".r-fill").style.animationDuration = `${secs.toFixed(2)}s`;
  document.body.classList.add("riding");
  strip.riding = ride;
}
function hideRide() { document.body.classList.remove("riding"); strip.riding = null; clearTimeout(rideTimer); waiting = false; }
let cutTimer = null;
function caption(prev, c) {
  const el = $(".g-cut");
  const gap = c.t - (prev.t + prev.dur * 1000), dkm = c.f - prev.f;
  const night = c.day !== prev.day ? reel.nights.find(n => n.r >= prev.r - 0.01 && n.r <= c.r + 0.01) : null;
  const ride = reel.rides.find(r => r.r0 >= prev.r - 0.05 && c.r > r.r0 + 0.05 && r.r0 <= c.r);
  const a = countryAt(prev.r), b = countryAt(c.r);
  const clean = s => String(s || "").replace(/ \((metro|tram)\)$/, "");
  let html = null, cls = "", hold = 0;
  if (c.day !== prev.day) { html = `<b>${t.night}</b>${night ? esc(night.town) + "<br>" : ""}${t.later(span(gap))}`; hold = 3.6; }
  else if (ride) { html = `<b>${t.by[ride.mode] || esc(ride.mode)}</b>${esc(clean(ride.from))} ${t.to} ${esc(clean(ride.to))}`; cls = "rail"; hold = 3; }
  else if (a && b && a !== b) { html = `<b>${t.border}</b>${esc(country(a))} ${t.to} ${esc(country(b))}`; hold = 3.4; }
  else if (gap > 90000 || dkm > 0.3) { html = `<b>${t.notFilmed}</b>${span(gap)}${dkm >= 0.1 ? ` · ${km1(dkm)} km` : ""}`; hold = 1.4 + Math.min(1.8, Math.log2(1 + gap / 600000)); }
  clearTimeout(cutTimer);
  if (!html) { el.classList.remove("on"); return; }
  el.innerHTML = html;
  el.className = "g-cut on " + cls;
  cutTimer = setTimeout(() => el.classList.remove("on"), hold * 1000);
}
function go(i, { jump = false } = {}) {
  if (i < 0) i = 0;
  if (i >= clips.length) return finale();
  $("#end").hidden = true;
  const prev = cur >= 0 ? clips[cur] : null, c = clips[i];
  const dir = prev && i < cur ? -1 : 1;
  const from = { ...shown };
  const dMin = Math.abs(minutes(c.t) - from.clock), dKm = Math.abs(c.r - from.r);
  const g = Math.max(dMin / 20, dKm * 1.2);
  const onward = prev && !jump && (i === cur + 1 || (mode === "short" && i > cur));
  const ride = onward && mode !== "short" ? reel.rides.find(r => r.r0 >= prev.r - 0.05 && c.r > r.r0 + 0.05 && r.r0 <= c.r) : null;
  let dur = jump ? clamp(1.4 + 0.45 * Math.log2(1 + dKm), 1.4, 3.2) : clamp(0.35 + 0.42 * Math.log2(1 + g), mode === "short" ? 0.6 : 0.9, 2.8);
  if (ride) dur = ride.mode === "train" ? clamp(3 + ride.km / 10, 3.3, 4.3) : clamp(2.4 + ride.km / 8, 2.6, 3.4);
  if (stillness) dur = Math.min(dur, 0.4);
  glide = cur < 0 ? null : { from, t0: performance.now(), dur };
  hideRide();
  if (onward) caption(prev, c); else $(".g-cut").classList.remove("on");
  cur = i;
  strip.current = i;
  countShown = null;
  describe(i, dir);
  clearTimeout(glowTimer);
  if (prev && c.day !== prev.day && glide) {
    document.body.style.setProperty("--glow", "#0B1330");
    glowTimer = setTimeout(() => document.body.style.setProperty("--glow", c.color || "#15171A"), glide.dur * 1000);
  } else document.body.style.setProperty("--glow", c.color || "#15171A");
  history.replaceState(history.state, "", address());
  extra.label();
  const play = () => { waiting = false; return player.play(c, { cap: cap() }).then(ok => { if (ok && cur === i && started) step(1); }); };
  clearTimeout(startTimer); pendingStart = null;
  const lead = glide && !stillness && !ride ? Math.min(glide.dur * 0.55, 1.1) : 0;
  if (ride && glide) {
    showRide(ride, glide.dur);
    waiting = true;
    player.preload(c);
    rideTimer = setTimeout(() => { hideRide(); if (cur === i && started) play(); }, glide.dur * 1000);
  } else if (lead > 0.05) {
    waiting = true;
    player.preload(c);
    startTimer = setTimeout(() => { if (cur !== i || !started) return; if (paused) pendingStart = play; else play(); }, lead * 1000);
  } else play();
  if (!ride) player.preload(clips[mode === "short" ? reel.short[pos + 1] : i + 1]);
}
const address = () => mode === "short" ? `#${trip.id}/short` : `#${trip.id}/${cur}`;
function step(dir) {
  if (!started || document.body.classList.contains("entering")) return;
  if (mode === "short") {
    const p = pos + dir;
    if (p < 0) return;
    if (p >= reel.short.length) return finale();
    pos = p;
    return go(reel.short[p]);
  }
  if (cur + dir >= clips.length) return finale();
  go(cur + dir);
}
function begin(way, from = null) {
  unlock();
  player.route(audioContext());
  entryTimers.forEach(clearTimeout);
  hideRide();
  if (!history.state?.reel) history.pushState({ reel: 1 }, "", location.href);
  started = true;
  paused = false;
  player.setPaused(false);
  $("#end").hidden = true;
  mode = way === "short" ? "short" : "walk";
  cur = -1; glide = null; pos = 0;
  strip.only = mode === "short" ? new Set(reel.short) : null;
  const first = mode === "short" ? reel.short[0] : from != null ? from : way === "random" ? Math.floor(Math.random() * (clips.length - 1)) : 0;
  const c = clips[first];
  Object.assign(shown, { r: c.r, f: Math.round(c.f * 10) / 10, clock: minutes(c.t), day: c.day });
  const cover = $("#start");
  if (!cover.hidden) { cover.classList.add("leaving"); entryTimers.push(setTimeout(() => { cover.hidden = true; cover.classList.remove("leaving"); heroStop(); }, 700)); }
  document.body.classList.add("playing", "entering");
  document.body.classList.remove("paused");
  pauseLabel();
  strip.head = c.r;
  strip.begin();
  player.preload(c);
  entryTimers.push(setTimeout(() => document.body.classList.remove("entering"), 1350));
  entryTimers.push(setTimeout(() => go(first), 1900));
  if (strip.coarse && !store.get("caminatas.sides")) entryTimers.push(setTimeout(() => { store.set("caminatas.sides", "1"); toast(t.sidesHint, 4200); }, 3400));
}
function home() {
  const steps = (history.state?.reel ? 1 : 0) + (history.state?.map ? 1 : 0);
  if (steps) history.go(-steps); else cover_();
}
addEventListener("popstate", () => {
  const s = history.state || {};
  if (!s.map && strip.state === "explore") strip.explore(false);
  if (!s.reel && started) return cover_();
  if (started && cur >= 0) history.replaceState(history.state, "", address());
});
function cover_() {
  started = false;
  clearTimeout(startTimer);
  entryTimers.forEach(clearTimeout);
  hideRide();
  player.stop();
  clearTimeout(cutTimer);
  $(".g-cut").classList.remove("on");
  $("#end").hidden = true;
  document.body.classList.remove("playing", "paused", "exploring");
  document.body.style.setProperty("--glow", "#15171A");
  $("#close-map").hidden = true;
  $("#start").hidden = false;
  $("#start").classList.remove("leaving");
  $("#start").classList.add("arriving");
  setTimeout(() => $("#start").classList.remove("arriving"), 1000);
  history.replaceState(null, "", location.pathname + location.search);
  strip.home();
  reveal();
  heroStep();
}
function jumpAhead() {
  if (!started) return;
  if (mode === "short") { const n = reel.short.length - 1 - pos; if (n > 0) { pos += 1 + Math.floor(Math.random() * n); go(reel.short[pos], { jump: true }); } return; }
  const from = cur + 1, n = clips.length - 1 - from;
  go(n > 0 ? from + Math.floor(Math.random() * n) : Math.floor(Math.random() * clips.length), { jump: true });
}
function finale() {
  strip.finale();
  ending();
}
function ending() {
  const e = $("#end");
  const text = mode === "short" ? t.endShort
    : t.endText(days.length, Math.round(reel.km), esc(reel.from), clips.length, t.film(reel.seconds), Math.round(reel.hours));
  e.innerHTML = `<div class="e-in"><h2>${esc(t.endTitle(reel.to))}</h2><p>${text}</p>
    <div class="e-ways"><button type="button" data-end="walk">${mode === "short" ? t.walkAll : t.again}</button><button type="button" data-end="share">${t.share}</button></div>
    <p class="e-made">${t.made}</p></div>`;
  e.hidden = false;
  e.querySelectorAll("[data-end]").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (b.dataset.end === "share") return share();
    begin("walk");
  });
}
async function share() {
  const base = location.href.split("#")[0].split("?")[0];
  const url = mode === "short" || cur < 0 ? `${base}#${trip.id}/short` : `${base}#${trip.id}/${cur}`;
  const title = t.title();
  if (navigator.share && strip.coarse) { try { await navigator.share({ title, url }); } catch {} return; }
  try { await navigator.clipboard.writeText(url); toast(t.copied); } catch { toast(url); }
}
function toast(msg, ms = 2200) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms);
}
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
function setPaused(p) {
  paused = p;
  player.setPaused(p);
  if (!p && pendingStart) { const go_ = pendingStart; pendingStart = null; go_(); }
  suspend(p);
  document.body.classList.toggle("paused", p);
  pauseLabel();
}
function pauseLabel() { const b = $("#pause"); b.setAttribute("aria-label", paused ? t.play : t.pause); b.title = paused ? t.play : t.pause; b.classList.toggle("is-paused", paused); }
function soundLabel() { const b = $("#sound"), m = player.muted; b.setAttribute("aria-label", m ? t.soundOff : t.soundOn); b.title = m ? t.soundOff : t.soundOn; b.classList.toggle("is-off", m); }
function toggleSound() { const m = !player.muted; player.setMuted(m); muteTicks(m); soundLabel(); }
const nextDay = dir => {
  if (mode === "short") return step(dir);
  const d = clips[cur].day + dir;
  if (dir < 0 && cur > days[clips[cur].day].clip + 2) return go(days[clips[cur].day].clip, { jump: true });
  if (days[d]) go(days[d].clip, { jump: true });
};
$("#next").onclick = e => { e.stopPropagation(); step(1); };
$("#prev").onclick = e => { e.stopPropagation(); step(-1); };
$("#pause").onclick = e => { e.stopPropagation(); setPaused(!paused); };
$("#sound").onclick = e => { e.stopPropagation(); toggleSound(); };
$("#share").onclick = e => { e.stopPropagation(); share(); };
$("#jump").onclick = e => { e.stopPropagation(); jumpAhead(); };
$("#home").onclick = () => home();
$("#close-map").onclick = () => strip.explore(false);
document.querySelectorAll("#lang button").forEach(b => b.onclick = () => setLang(b.dataset.lang));
onLang(() => words());
$("#frame").addEventListener("click", e => { if (!e.target.closest("#end, button") && started) setPaused(!paused); });
document.addEventListener("keydown", e => {
  if (!started || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === " ") { e.preventDefault(); setPaused(!paused); }
  else if (k === "ArrowRight") step(1);
  else if (k === "ArrowLeft") step(-1);
  else if (k === "ArrowUp") { e.preventDefault(); nextDay(1); }
  else if (k === "ArrowDown") { e.preventDefault(); nextDay(-1); }
  else if (k.toLowerCase() === "m") toggleSound();
  else if (extra.key(k)) {   }
  else if (k.toLowerCase() === "r") jumpAhead();
  else if (k === "Escape") strip.state === "explore" ? strip.explore(false) : home();
});
let touchY = null;
$("#frame").addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
$("#frame").addEventListener("touchend", e => {
  if (touchY == null) return;
  const dy = e.changedTouches[0].clientY - touchY;
  touchY = null;
  if (Math.abs(dy) > 60) { e.preventDefault(); step(dy < 0 ? 1 : -1); }
});
if (history.state) history.replaceState(null, "", location.href);
words();
await strip.ready();
performance.mark("caminatas:map");
requestAnimationFrame(frame);
function reveal() {
  const t0 = performance.now(), total = reel.routeKm;
  const draw = now => {
    if (strip.state !== "intro") return;
    strip.reveal = total * ease(clamp((now - t0) / 7500, 0, 1));
    strip.revealAt = strip.reveal < total ? now : 0;
    if (strip.reveal < total) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
reveal();
heroStep();
window.reel = { clips, go, begin, home, strip, state: () => ({ current: cur, paused, started, mode, gliding: !!glide, exploring: strip.state === "explore", shown: { ...shown } }) };
