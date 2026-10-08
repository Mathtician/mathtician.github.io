// rocq_llm_bench: every graded attempt, wall-clock time against fitted problem difficulty.
//
// Data (data/rocq_llm_bench.json) is exported from the benchmark's ledger:
//   points: [config, problem, tier, kind, seconds]   kind ∈ solved | timeout | early
//   d:      problem -> fitted difficulty (censored model log T = a·d + c, per-config σ)
//   models: config -> { a, c }
// Problems attempted by only one config have no fitted d and are not drawn.

(() => {
  const root = document.querySelector("[data-rlb-chart]");
  if (!root) return;
  const SVGNS = "http://www.w3.org/2000/svg";

  const LABELS = {
    "claude-opus55-medium": "Opus 5.5",
    "claude-sonnet55-medium": "Sonnet 5.5",
    "claude-fable-low": "Fable 5.1",
    "claude-opus-medium": "Opus 5",
    "claude-opus-high": "Opus 5 (high)",
    "claude-sonnet-high": "Sonnet 5 (high)",
    "claude-haiku": "Haiku 4.5",
    "codex-astra-low": "GPT-6 Astra",
    "codex-high": "GPT-5.6 Sol",
    "codex-terra-high": "GPT-5.6 Terra",
    "agy-gemini38-flash-high": "Gemini 3.8 Flash",
    "cursor-grok46-low": "Grok 4.6",
    "cursor-composer-25": "Composer 2.5",
    "pi-deepseek-v41-flash": "DeepSeek V4.1 Flash",
    "pi-baseten-deepseek-v4-pro": "DeepSeek V4 Pro",
    "pi-fireworks-kimi": "Kimi K3",
    "pi-baseten-kimi": "Kimi K3 (Baseten)",
    "pi-fireworks-qwen38-max": "Qwen3.8-Max",
  };
  const label = (c) => LABELS[c] || c;
  const HIGHLIGHT = ["claude-opus55-medium", "codex-astra-low", "pi-deepseek-v41-flash"];
  const SLOTS = ["var(--hl1)", "var(--hl2)", "var(--hl3)"];
  const TIER_NAMES = { easy: "easy", medium: "medium", hard: "hard", vhard: "very hard", custom: "custom", putnam: "Putnam 2025", imo: "IMO" };

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.append(e);
    return e;
  };
  const fmtTime = (s) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

  fetch(root.dataset.rlbChart)
    .then((r) => r.json())
    .then((data) => {
      const pts = data.points.filter(([, p]) => p in data.d);
      const counts = {};
      pts.forEach(([c]) => (counts[c] = (counts[c] || 0) + 1));
      const chipConfigs = Object.keys(LABELS).filter((c) => counts[c]);
      let hi = HIGHLIGHT.filter((c) => counts[c]);

      const W = 720, H = 340, L = 60, R = 14, T = 12, B = 44;
      const ds = Object.values(data.d);
      const dmin = Math.min(...ds) - 0.15, dmax = Math.max(...ds) + 0.15;
      const ylo = 0.5, yhi = Math.log10(3600 * 1.6); // ~3 s to ~1.6 h
      const x = (d) => L + ((d - dmin) / (dmax - dmin)) * (W - L - R);
      const y = (s) => T + ((yhi - Math.log10(Math.max(s, 10 ** ylo))) / (yhi - ylo)) * (H - T - B);

      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Wall-clock time of ${pts.length} agent attempts against fitted problem difficulty` });
      const chips = document.createElement("div");
      chips.className = "chips";
      root.prepend(svg, chips); // above the figcaption

      // static frame
      const frame = el("g", { class: "frame" }, svg);
      for (const [s, txt] of [[10, "10 s"], [60, "1 min"], [600, "10 min"], [3600, "1 h"]]) {
        el("line", { x1: L, x2: W - R, y1: y(s), y2: y(s), class: "gridline" }, frame);
        el("text", { x: L - 6, y: y(s) + 4, "text-anchor": "end" }, frame).textContent = txt;
      }
      // tier labels at each tier's mean difficulty, staggered on two rows
      const tierD = {};
      for (const [, p, t] of pts) (tierD[t] ??= new Set()).add(p);
      Object.entries(tierD)
        .map(([t, ps]) => [t, [...ps].reduce((a, p) => a + data.d[p], 0) / ps.size])
        .sort((a, b) => a[1] - b[1])
        .forEach(([t, m], i) => {
          el("line", { x1: x(m), x2: x(m), y1: H - B, y2: H - B + 4 + (i % 2) * 12, class: "tick" }, frame);
          el("text", { x: x(m), y: H - B + 14 + (i % 2) * 12, "text-anchor": "middle" }, frame).textContent = TIER_NAMES[t] || t;
        });
      el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "axis" }, frame);
      el("text", { x: W - R, y: H - 2, "text-anchor": "end", class: "axis-label" }, frame).textContent = "fitted problem difficulty →";
      const midY = (T + H - B) / 2;
      el("text", { x: 11, y: midY, class: "axis-label", transform: `rotate(-90 11 ${midY})`, "text-anchor": "middle" }, frame).textContent = "wall-clock time (log scale)";

      const clip = el("clipPath", { id: "rlb-plot-area" }, el("defs", {}, svg));
      el("rect", { x: L, y: 0, width: W - L - R, height: H - B }, clip);
      const layer = el("g", { "clip-path": "url(#rlb-plot-area)" }, svg);
      function draw() {
        layer.replaceChildren();
        // jitter repeated attempts on one problem deterministically
        const seen = {};
        const order = [...pts].sort((a, b) => hi.includes(a[0]) - hi.includes(b[0]));
        for (const [c, p, t, kind, s] of order) {
          const k = (seen[p] = (seen[p] || 0) + 1);
          const cx = x(data.d[p]) + (((k * 7) % 11) - 5) * 0.9, cy = y(s);
          const slot = hi.indexOf(c);
          const color = slot >= 0 ? SLOTS[slot] : "var(--dot)";
          const g = el("g", { class: slot >= 0 ? "pt hl" : "pt" }, layer);
          el("title", {}, g).textContent = `${label(c)} · ${p.replace(/_/g, " ")} (${TIER_NAMES[t] || t}) · ${kind === "solved" ? "solved" : kind === "timeout" ? "timed out" : "gave up"} after ${fmtTime(s)}`;
          if (kind === "solved") {
            el("circle", { cx, cy, r: slot >= 0 ? 3.6 : 2.6, fill: color }, g);
          } else {
            el("path", { d: `M${cx} ${cy - 3} V${cy - 12} M${cx - 3} ${cy - 9} L${cx} ${cy - 12} L${cx + 3} ${cy - 9}`, stroke: color, fill: "none", "stroke-width": 1.4 }, g);
            el("circle", { cx, cy, r: slot >= 0 ? 3.4 : 2.6, fill: "var(--paper)", stroke: color, "stroke-width": 1.4 }, g);
          }
        }
        // fitted trend log T = a·d + c for highlighted configs
        hi.forEach((c, i) => {
          const f = data.models[c];
          if (!f) return;
          const at = (d) => Math.exp(f.a * d + f.c);
          el("line", { x1: x(dmin), y1: y(at(dmin)), x2: x(dmax), y2: y(at(dmax)), stroke: SLOTS[i], "stroke-width": 1.6, opacity: 0.7 }, layer);
        });
        chips.replaceChildren(...chipConfigs.map((c) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          const slot = hi.indexOf(c);
          b.setAttribute("aria-pressed", slot >= 0);
          b.innerHTML = `<span class="sw" style="background:${slot >= 0 ? SLOTS[slot] : "var(--dot)"}"></span>${label(c)}`;
          b.addEventListener("click", () => {
            const i = hi.indexOf(c);
            if (i >= 0) hi.splice(i, 1);
            else { if (hi.length >= 3) hi.shift(); hi.push(c); }
            draw();
          });
          return b;
        }));
      }
      draw();
    })
    .catch(() => { root.textContent = "(chart data failed to load)"; });
})();
