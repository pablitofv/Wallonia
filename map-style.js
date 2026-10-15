export const C = {
  space: "#E7E4DC",
  worldLand: "#ECE9E1",
  outside: "#E4E1D8",
  earth: "#F4F2EC",
  urban: "#EBE7DE",
  farmland: "#F2F0E7",
  wood: "#DCE2D2",
  woodHi: "#D3DBC8",
  grass: "#E4E9DA",
  cemetery: "#DFE2D6",
  industrial: "#E8E3DA",
  water: "#B7C9D3",
  worldWater: "#C3D2DA",
  waterLine: "#A6BBC7",
  waterLabel: "#4F6D7E",
  building: "#DAD4C9",
  buildingTop: "#E6E1D7",
  buildingLine: "#C8C1B4",
  road: "#FFFFFF",
  roadCase: "#DAD4C8",
  majorCase: "#CCC4B5",
  highway: "#FBF6EC",
  highwayCase: "#BFB5A3",
  path: "#978C7B",
  rail: "#7F7B74",
  border: "#7D7368",
  borderBand: "#D9CCBB",
  region: "#8C8174",
  label: "#35322D",
  labelSoft: "#6E685E",
  regionLabel: "#857A6D",
  halo: "rgba(246,244,238,0.92)",
};
const REG = ["Noto Sans Regular"], MED = ["Noto Sans Medium"], ITA = ["Noto Sans Italic"];
const name = ["coalesce", ["get", "name"], ""];
const nameEn = ["coalesce", ["get", "name:en"], ["get", "name"], ""];
const z = (...stops) => ["interpolate", ["exponential", 1.6], ["zoom"], ...stops];
const lin = (...stops) => ["interpolate", ["linear"], ["zoom"], ...stops];
const shown = ["<=", ["coalesce", ["get", "min_zoom"], 0], ["+", ["zoom"], 0.01]];
const isRegion = ["any", ["==", ["get", "kind"], "region"], ["==", ["to-string", ["get", "kind_detail"]], "4"]];
export const NIGHT = {
  space: "#0A0B0D", worldLand: "#141619", outside: "#0F1113", earth: "#15171A",
  urban: "#191B1E", farmland: "#141619", wood: "#121815", woodHi: "#111713", grass: "#131915",
  cemetery: "#151916", industrial: "#18191C", water: "#0B1720", worldWater: "#0B1117",
  waterLine: "#15303F", waterLabel: "#58788A", building: "#1F2226", buildingTop: "#2A2E34",
  buildingLine: "#17191C", road: "#2B2E33", roadCase: "#1A1C1F", majorCase: "#1A1C1F",
  highway: "#33363B", highwayCase: "#1A1C1F", path: "#4B5058", rail: "#3B3F46",
  border: "#3A3E45", borderBand: "#1C1E22", region: "#30343A",
  label: "#8A8F96", labelSoft: "#5B6068", regionLabel: "#4B5057", halo: "rgba(10,11,13,0.9)",
  horizon: "#16181B", fog: "#0A0B0D",
};
export const STRIP = {
  ...NIGHT,
  space: "#0B0C0E", worldLand: "#0E1012", outside: "#0C0E10", earth: "#101215",
  urban: "#15171B", farmland: "#101215", wood: "#0E1411", woodHi: "#0D1310", grass: "#0F1411",
  cemetery: "#101412", industrial: "#131519", worldWater: "#0B141B",
  water: "#10304A", waterLine: "#2A6C91", building: "#191B1F", buildingTop: "#202328", buildingLine: "#131518",
  road: "#1D2025", roadCase: "#121417", majorCase: "#121417", highway: "#1E2126", highwayCase: "#101215",
  path: "#30343B", rail: "#2E3239", border: "#7A6E62", borderBand: "#2A2420", region: "#3C3833",
};
export function baseStyle({ tiles, world, glyphs, palette = C, labels = true }) {
  const C = palette;
  const L = [];
  const W = l => world && L.push({ source: "world", ...l });
  const B = l => tiles && L.push({ source: "base", ...l });
  L.push({ id: "bg", type: "background", paint: { "background-color": lin(4, C.worldWater, 7, C.outside) } });
  W({ id: "w-earth", type: "fill", "source-layer": "earth",
    paint: { "fill-color": lin(4, C.worldLand, 7, C.outside) } });
  W({ id: "w-landcover", type: "fill", "source-layer": "landcover", maxzoom: 7,
    paint: { "fill-color": ["match", ["get", "kind"], "forest", C.wood, ["grassland", "scrub"], C.grass, "urban_area", C.urban, C.worldLand],
      "fill-opacity": 0.55 } });
  W({ id: "w-water", type: "fill", "source-layer": "water", filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": C.worldWater } });
  W({ id: "w-borders", type: "line", "source-layer": "boundaries", filter: ["==", ["get", "kind"], "country"],
    paint: { "line-color": C.border, "line-width": z(1, 0.3, 5, 0.9), "line-opacity": 0.6 } });
  B({ id: "earth", type: "fill", "source-layer": "earth", minzoom: 5, paint: { "fill-color": C.earth } });
  B({ id: "landcover", type: "fill", "source-layer": "landcover", minzoom: 5, maxzoom: 11,
    paint: { "fill-color": ["match", ["get", "kind"],
      "forest", C.wood, "grassland", C.grass, "scrub", C.grass, "urban_area", C.urban, "farmland", C.farmland, C.earth],
      "fill-opacity": lin(9, 1, 11, 0) } });
  B({ id: "landuse", type: "fill", "source-layer": "landuse",
    paint: { "fill-color": ["match", ["get", "kind"],
      ["forest", "wood", "nature_reserve"], C.wood,
      ["park", "grass", "meadow", "garden", "village_green", "recreation_ground", "golf_course", "allotments", "orchard", "vineyard", "playground"], C.grass,
      ["cemetery", "grave_yard"], C.cemetery,
      ["residential", "commercial", "retail", "pedestrian", "school", "university", "college", "hospital", "kindergarten", "place_of_worship"], C.urban,
      ["industrial", "railway", "military", "brownfield", "landfill", "quarry", "construction", "platform"], C.industrial,
      ["farmland", "farmyard"], C.farmland,
      "rgba(0,0,0,0)"] } });
  B({ id: "wood-texture", type: "fill", "source-layer": "landuse", minzoom: 13,
    filter: ["in", ["get", "kind"], ["literal", ["forest", "wood"]]],
    paint: { "fill-color": C.woodHi, "fill-opacity": 0.6 } });
  B({ id: "water", type: "fill", "source-layer": "water", minzoom: 5,
    filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": C.water } });
  B({ id: "waterways", type: "line", "source-layer": "water",
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": C.waterLine,
      "line-width": z(
        9, ["match", ["get", "kind"], ["river", "canal"], 0.8, 0],
        11, ["match", ["get", "kind"], ["river", "canal"], 1.4, 0.3],
        13, ["match", ["get", "kind"], ["river", "canal"], 2.2, 0.7],
        16, ["match", ["get", "kind"], ["river", "canal"], 6, 2]) } });
  B({ id: "border-band", type: "line", "source-layer": "boundaries", minzoom: 5,
    filter: ["==", ["get", "kind"], "country"],
    layout: { "line-join": "round" },
    paint: { "line-color": C.borderBand, "line-width": z(5, 3, 10, 7, 14, 14), "line-opacity": 0.55, "line-blur": 1 } });
  B({ id: "regions", type: "line", "source-layer": "boundaries", minzoom: 6,
    filter: ["all", isRegion, ["!=", ["get", "kind"], "country"]],
    paint: { "line-color": C.region, "line-width": z(6, 1.1, 12, 2), "line-dasharray": [3, 2], "line-opacity": 0.95 } });
  B({ id: "borders", type: "line", "source-layer": "boundaries", minzoom: 5,
    filter: ["==", ["get", "kind"], "country"],
    paint: { "line-color": C.border, "line-width": z(5, 0.9, 12, 1.8), "line-dasharray": [5, 2, 1, 2] } });
  const roadW = k => ({
    highway: z(6, 0.4, 10, 1.4, 14, 5, 17, 18),
    major_road: z(8, 0.3, 11, 1, 14, 4, 17, 14),
    minor_road: z(11, 0.2, 13, 0.8, 15, 3.2, 17, 10),
  })[k];
  const roads = ["highway", "major_road", "minor_road"];
  const notTunnel = ["!", ["coalesce", ["get", "is_tunnel"], false]];
  for (const k of [...roads].reverse()) {
    B({ id: `road-${k}-case`, type: "line", "source-layer": "roads", minzoom: k === "minor_road" ? 12 : 7,
      filter: ["all", ["==", ["get", "kind"], k], notTunnel],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": k === "highway" ? C.highwayCase : k === "major_road" ? C.majorCase : C.roadCase,
        "line-gap-width": roadW(k), "line-width": z(10, 0.4, 16, 1.2) } });
  }
  for (const k of [...roads].reverse()) {
    B({ id: `road-${k}`, type: "line", "source-layer": "roads", minzoom: k === "minor_road" ? 11 : 6,
      filter: ["all", ["==", ["get", "kind"], k], notTunnel],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": k === "highway" ? C.highway : C.road, "line-width": roadW(k) } });
  }
  B({ id: "paths", type: "line", "source-layer": "roads", minzoom: 13,
    filter: ["==", ["get", "kind"], "path"],
    paint: { "line-color": C.path, "line-width": z(13, 0.6, 16, 1.4), "line-dasharray": [2.5, 1.6],
      "line-opacity": lin(13, 0.5, 15, 0.9) } });
  B({ id: "rail", type: "line", "source-layer": "roads", minzoom: 8,
    filter: ["==", ["get", "kind"], "rail"],
    paint: { "line-color": C.rail, "line-width": z(8, 0.4, 13, 1, 16, 1.6), "line-opacity": lin(8, 0.5, 12, 0.9) } });
  B({ id: "rail-ties", type: "line", "source-layer": "roads", minzoom: 14,
    filter: ["==", ["get", "kind"], "rail"],
    paint: { "line-color": C.rail, "line-width": z(14, 3, 17, 7), "line-dasharray": [0.15, 3], "line-opacity": 0.8 } });
  B({ id: "buildings", type: "fill", "source-layer": "buildings", minzoom: 13, maxzoom: 15.5,
    paint: { "fill-color": C.building, "fill-opacity": lin(13, 0, 14, 1), "fill-outline-color": C.buildingLine } });
  B({ id: "buildings-3d", type: "fill-extrusion", "source-layer": "buildings", minzoom: 15,
    paint: { "fill-extrusion-color": C.buildingTop,
      "fill-extrusion-height": lin(15, 0, 16, ["coalesce", ["get", "height"], 7]),
      "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } });
  B({ id: "water-names", type: "symbol", "source-layer": "water", minzoom: 12,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "symbol-placement": "line", "text-field": name, "text-font": ITA, "text-size": 11.5,
      "text-letter-spacing": 0.08, "symbol-spacing": 400 },
    paint: { "text-color": C.waterLabel, "text-halo-color": C.halo, "text-halo-width": 1.4 } });
  B({ id: "street-names", type: "symbol", "source-layer": "roads", minzoom: 14,
    filter: ["in", ["get", "kind"], ["literal", ["major_road", "minor_road", "path"]]],
    layout: { "symbol-placement": "line", "text-field": name, "text-font": REG, "text-size": z(14, 10, 17, 12.5),
      "symbol-spacing": 300 },
    paint: { "text-color": C.labelSoft, "text-halo-color": C.halo, "text-halo-width": 1.4 } });
  B({ id: "stations", type: "symbol", "source-layer": "pois", minzoom: 13,
    filter: ["all", ["in", ["get", "kind"], ["literal", ["station", "train_station", "halt"]]], shown],
    layout: { "text-field": name, "text-font": MED, "text-size": 11, "text-letter-spacing": 0.04 },
    paint: { "text-color": C.rail, "text-halo-color": C.halo, "text-halo-width": 1.6 } });
  B({ id: "neighbourhoods", type: "symbol", "source-layer": "places", minzoom: 13,
    filter: ["all", ["==", ["get", "kind"], "neighbourhood"], shown],
    layout: { "text-field": name, "text-font": REG, "text-size": 11, "text-transform": "uppercase",
      "text-letter-spacing": 0.12, "text-max-width": 8 },
    paint: { "text-color": C.labelSoft, "text-halo-color": C.halo, "text-halo-width": 1.4 } });
  B({ id: "regions-names", type: "symbol", "source-layer": "places", minzoom: 6, maxzoom: 10,
    filter: ["==", ["get", "kind"], "region"],
    layout: { "text-field": name, "text-font": ITA, "text-size": lin(6, 11, 9, 14), "text-transform": "uppercase",
      "text-letter-spacing": 0.3, "text-max-width": 10 },
    paint: { "text-color": C.regionLabel, "text-halo-color": C.halo, "text-halo-width": 1.2 } });
  B({ id: "towns", type: "symbol", "source-layer": "places", minzoom: 6,
    filter: ["all", ["==", ["get", "kind"], "locality"], shown],
    layout: { "text-field": name, "text-font": MED,
      "text-size": lin(
        6, ["match", ["get", "population_rank"], [12, 13, 14, 15, 16, 17, 18], 12, 10],
        12, ["match", ["get", "population_rank"], [11, 12, 13, 14, 15, 16, 17, 18], 16, 12.5]),
      "text-transform": "uppercase", "text-letter-spacing": 0.14, "text-max-width": 9,
      "symbol-sort-key": ["-", 20, ["coalesce", ["get", "population_rank"], 0]] },
    paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.8 } });
  W({ id: "w-countries", type: "symbol", "source-layer": "places", maxzoom: 6,
    filter: ["==", ["get", "kind"], "country"],
    layout: { "text-field": nameEn, "text-font": REG, "text-size": lin(1, 10, 5, 13), "text-transform": "uppercase",
      "text-letter-spacing": 0.3, "text-max-width": 8 },
    paint: { "text-color": C.labelSoft, "text-halo-color": C.halo, "text-halo-width": 1.3 } });
  W({ id: "w-cities", type: "symbol", "source-layer": "places", minzoom: 2.5, maxzoom: 6,
    filter: ["all", ["==", ["get", "kind"], "locality"], [">=", ["coalesce", ["get", "population_rank"], 0], 13], shown],
    layout: { "text-field": nameEn, "text-font": MED, "text-size": 11, "text-transform": "uppercase", "text-letter-spacing": 0.12 },
    paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.5 } });
  const attribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>';
  const sources = {};
  if (tiles) sources.base = { type: "vector", url: tiles, attribution };
  if (world) sources.world = { type: "vector", url: world, attribution };
  return {
    version: 8,
    glyphs,
    projection: { type: "globe" },
    sky: {
      "sky-color": C.space, "horizon-color": C.horizon || "#EFEBE3", "fog-color": C.fog || "#EFEBE3",
      "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.7, "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 5, 0.4, 7, 0],
    },
    sources,
    layers: L,
  };
}
export function reelStyle(opts) {
  const style = baseStyle({ ...opts, palette: STRIP });
  style.projection = { type: "mercator" };
  style.layers = style.layers.filter(l => l.type !== "symbol" && l.type !== "fill-extrusion");
  const band = style.layers.findIndex(l => l.id === "border-band");
  if (band >= 0) {
    const zo = (...stops) => ["interpolate", ["linear"], ["zoom"], ...stops];
    style.layers.splice(band, 0, { id: "border-glow", type: "line", source: "base", "source-layer": "boundaries", minzoom: 8.5,
      filter: ["==", ["get", "kind"], "country"], layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#E0A867", "line-width": zo(9, 6, 12, 16, 16, 34, 18, 48), "line-blur": zo(9, 4, 12, 10, 16, 22, 18, 30),
        "line-opacity": zo(8.5, 0, 10.5, 0.42, 14, 0.55, 17, 0.62) } });
    const core = style.layers.find(l => l.id === "borders");
    if (core) Object.assign(core.paint, { "line-color": zo(9.5, STRIP.border, 11.5, "#F2CF9C"), "line-width": z(5, 0.9, 12, 1.8, 16, 3.2, 18, 4.5) });
  }
  if (opts.tiles) style.layers.push(
    { id: "buildings-3d", type: "fill-extrusion", source: "base", "source-layer": "buildings", minzoom: 14, layout: { visibility: "none" },
      paint: { "fill-extrusion-color": "#2C3038", "fill-extrusion-height": ["coalesce", ["get", "height"], 7],
        "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0], "fill-extrusion-opacity": 0.94, "fill-extrusion-vertical-gradient": true } },
    { id: "street-names-3d", type: "symbol", source: "base", "source-layer": "roads", minzoom: 14.5, layout: { visibility: "none",
        "symbol-placement": "line", "text-field": ["coalesce", ["get", "name"], ""], "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14.5, 10, 18, 13], "symbol-spacing": 260, "text-max-angle": 30, "text-pitch-alignment": "viewport" },
      filter: ["in", ["get", "kind"], ["literal", ["major_road", "medium_road", "minor_road"]]],
      paint: { "text-color": "#8E897F", "text-halo-color": "rgba(11,12,14,.9)", "text-halo-width": 1.4 } });
  if (opts.terrain) {
    const attribution = '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>';
    style.sources.dem = { type: "raster-dem", url: opts.terrain, encoding: "terrarium", tileSize: 512, attribution };
  }
  style.light = { anchor: "map", position: [1.4, 210, 40], color: "#FFFFFF", intensity: 0.42 };
  style.sky = { "sky-color": "#0B0C0E", "horizon-color": "#15181D", "fog-color": "#0B0C0E", "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.25, "atmosphere-blend": 0 };
  return style;
}
export const REEL_3D_LAYERS = ["buildings-3d", "street-names-3d"];
export function layersDrawn(style) {
  const out = {};
  for (const l of style.layers) {
    if (!l.source || !l["source-layer"]) continue;
    const s = out[l.source] ||= {};
    const lo = Math.floor(l.minzoom ?? 0), hi = l.maxzoom == null ? Infinity : Math.ceil(l.maxzoom) - 1;
    const r = s[l["source-layer"]];
    s[l["source-layer"]] = r ? [Math.min(r[0], lo), Math.max(r[1], hi)] : [lo, hi];
  }
  return out;
}
export function kindsUnseen(style) {
  const unseen = c => typeof c === "string" && /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(c);
  const out = {};
  for (const [src, layer] of new Set(style.layers.filter(l => l.source && l["source-layer"]).map(l => `${l.source}\n${l["source-layer"]}`)).entries()) {
    const [source, sl] = src.split("\n");
    const users = style.layers.filter(l => l.source === source && l["source-layer"] === sl);
    const tests = users.map(l => {
      if (l.type !== "fill") return () => true;
      let only = null;
      if (l.filter) {
        const f = l.filter;
        if (f[0] === "in" && JSON.stringify(f[1]) === '["get","kind"]' && f[2]?.[0] === "literal") only = new Set(f[2][1]);
        else return () => true;
      }
      const c = l.paint?.["fill-color"], o = l.paint?.["fill-opacity"];
      if (o === 0) return k => false;
      if (typeof c === "string") return k => (!only || only.has(k)) && !unseen(c);
      if (Array.isArray(c) && c[0] === "match" && JSON.stringify(c[1]) === '["get","kind"]') {
        const map = new Map();
        for (let i = 2; i < c.length - 1; i += 2) for (const k of [].concat(c[i])) if (!map.has(k)) map.set(k, c[i + 1]);
        const fallback = c[c.length - 1];
        return k => (!only || only.has(k)) && !unseen(map.has(k) ? map.get(k) : fallback);
      }
      return () => true;
    });
    out[source] ||= {};
    out[source][sl] = kind => tests.every(t => !t(kind));
  }
  return out;
}
