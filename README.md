# Auto-grader agent

Grade essays and code against a rubric, with a quoted line of evidence for every
point — and an appeal process that shows its work.

**Demo:** open `index.html` in a browser (or serve the folder). No install, no
build step, no server. Works from `file://` and on GitHub Pages.

## What it does

- **Grade** — paste an essay or code, pick a rubric, get a grade sheet: one row
  per criterion with a score bar, an evidence quote copied from the work itself,
  and one line of feedback. Overall grade as a percentage, points, and a letter
  band (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60).
- **Appeal** — on any grade sheet, appeal one criterion. Only that criterion is
  re-graded; the old score stays visible, struck through, next to the new one,
  with a written reason and a dated trail entry. A criterion can be appealed once.
- **Code, two numbers kept apart** — hidden-test results are *measured*;
  readability/efficiency scores are *model judgement*. They are never mixed.
  JavaScript runs in a Web Worker with a 2-second timeout and no DOM access.
  Python is **not executed** in this browser demo — static checks only, and the
  UI says so.
- **Rubrics** — two built in (Essay: Thesis, Evidence, Structure, Language;
  Code: Correctness, Readability, Efficiency, Hidden tests) plus a builder.
  Weights must add up to 100% before a custom rubric can be saved.
- **Teacher view** — all submissions, class average, appeal rate, appeals upheld,
  and a per-submission detail sheet.
- **Export** — download any grade sheet as Markdown, including the appeal trail.

## No key? No fake grade.

There is no API key in this demo environment, and the app never pretends
otherwise. Without a key:

- Live grading is off, and the UI says so in plain words.
- Five seeded submissions (3 essays, 2 code) carry grades recorded with the
  seed data, labelled **"Seeded grade"**.
- Appeals run on a transparent local reviewer: it raises a score by 1 point
  only when the appeal quotes a line from the work that the original grade did
  not cite. The rule it applied is named in the outcome.
- Static Python checks and the JavaScript hidden-test runner still work.

With a key, everything goes live (see Settings).

## Live grading (your own free key)

1. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Open **Settings**, paste it, pick a model, save. The key lives in this
   browser only (`localStorage`) and is sent nowhere except
   `generativelanguage.googleapis.com`.
3. Grade any submission. The model used is **Gemini `gemini-2.5-flash`** (free
   tier; verified 23 Nov 2026), with `gemini-2.5-flash-lite` as an option.

Before a live grade is shown, a local checker verifies it: every score in
range, every criterion addressed, and every evidence quote a real substring of
the submission. A failed check retries once; a second failure is shown as an
error, never silently patched. Appeals with a key re-grade only the disputed
criterion, with the student's argument appended.

## Honest limits

- Scores are model judgements, not ground truth. The same essay can score
  differently on a re-run.
- The local appeal reviewer is rule-based and transparent; it is not a model
  judgement.
- Python code is never executed in the browser demo; JavaScript runs in a
  Worker with a 2-second timeout and no DOM access.
- Data lives in the browser (`localStorage`); clearing browser data clears
  submissions. A hosted version would use Postgres with the same data shapes
  (see `PLAN.md`).
- Letter bands are a demo default, not any institution's official scale.

## Design

Slate `#334155` + Public Sans (Google Fonts, v2.001, OFL). The signature idea is
the **grade sheet**: a ruled ledger — one row per criterion, score bar as a
ruled line, evidence quote in a bordered block, appeal trail as dated entries
underneath. References: USWDS/government service design (Public Sans's home),
Linear (dense, quiet dashboard), Gradescope (rubric-first grading and
regrade requests). No gradients, no glows, no cliché copy.

## Run the tests

```bash
node --test tests/test.js
```

25 tests, 0 failures (Node 24 built-in runner, no dependencies). They cover
weight validation, grade bands, weighted scores, grade-output validation
(including invented evidence quotes), all four local-appeal rules, Python
static checks, prompt construction, and Markdown export.

## Files

- `index.html` — shell, nav, footer
- `styles.css` — design tokens and layout
- `app.js` — UI, Gemini calls, Worker test runner, appeal flow
- `logic.js` — pure grading/appeal logic (shared by the app and the tests)
- `data.js` — built-in rubrics, seeded submissions, hidden JS tests
- `tests/test.js` — 25 tests
- `PLAN.md` — the deepened SaaS-level plan
- `screenshots/` — desktop + mobile renders, verified with zero horizontal overflow

## Deploy

Push this folder to a public GitHub repo named `auto-grader-agent`, then enable
Settings → Pages → main branch → `/(root)`. The site will be
`https://<username>.github.io/auto-grader-agent/`.

## License

MIT — see `LICENSE`. Built by Sivasai Boggu, 2026.
