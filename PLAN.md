# Auto-grader agent — deepened plan (SaaS level)

## 1. One sentence
A teacher pastes an essay or a code file, gets a rubric-scored grade with a quoted line of
evidence for every point, and the student can appeal any single criterion and watch the
score change — with the whole trail kept.

## 2. Who it is for, and the pain
- **Teachers / TAs** grading 40–200 essays or code assignments: grading is slow, and the
  same answer scores differently on Monday and Friday.
- **Students** who get a number with no reason and no way to push back.
- **Bootcamps / hiring teams** grading take-home code at volume.
- The pain is not "grading takes time". It is that a grade with no evidence cannot be
  trusted, checked, or appealed — so every grade becomes an argument.

## 3. Core promise
Every point on a grade can be traced to a line in the student's own work, and every
changed score has a written reason attached to it.

## 4. Design identity
- **Palette:** slate `#334155` as the working colour, ink `#0f172a`, paper `#ffffff`,
  wash `#f1f5f9`, hairline `#e2e8f0`. Semantic grade bands only: green `#166534`,
  amber `#92400e`, red `#991b1b`. No gradients, no glows.
- **Type:** Public Sans (Google Fonts, v2.001, variable 100–900, OFL) — 400 body,
  600 labels/buttons, 700 headings. Mono for code and evidence quotes:
  ui-monospace stack.
- **Signature idea:** the grade sheet. Every grade renders as a ruled ledger — one row
  per criterion, score bar as a ruled line, evidence quote in a bordered block, appeal
  trail as a dated ledger entry underneath. Same sheet in the student view, the teacher
  view, and the exported Markdown.
- **References (playbook):** USWDS / government service design (Public Sans's home —
  plain, institutional, readable at small sizes); Linear (dense, quiet dashboard, one
  accent, tabular figures); Gradescope (rubric-first grading, per-criterion evidence,
  appeal/regrade request flow).
- **Motion:** 150–250ms, transform/opacity only — score bars fill, panels open, nothing
  else moves.

## 5. Feature set (SaaS level, demoable in 24–48h)

### Grading
- **Rubrics:** two built-in rubrics (Essay: Thesis, Evidence, Structure, Language;
  Code: Correctness, Readability, Efficiency, Tests), each criterion with weight,
  max points, and a one-line descriptor of what earns full marks.
- **Custom rubric builder:** add / rename / re-weight criteria, set max points per
  criterion; weights must sum to 100% (validated live, save blocked until they do).
- **Essay grading:** paste text (or upload .txt/.md). One model call per submission
  (all criteria in one JSON response), then a local checker validates: every score in
  range, every criterion addressed, every evidence quote is a real substring of the
  submission. A failed check retries once; a second failure is shown as an error, never
  silently patched.
- **Code grading:** paste code, pick a language (Python, JavaScript). Two separate
  numbers, never mixed: (a) **hidden-test results** — deterministic, from execution;
  (b) **judged scores** (readability, efficiency) from the model. Test results are
  labelled "measured", judged scores "model judgement".
- **Code execution (browser demo):** JavaScript submissions run in a Web Worker with a
  2-second timeout and no DOM access; the worker is terminated on timeout. Python is
  **not executed** in this demo — static checks only (function defined, returns a
  value, docstring present, obvious complexity flags). The UI says this in plain words
  next to the results. A hosted version would run code in a sandboxed container with
  no network and a read-only filesystem.
- **Overall grade:** weighted sum, shown as points and as a letter band (A ≥ 90, B ≥ 80,
  C ≥ 70, D ≥ 60, else F). Bands are shown next to the rubric so the mapping is never
  hidden.

### Appeals (the differentiator)
- Student picks **one criterion**, writes a short appeal (min 20 characters), submits.
- Re-grade runs on **that criterion only**, with the student's argument appended.
  With an API key: the model re-grades. Without a key: a transparent local appeal
  reviewer applies published rules (appeal quotes a line from the submission that the
  original evidence missed → +1 point up to the criterion max; appeal restates the
  original feedback without new evidence → no change; appeal points at a line that
  contradicts the claim → no change). The rule applied is named in the outcome.
- **Before / after** shown side by side; both scores stay visible forever. The appeal,
  the new score, the reason, and the timestamp are appended to the submission's trail.
  A criterion can be appealed once; a second appeal on the same criterion is blocked
  with the reason shown.
- **Appeal queue (teacher view):** pending / upheld / denied, filterable, each row
  opening the full trail.

### Teacher view
- Submission list: student name, assignment, rubric, overall score, status
  (graded / appealed / appeal pending), date. Sort by score and by date.
- Class stats: submission count, average score, appeal rate, appeals upheld.
- Per-submission detail: full grade sheet, evidence quotes, appeal trail.
- **Export:** one click downloads the grade sheet as Markdown (grade, per-criterion
  scores, evidence, feedback, appeal trail).

### Settings & honesty
- **API key:** paste a free Gemini API key (Google AI Studio), stored in localStorage
  only, never sent anywhere except `generativelanguage.googleapis.com`. "Test key"
  button calls the API once and reports success/failure. "Remove key" wipes it.
- **No key, no fake grade:** without a key the app grades nothing live. It offers the
  seeded submissions (grades recorded with the seed data, labelled "Seeded grade"),
  the local appeal reviewer, static code checks, and the JS test runner.
- **Labels everywhere:** every score is tagged "Seeded grade", "Live grade (Gemini
  gemini-2.5-flash)", or "Local rule check" so a demo viewer can always tell which is
  which. Scores are called model judgements in the UI, not ground truth.

## 6. Data model (localStorage; a hosted version would use Postgres with the same shapes)

```
Rubric    { id, name, kind: 'essay'|'code', criteria: [{ id, name, weight, maxPoints, descriptor }] }
Submission{ id, studentName, assignment, kind, rubricId, text, language?, createdAt,
            status: 'draft'|'graded'|'appeal-pending'|'appeal-resolved',
            gradeSource: 'seeded'|'live'|'local', model?: string }
Grade     { submissionId, criterionScores: [{ criterionId, score, maxPoints, evidence, feedback }],
            overallPoints, overallMax, percent, band, gradedAt }
Appeal    { id, submissionId, criterionId, text, status: 'pending'|'upheld'|'denied',
            oldScore, newScore, reason, ruleApplied?, decidedAt }
TestRun   { submissionId, language, passed, failed, results: [{ name, passed, detail }], ranAt, note }
```

## 7. User flow end to end
1. Land on **Grade**. The page says what the tool does in one sentence and shows the
   seeded submissions so the demo never starts from a blank box.
2. Pick a rubric (Essay or Code), paste text or click a seeded submission to load it.
   Student name + assignment are optional fields; without them the submission is
   filed as "Unnamed".
3. Click **Grade**. With a key: a progress line ("Scoring 4 criteria…"), then the grade
   sheet appears — one row per criterion with score bar, evidence quote, feedback, and
   the overall grade + band at the top. Without a key: a plain message — "No API key
   saved. Live grading needs a free Gemini key in Settings. Seeded submissions below
   already have grades." — and the seeded grade sheet is one click away.
4. **Code path:** after grading, click **Run hidden tests** (JavaScript) or **Static
   checks** (Python). Results appear in their own panel, labelled "measured", separate
   from judged scores.
5. Click **Appeal a criterion** on any graded submission. Pick the criterion, write
   the appeal, submit. The criterion row updates in place: old score struck through,
   new score beside it, reason underneath, trail entry added. The submission moves to
   "appeal-resolved" and the appeal appears in the teacher queue as decided.
6. **Teacher view:** scan the list, open any submission, read the trail, export the
   grade sheet as Markdown.
7. **Settings:** paste a key, test it, remove it. The key status ("Key saved" /
   "No key saved") is visible in the header on every screen.

## 8. Screens
1. Grade (new submission + seeded submissions + grade sheet + appeal form)
2. Submissions (teacher list + stats + detail sheet)
3. Rubrics (built-in list + builder)
4. Appeals (queue)
5. Settings (API key, model, data reset, honesty notes)

## 9. Stack (verified 23 Nov 2026)
- **Frontend:** plain HTML/CSS/JS, no build step — the demo must open from `file://`
  and on GitHub Pages with zero install. Public Sans via Google Fonts (v2.001).
- **AI:** Google Gemini API, model `gemini-2.5-flash` (free tier, stable ID, verified
  against Google's pricing/free-tier pages 23 Nov 2026; fallback
  `gemini-2.5-flash-lite`). REST `generateContent`, JSON response
  (`responseMimeType: "application/json"`), key in localStorage only.
- **Persistence:** localStorage (demo stand-in for SQLite/Postgres; same data shapes).
- **Code execution:** Web Worker + 2s timeout for JavaScript; static checks only for
  Python (stated in UI).
- **Tests:** Node 24 built-in `node:test`, no dependencies. Run: `node --test tests/`.
- **Hosting (later):** GitHub Pages (static). No server, no cost, no key on any server.

## 10. 2-minute demo script
- **0:00–0:15** — "Grading is slow and inconsistent; this shows its work." Open the
  seeded average essay ("Should schools start later?").
- **0:15–0:50** — Grade sheet appears: four criteria, each with a score bar, a quoted
  line from the essay as evidence, and one line of feedback. Point at the Evidence
  row: "7/10 — the quote is what makes it checkable."
- **0:50–1:20** — Appeal the Evidence criterion, quoting a line the grade did not cite:
  "The essay does give evidence for the claim: 'Many students get far less because
  homework and phones keep them up late.' That line names a cause, not just a claim."
  Score moves 7 → 8, reason written out, both scores stay visible. "The appeal is
  part of the grade now, not a separate email."
- **1:20–1:45** — Switch to the seeded code submission. Hidden tests: 4/5 measured;
  readability 8/10 judged — two different kinds of number, shown apart.
- **1:45–2:00** — Teacher view: appeal queue shows the appeal as upheld, class average
  78%, export the grade sheet as Markdown.

## 11. Biggest risk + fallback
Scores are model judgements: the same essay can score differently on a re-run, and a
model can invent evidence. Mitigations: evidence quotes must be substrings of the
submission (checked locally, retry once), rubric + quotes + appeal trail always shown,
test results kept separate from judged scores. Fallback: if the API is slow or the
scores look wrong live, grade the seeded submissions (grades recorded with the seed
data) and run only the appeal live. If code execution is unsafe in the demo
environment, show static checks only and say so — never run untrusted code without a
timeout and no DOM/filesystem access.

## 12. Honest limits (also in README)
- No API key exists in this VM, so no live grade was produced here; seeded grades are
  recorded with the seed data and labelled as such.
- Local appeal reviewer is rule-based and transparent; it is not a model judgement.
- Python code is never executed in the browser demo; JavaScript runs in a Worker with
  a 2s timeout and no DOM access.
- Data lives in the browser (localStorage); clearing browser data clears submissions.
- Letter bands are a demo default, not any institution's official scale.

## 13. Launch checklist
- [x] PLAN.md, README.md, LICENSE, tests, screenshots
- [ ] Siva creates GitHub repo `auto-grader-agent`, then push to main + enable Pages
- [ ] Paste a free Gemini key in Settings and run one live grade + one live appeal
- [ ] Record the 2-minute demo

## 14. v2 ideas
1. Real backend (FastAPI + Postgres) with accounts, classes, and assignments.
2. Sandboxed Python execution (container, no network, read-only FS, 5s cap).
3. Plagiarism / AI-text flags as separate, labelled signals — never folded into the score.
4. Rubric import from a file (CSV/Markdown) and rubric versioning per assignment.
5. Batch grading: upload a folder, grade all, download a CSV.
6. Second-model cross-check: two models grade, disagreements flagged for the teacher.
7. Student view with login and a deadline-aware appeal window.
8. Audio feedback: teacher records a 30-second note per criterion.
9. Grade distribution chart per assignment.
10. LMS export (Canvas / Moodle CSV formats).
