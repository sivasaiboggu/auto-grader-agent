/* Auto-grader agent — tests for the pure logic in logic.js.
   Run: node --test tests/   (Node 24 built-in runner, no dependencies) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const RUBRIC = {
  id: 'essay',
  name: 'Essay',
  kind: 'essay',
  criteria: [
    { id: 'thesis', name: 'Thesis', weight: 25, maxPoints: 10, descriptor: 'Clear position.' },
    { id: 'evidence', name: 'Evidence', weight: 30, maxPoints: 10, descriptor: 'Named sources.' },
    { id: 'structure', name: 'Structure', weight: 25, maxPoints: 10, descriptor: 'Logical order.' },
    { id: 'language', name: 'Language', weight: 20, maxPoints: 10, descriptor: 'Clear sentences.' }
  ]
};

const TEXT = 'School should start later because teenagers need more sleep. Most students are tired in the morning and cannot concentrate in their first lessons.\n\n' +
  'Research shows that teenagers need about nine hours of sleep. Many students get far less because homework and phones keep them up late.';

const GOOD_GRADE = {
  scores: [
    { criterionId: 'thesis', score: 8, evidence: 'School should start later because teenagers need more sleep.', feedback: 'Clear position.' },
    { criterionId: 'evidence', score: 7, evidence: 'Research shows that teenagers need about nine hours of sleep.', feedback: 'No source named.' },
    { criterionId: 'structure', score: 7, evidence: 'Most students are tired in the morning and cannot concentrate in their first lessons.', feedback: 'Sensible order.' },
    { criterionId: 'language', score: 7, evidence: 'Many students get far less because homework and phones keep them up late.', feedback: 'Plain and readable.' }
  ]
};

test('validateWeights: 25+30+25+20 sums to 100', () => {
  assert.equal(L.validateWeights(RUBRIC.criteria), true);
});

test('validateWeights: decimal weights that sum to 100 in decimal pass (float-safe)', () => {
  // 0.01 + 64.04 + 35.95 is 100.00000000000001 in binary float, so an exact
  // === 100 check would wrongly block saving this rubric.
  const decimal = [
    { id: 'a', name: 'A', weight: 0.01, maxPoints: 10 },
    { id: 'b', name: 'B', weight: 64.04, maxPoints: 10 },
    { id: 'c', name: 'C', weight: 35.95, maxPoints: 10 }
  ];
  assert.equal(L.validateWeights(decimal), true);
});

test('validateWeights: 90 does not sum to 100', () => {
  const bad = RUBRIC.criteria.map(c => ({ ...c }));
  bad[0].weight = 15;
  assert.equal(L.validateWeights(bad), false);
});

test('validateWeights: zero or negative weight fails', () => {
  const bad = RUBRIC.criteria.map(c => ({ ...c }));
  bad[1].weight = 0;
  assert.equal(L.validateWeights(bad), false);
});

test('bandFor: boundaries 90/80/70/60', () => {
  assert.equal(L.bandFor(95), 'A');
  assert.equal(L.bandFor(90), 'A');
  assert.equal(L.bandFor(89.9), 'B');
  assert.equal(L.bandFor(80), 'B');
  assert.equal(L.bandFor(70), 'C');
  assert.equal(L.bandFor(60), 'D');
  assert.equal(L.bandFor(59.9), 'F');
});

test('weightedPercent: seeded average essay is 72.5%', () => {
  assert.equal(L.weightedPercent(GOOD_GRADE.scores, RUBRIC.criteria), 72.5);
});

test('weightedPercent: perfect scores are 100%', () => {
  const perfect = GOOD_GRADE.scores.map(s => ({ ...s, score: 10 }));
  assert.equal(L.weightedPercent(perfect, RUBRIC.criteria), 100);
});

test('validateGradeOutput: good grade passes', () => {
  const r = L.validateGradeOutput(GOOD_GRADE, RUBRIC, TEXT);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('validateGradeOutput: score above max fails', () => {
  const bad = JSON.parse(JSON.stringify(GOOD_GRADE));
  bad.scores[0].score = 11;
  const r = L.validateGradeOutput(bad, RUBRIC, TEXT);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /outside 0–10/);
});

test('validateGradeOutput: invented evidence quote fails', () => {
  const bad = JSON.parse(JSON.stringify(GOOD_GRADE));
  bad.scores[1].evidence = 'The CDC sleep study of 2024 proves this conclusively.';
  const r = L.validateGradeOutput(bad, RUBRIC, TEXT);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /not a line from the submission/);
});

test('validateGradeOutput: missing criterion fails', () => {
  const bad = JSON.parse(JSON.stringify(GOOD_GRADE));
  bad.scores = bad.scores.slice(0, 3);
  const r = L.validateGradeOutput(bad, RUBRIC, TEXT);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /Language.*not scored/);
});

test('validateGradeOutput: unknown criterion fails', () => {
  const bad = JSON.parse(JSON.stringify(GOOD_GRADE));
  bad.scores[0].criterionId = 'vibes';
  const r = L.validateGradeOutput(bad, RUBRIC, TEXT);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /unknown criterion/);
});

test('parseGradeJson: valid JSON grade parses and validates', () => {
  const parsed = L.parseGradeJson(JSON.stringify(GOOD_GRADE), RUBRIC, TEXT);
  assert.equal(parsed.scores.length, 4);
});

test('parseGradeJson: non-JSON throws', () => {
  assert.throws(() => L.parseGradeJson('not json at all', RUBRIC, TEXT), /not valid JSON/);
});

test('parseGradeJson: JSON with invented quote throws', () => {
  const bad = JSON.parse(JSON.stringify(GOOD_GRADE));
  bad.scores[2].evidence = 'A line that was never written.';
  assert.throws(() => L.parseGradeJson(JSON.stringify(bad), RUBRIC, TEXT), /not a line from the submission/);
});

test('localAppealReview: quoting an uncited line upholds and raises by 1', () => {
  const r = L.localAppealReview({
    appealText: 'The essay does give evidence: "Many students get far less because homework and phones keep them up late." That names a cause.',
    submissionText: TEXT,
    oldEvidence: 'Research shows that teenagers need about nine hours of sleep.',
    oldScore: 7, maxPoints: 10
  });
  assert.equal(r.upheld, true);
  assert.equal(r.newScore, 8);
  assert.equal(r.rule, 'new-evidence');
});

test('localAppealReview: quoting the already-cited line is denied', () => {
  const r = L.localAppealReview({
    appealText: 'But I did cite this: "Research shows that teenagers need about nine hours of sleep."',
    submissionText: TEXT,
    oldEvidence: 'Research shows that teenagers need about nine hours of sleep.',
    oldScore: 7, maxPoints: 10
  });
  assert.equal(r.upheld, false);
  assert.equal(r.newScore, 7);
  assert.equal(r.rule, 'already-cited');
});

test('localAppealReview: appeal with no quoted line is denied', () => {
  const r = L.localAppealReview({
    appealText: 'I worked really hard on this essay and I deserve a better grade, please reconsider.',
    submissionText: TEXT,
    oldEvidence: 'Research shows that teenagers need about nine hours of sleep.',
    oldScore: 7, maxPoints: 10
  });
  assert.equal(r.upheld, false);
  assert.equal(r.newScore, 7);
  assert.equal(r.rule, 'no-new-evidence');
});

test('localAppealReview: full marks cannot be raised', () => {
  const r = L.localAppealReview({
    appealText: '"Many students get far less because homework and phones keep them up late."',
    submissionText: TEXT,
    oldEvidence: 'Research shows that teenagers need about nine hours of sleep.',
    oldScore: 10, maxPoints: 10
  });
  assert.equal(r.upheld, false);
  assert.equal(r.newScore, 10);
  assert.equal(r.rule, 'already-full-marks');
});

test('localAppealReview: raise is capped at max points', () => {
  const r = L.localAppealReview({
    appealText: '"Many students get far less because homework and phones keep them up late."',
    submissionText: TEXT,
    oldEvidence: 'Research shows that teenagers need about nine hours of sleep.',
    oldScore: 10, maxPoints: 10
  });
  assert.ok(r.newScore <= 10);
});

test('staticPythonChecks: fizzbuzz seed passes def/return, fails docstring', () => {
  const code = 'def fizzbuzz(n):\n    out = []\n    for i in range(1, n):\n        out.append(str(i))\n    return out';
  const checks = L.staticPythonChecks(code);
  const byName = {};
  checks.forEach(c => { byName[c.name] = c; });
  assert.equal(byName['Function defined'].passed, true);
  assert.equal(byName['Returns a value'].passed, true);
  assert.equal(byName['Docstring present'].passed, false);
  assert.equal(byName['No debug prints'].passed, true);
});

test('staticPythonChecks: print() is flagged', () => {
  const checks = L.staticPythonChecks('def f(x):\n    print(x)\n    return x');
  const flagged = checks.find(c => c.name === 'No debug prints');
  assert.equal(flagged.passed, false);
  assert.match(flagged.detail, /1 print/);
});

test('buildGeminiPrompt: names every criterion and demands exact quotes', () => {
  const prompt = L.buildGeminiPrompt(RUBRIC, 'essay', TEXT);
  assert.match(prompt, /Thesis/);
  assert.match(prompt, /Evidence/);
  assert.match(prompt, /copied exactly from the submission/);
  assert.match(prompt, /JSON only/);
});

test('buildAppealPrompt: names the criterion, old score, and appeal', () => {
  const prompt = L.buildAppealPrompt(RUBRIC, RUBRIC.criteria[1], TEXT, 7, 'Please reconsider.');
  assert.match(prompt, /Evidence/);
  assert.match(prompt, /Original score: 7\/10/);
  assert.match(prompt, /Please reconsider/);
});

test('exportMarkdown: contains grade, evidence, and appeal trail', () => {
  const grade = {
    percent: 72.5, band: 'C', overallPoints: 7.3, overallMax: 10,
    gradedAt: '2026-11-20', sourceLabel: 'Seeded grade', criterionScores: GOOD_GRADE.scores
  };
  const md = L.exportMarkdown(
    { studentName: 'Maya R.', assignment: 'Should schools start later?' },
    grade, RUBRIC,
    [{ criterionId: 'evidence', oldScore: 7, newScore: 8, status: 'upheld', text: 'Quoted a new line.', reason: 'New evidence cited.' }]
  );
  assert.match(md, /Maya R\./);
  assert.match(md, /72\.5% \(C\)/);
  assert.match(md, /Research shows that teenagers need about nine hours of sleep/);
  assert.match(md, /7 → 8 \(upheld\)/);
  assert.match(md, /model judgements, not ground truth/);
});

test('overallMax: essay rubric max is 10 points', () => {
  assert.equal(L.overallMax(RUBRIC.criteria), 10);
});
