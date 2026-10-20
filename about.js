const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const TITLE = { es: "Valonia: un diario en video, a pie de Lille a Maastricht", en: "Wallonia: a video diary, on foot from Lille to Maastricht" };
function set(lang, remember = true) {
  const html = document.documentElement;
  html.dataset.lang = lang;
  html.lang = lang;
  document.title = TITLE[lang];
  for (const b of document.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  if (remember) store.set("caminatas.lang", lang);
  history.replaceState(null, "", location.pathname + location.search.replace(/[?&]lang=\w+/, "") + `#${lang}`);
}
const asked = new URLSearchParams(location.search).get("lang") || location.hash.slice(1);
set(["es", "en"].includes(asked) ? asked : store.get("caminatas.lang") === "en" ? "en" : "es", ["es", "en"].includes(asked));
for (const b of document.querySelectorAll(".lang button")) b.onclick = () => set(b.dataset.lang);
addEventListener("hashchange", () => { const h = location.hash.slice(1); if (["es", "en"].includes(h) && h !== document.documentElement.dataset.lang) set(h); });
