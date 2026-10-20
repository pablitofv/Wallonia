export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const phone = () => matchMedia("(max-width: 760px)").matches;
export const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const dateOf = iso => new Date(iso + "T12:00:00Z");
export const longDate = iso => { const d = dateOf(iso); return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
export const shortDate = iso => { const d = dateOf(iso); return `${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)}`; };
export function clockFor(tz) {
  const m = /^([+-])(\d\d):(\d\d)$/.exec(tz || "+00:00");
  const off = (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) * 60000;
  return { clock: ms => new Date(ms + off).toISOString().slice(11, 16), day: ms => new Date(ms + off).toISOString().slice(0, 10) };
}
export const duration = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)} s`;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const angleLerp = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
const RAD = Math.PI / 180;
export function metres(a, b) {
  const dLat = (b[1] - a[1]) * RAD, dLon = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742018 * Math.asin(Math.sqrt(h));
}
export function heading(a, b) {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return Math.atan2(y, x) / RAD;
}
export function cumulative(coords) {
  const c = [0];
  for (let i = 1; i < coords.length; i++) c.push(c[i - 1] + metres(coords[i - 1], coords[i]));
  return c;
}
export function cut(coords, cum, f) {
  if (coords.length < 2) return { part: coords.slice(), head: coords[0], dir: 0 };
  const target = cum[cum.length - 1] * f;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1, u = clamp((target - cum[i - 1]) / seg, 0, 1);
  const head = [lerp(coords[i - 1][0], coords[i][0], u), lerp(coords[i - 1][1], coords[i][1], u)];
  return { part: [...coords.slice(0, i), head], head, dir: heading(coords[i - 1], coords[i]) };
}
export function nearestIndex(coords, p) {
  let best = 0, d = Infinity;
  for (let i = 0; i < coords.length; i++) { const x = metres(coords[i], p); if (x < d) { d = x; best = i; } }
  return [best, d];
}
export const empty = () => ({ type: "FeatureCollection", features: [] });
export const point = (at, properties = {}) => ({ type: "FeatureCollection", features: [{ type: "Feature", properties, geometry: { type: "Point", coordinates: at } }] });
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2400);
}
