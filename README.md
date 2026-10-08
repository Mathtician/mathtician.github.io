# mathtician.github.io

Personal site of Aresh Pourkavoos: <https://mathtician.github.io>.

Plain hand-written HTML/CSS/JS, no build step.

- `index.html`, `style.css`: the page.
- `tiling.js`: the flippable rhombus tiling of a 12-gon in the header (also exports `RhombusTiling` for testing: `node -e 'require("./tiling.js")'`).
- `rlbchart.js`, `data/rocq_llm_bench.json`: the rocq_llm_bench attempts chart. The data is exported from the benchmark's ledger (every valid attempt, plus the censored wall-time fit from `scripts/fit_tokens.py --measure wall --per-model-sigma`).
- `isomorphic/`: browser port of [isomorphic](https://github.com/Mathtician/isomorphic) (Wicki-Hayden keyboard, Web Audio).
- `Aresh_Pourkavoos_resume.pdf`: résumé without phone number.
