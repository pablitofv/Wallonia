export const digits = n => Array.from({ length: n }, (_, i) => String(i));
export const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export class Odometer {
  constructor(el, spec, { lead = false } = {}) {
    this.el = el;
    this.lead = lead;
    this.wheels = [];
    el.classList.add("odo");
    el.innerHTML = "";
    for (const part of spec) {
      if (typeof part === "string") {
        const s = document.createElement("span");
        s.className = "odo-sep";
        s.textContent = part;
        el.append(s);
        continue;
      }
      const w = document.createElement("span");
      w.className = "odo-w";
      const col = document.createElement("span");
      col.className = "odo-c";
      for (const l of [...part.labels, part.labels[0]]) {
        const c = document.createElement("span");
        c.textContent = l;
        col.append(c);
      }
      w.append(col);
      el.append(w);
      this.wheels.push({ el: w, col, radix: part.labels.length, pos: -1, blur: 0 });
    }
    this.value = null;
  }
  set(v) {
    if (v === this.value) return;
    const prev = this.value;
    this.value = v;
    const n = this.wheels.length;
    let unit = 1, below = null;
    const whole = Math.floor(v);
    for (let k = n - 1; k >= 0; k--) {
      const w = this.wheels[k];
      let pos;
      if (k === n - 1) pos = ((v % w.radix) + w.radix) % w.radix;
      else {
        pos = Math.floor(whole / unit) % w.radix;
        const edge = below.radix - 1;
        if (below.pos > edge) pos += below.pos - edge;
      }
      if (pos !== w.pos) {
        const speed = w.pos < 0 || prev == null ? 0 : Math.min(Math.abs(pos - w.pos), w.radix - Math.abs(pos - w.pos));
        w.pos = pos;
        w.col.style.transform = `translateY(${(-pos / (w.radix + 1)) * 100}%)`;
        const blur = Math.min(3, speed * 2.2);
        if (Math.abs(blur - w.blur) > 0.15) { w.blur = blur; w.col.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : ""; }
      } else if (w.blur) { w.blur = 0; w.col.style.filter = ""; }
      below = w;
      unit *= w.radix;
    }
    if (this.lead) {
      let seen = false, u = 1;
      const units = [];
      for (let k = n - 1; k >= 0; k--) { units[k] = u; u *= this.wheels[k].radix; }
      for (let k = 0; k < n; k++) {
        if (Math.floor(whole / units[k]) % this.wheels[k].radix > 0) seen = true;
        const lead = !seen && k < n - 2;
        if (lead !== this.wheels[k].isLead) { this.wheels[k].isLead = lead; this.wheels[k].el.classList.toggle("odo-lead", lead); }
      }
    }
  }
  settle() { for (const w of this.wheels) if (w.blur) { w.blur = 0; w.col.style.filter = ""; } }
}
