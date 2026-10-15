const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const asked = new URLSearchParams(location.search).get("lang");
export let lang = ["es", "en"].includes(asked) ? asked : store.get("caminatas.lang") === "en" ? "en" : "es";
const listeners = [];
export const onLang = fn => listeners.push(fn);
export function setLang(l) {
  if (l === lang) return;
  lang = l;
  store.set("caminatas.lang", l);
  document.documentElement.lang = l;
  listeners.forEach(fn => fn(l));
}
document.documentElement.lang = lang;
const MAIL = "mailto:" + ["pablo.fernandez.vallejo", "gmail.com"].join("@");
const S = {
  es: {
    title: () => "Valonia",
    sub: km => `${km} km a pie`,
    lede: () => "Trece días caminando hacia el este desde una habitación en Lille a una capilla en Maastricht.",
    unesco: "Patrimonio Mundial de la UNESCO",
    onBoard: { train: "Tren", tram: "Tranvía", metro: "Metro", bus: "Bus", flight: "Avión" },
    short: "Versión corta", walk: "Empezar a caminar",
    orShort: "ver la versión corta",
    enterAt: (day, time, place) => `Entrar en el día ${day}, a las ${time}${place ? ", en " + place : ""}`,
    shared: when => `Ver el momento compartido (${when})`, jump: "Saltar a cualquier momento más adelante",
    zoomIn: "Acercar", zoomOut: "Alejar", whole: "Ver todo el camino", follow: "Volver a seguir la caminata",
    view3d: "Ver en 3D, entre los edificios", view2d: "Volver al mapa plano",
    made: `Hecho con amor por <a href="${MAIL}">Pablo Fernández Vallejo</a> y Claude Opus 5.5 · <a href="about.html#es">Sobre el proyecto</a>`,
    docTitle: "Valonia: 13 días a pie de Lille a Maastricht, película a película · un proyecto de creative vibecoding",
    home: "Inicio", prev: "Película anterior", next: "Película siguiente",
    pause: "Pausa", play: "Seguir", soundOn: "Con sonido", soundOff: "Sin sonido", paused: "En pausa",
    share: "Compartir", copied: "Enlace copiado",
    day: "Día", of: n => `de ${n}`, days: (a, b) => `Días ${a} y ${b}`,
    kmUnit: "km a pie", fromDoor: town => `desde ${town}`,
    in: "en", near: "cerca de",
    notFilmed: "Sin filmar", night: "Noche", later: t => `${t} después`, border: "Frontera", to: "a",
    by: { train: "En tren", tram: "En tranvía", metro: "En metro", bus: "En bus", flight: "En avión" },
    ratio: (f, r) => `<b>${f}</b> filmados de <b>${r}</b> en el camino`,
    tipKm: km => `${km} km a pie`,
    endTitle: town => `${town}.`,
    endText: (days, km, from, n, film, hours) => `${days} días y ${km} kilómetros a pie desde ${from}. ${n} películas: ${film} de unas ${hours} horas en el camino.`,
    endShort: "Esa fue la versión corta.", walkAll: "Caminarlo entero", again: "Otra vez",
    backToFilm: "Volver a la película",
    mapHint: "Tocá el camino para elegir una película", watch: "Ver", sidesHint: "Tocá los costados (o deslizá) para cambiar de película",
    night1: "noche", nights: "noches",
    compassNorth: "Norte arriba. Tocá para el este arriba, hacia donde fue la caminata",
    compassEast: "Este arriba, hacia donde fue la caminata. Tocá para el norte arriba",
    countries: { France: "Francia", Belgium: "Bélgica", Netherlands: "Países Bajos", Germany: "Alemania", Luxembourg: "Luxemburgo", "United Kingdom": "Reino Unido" },
    film: s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} minutos`,
    weekdays: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    date: (w, d, m, y) => `${w} ${d} de ${m} de ${y}`,
    decimal: ",",
  },
  en: {
    title: () => "Wallonia",
    sub: km => `${km} km on foot`,
    lede: () => "Thirteen days walking east, from a room in Lille to a chapel in Maastricht.",
    unesco: "UNESCO World Heritage",
    onBoard: { train: "Train", tram: "Tram", metro: "Metro", bus: "Bus", flight: "Plane" },
    short: "Short version", walk: "Start walking",
    orShort: "watch the short version",
    enterAt: (day, time, place) => `Enter on day ${day}, at ${time}${place ? ", in " + place : ""}`,
    shared: when => `See the shared moment (${when})`, jump: "Jump to any moment further on",
    zoomIn: "Zoom in", zoomOut: "Zoom out", whole: "See the whole way", follow: "Follow the walk again",
    view3d: "See it in 3D, among the buildings", view2d: "Back to the flat map",
    made: `Made with love by <a href="${MAIL}">Pablo Fernández Vallejo</a> and Claude Opus 5.5 · <a href="about.html">About this project</a>`,
    docTitle: "Wallonia: a 13-day walk from Lille to Maastricht, film by film · a creative vibecoding project",
    home: "Home", prev: "Previous film", next: "Next film",
    pause: "Pause", play: "Go on", soundOn: "Sound on", soundOff: "Sound off", paused: "Paused",
    share: "Share", copied: "Link copied",
    day: "Day", of: n => `of ${n}`, days: (a, b) => `Days ${a} & ${b}`,
    kmUnit: "km on foot", fromDoor: town => `from ${town}`,
    in: "in", near: "near",
    notFilmed: "Not filmed", night: "Night", later: t => `${t} later`, border: "Border", to: "to",
    by: { train: "By train", tram: "By tram", metro: "By metro", bus: "By bus", flight: "By air" },
    ratio: (f, r) => `<b>${f}</b> filmed of <b>${r}</b> on the road`,
    tipKm: km => `${km} km on foot`,
    endTitle: town => `${town}.`,
    endText: (days, km, from, n, film, hours) => `${days} days and ${km} kilometres on foot from ${from}. ${n} films: ${film} out of some ${hours} hours on the road.`,
    endShort: "That was the short version.", walkAll: "Walk all of it", again: "Again",
    backToFilm: "Back to the film",
    mapHint: "Tap the way to pick a film", watch: "Watch", sidesHint: "Tap the sides (or swipe) to change film",
    night1: "night", nights: "nights",
    compassNorth: "North up. Click for east up, the way the walk went",
    compassEast: "East up, the way the walk went. Click for north up",
    countries: {},
    film: s => s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} minutes`,
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    date: (w, d, m, y) => `${w} ${d} ${m} ${y}`,
    decimal: ".",
  },
};
export const t = new Proxy({}, { get: (_, k) => S[lang][k] });
export const STRINGS = S;
export const country = name => S[lang].countries[name] || name;
export function longDate(iso) {
  const d = new Date(iso + "T12:00:00Z"), s = S[lang];
  return s.date(s.weekdays[d.getUTCDay()], d.getUTCDate(), s.months[d.getUTCMonth()], d.getUTCFullYear());
}
