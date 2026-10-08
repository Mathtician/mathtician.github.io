// Rhombus tilings of the regular 12-gon, with hexagon flips.
//
// A tiling of the zonogon spanned by the six unit vectors at 0°, 30°, ..., 150°
// has one rhombus for each pair {a, b} of directions (15 tiles).  Vertices live
// in Z^6 (vertex = sum of some unit vectors), so all combinatorics is exact
// integer arithmetic; floats appear only when projecting to the screen.
//
// A flip happens at an interior vertex where exactly three tiles meet: those
// tiles form a hexagon, and the flip rotates each of them 180° about the
// hexagon's center.  Every tiling is reachable from every other by flips.

(() => {
  const N = 6;
  const SVGNS = "http://www.w3.org/2000/svg";
  // Tile colors depend only on the angle between the tile's two directions,
  // which flips preserve.  (This is exactly the coloring of my avatar.)
  const COLORS = { 1: "#fff080", 2: "#80e0ff", 3: "#80c080", 4: "#b0a080", 5: "#a0a0a0" };

  const unit = (k) => { const v = Array(N).fill(0); v[k] = 1; return v; };
  const add = (p, q) => p.map((x, i) => x + q[i]);
  const key = (p) => p.join(",");

  // tile = { a, b, p } with a < b, p = corner where the a- and b-edges start.
  const corners = (t) => {
    const pa = add(t.p, unit(t.a)), pb = add(t.p, unit(t.b));
    return [t.p, pa, add(pa, unit(t.b)), pb];
  };

  // The "bubble sort" tiling: sweep a boundary path [0..5] to [5..0] by
  // swapping adjacent ascending pairs; each swap lays down one rhombus.
  function initialTiling() {
    const tiles = [], path = [...Array(N).keys()];
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i + 1 < N; i++) {
        const [a, b] = [path[i], path[i + 1]];
        if (a < b) {
          const p = path.slice(0, i).reduce((acc, k) => add(acc, unit(k)), Array(N).fill(0));
          tiles.push({ a, b, p });
          [path[i], path[i + 1]] = [b, a];
          changed = true;
        }
      }
    }
    console.assert(tiles.length === (N * (N - 1)) / 2);
    return tiles;
  }

  // All available flips: [{ vertex, hexCenter6 (= 6 * center), tiles: [i, j, k] }]
  function flipSites(tiles) {
    const incident = new Map();
    tiles.forEach((t, i) => corners(t).forEach((v) => {
      const k = key(v);
      if (!incident.has(k)) incident.set(k, { v, ts: [] });
      incident.get(k).ts.push(i);
    }));
    const sites = [];
    for (const { v, ts } of incident.values()) {
      if (ts.length !== 3) continue;
      const dirs = new Set(ts.flatMap((i) => [tiles[i].a, tiles[i].b]));
      if (dirs.size !== 3) continue;
      const boundary = new Map();
      ts.forEach((i) => corners(tiles[i]).forEach((q) => { if (key(q) !== key(v)) boundary.set(key(q), q); }));
      console.assert(boundary.size === 6);
      const c6 = [...boundary.values()].reduce(add, Array(N).fill(0));
      sites.push({ vertex: v, c6, tiles: ts });
    }
    return sites;
  }

  // Rotating a rhombus 180° about c sends its far corner p + e_a + e_b to 2c - (...).
  function applyFlip(tiles, site) {
    return tiles.map((t, i) => {
      if (!site.tiles.includes(i)) return t;
      const far = corners(t)[2];
      const p6 = site.c6.map((c, k) => 2 * c - 6 * far[k]);
      console.assert(p6.every((x) => x % 6 === 0));
      return { a: t.a, b: t.b, p: p6.map((x) => x / 6) };
    });
  }

  const canon = (tiles) => tiles.map((t) => `${t.a}${t.b}:${key(t.p)}`).sort().join("|");

  function mount(root) {
    const size = 100, s = size / (2 + Math.sqrt(3));
    const V = [...Array(N).keys()].map((k) => [s * Math.cos((Math.PI * k) / 6), s * Math.sin((Math.PI * k) / 6)]);
    const origin = [(size - s) / 2, 0];
    const proj = (p) => p.reduce(([x, y], c, k) => [x + c * V[k][0], y + c * V[k][1]], origin);

    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", `-2 -2 ${size + 4} ${size + 4}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "A rhombus tiling of a dodecagon. Click a dot to flip the three tiles around it.");
    const gTiles = document.createElementNS(SVGNS, "g");
    const gDots = document.createElementNS(SVGNS, "g");
    gDots.setAttribute("class", "flip-dots");
    svg.append(gTiles, gDots);
    root.prepend(svg);

    const home = initialTiling();
    const visited = new Set([canon(home)]);
    let tiles = home, busy = false;
    const counter = root.querySelector("[data-visited]");
    const polys = tiles.map((t) => {
      const el = document.createElementNS(SVGNS, "polygon");
      el.setAttribute("fill", COLORS[t.b - t.a]);
      gTiles.append(el);
      return el;
    });

    function draw() {
      tiles.forEach((t, i) => {
        polys[i].setAttribute("points", corners(t).map((c) => proj(c).map((x) => x.toFixed(3)).join(",")).join(" "));
        polys[i].removeAttribute("transform");
      });
      gDots.replaceChildren(...flipSites(tiles).map((site) => {
        const [x, y] = proj(site.vertex);
        const dot = document.createElementNS(SVGNS, "circle");
        Object.entries({ cx: x, cy: y, r: 2.4, tabindex: 0, role: "button", "aria-label": "flip" })
          .forEach(([k, v]) => dot.setAttribute(k, v));
        dot.addEventListener("click", () => flip(site));
        dot.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(site); } });
        return dot;
      }));
      if (counter) counter.textContent = visited.size;
    }

    function flip(site, ms = 420) {
      if (busy) return;
      busy = true;
      const [cx, cy] = proj(site.c6.map((x) => x / 6));
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const start = performance.now();
      gDots.style.opacity = 0;
      const step = (now) => {
        const u = reduce ? 1 : Math.min(1, (now - start) / ms);
        const eased = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
        site.tiles.forEach((i) => polys[i].setAttribute("transform", `rotate(${180 * eased} ${cx} ${cy})`));
        if (u < 1) return requestAnimationFrame(step);
        tiles = applyFlip(tiles, site);
        visited.add(canon(tiles));
        busy = false;
        gDots.style.opacity = "";
        draw();
      };
      requestAnimationFrame(step);
    }

    root.querySelector("[data-reset]")?.addEventListener("click", () => { if (!busy) { tiles = home; draw(); } });
    root.querySelector("[data-shuffle]")?.addEventListener("click", () => {
      const sites = flipSites(tiles);
      flip(sites[Math.floor(Math.random() * sites.length)], 260);
    });
    draw();
  }

  globalThis.RhombusTiling = { initialTiling, flipSites, applyFlip, canon };
  if (typeof document !== "undefined") document.querySelectorAll("[data-tiling]").forEach(mount);
})();
