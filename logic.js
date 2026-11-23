/* Auto-grader agent — pure logic (no DOM). Usable in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GraderLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalize(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeLower(s) {
    return normalize(s).toLowerCase();
  }

  function validateWeights(criteria) {
    if (!Array.isArray(criteria) || criteria.length === 0) return false;
    var sum = 0;
    for (var i = 0; i < criteria.length; i++) {
      var w = Number(criteria[i].weight);
      if (!isFinite(w) || w <= 0) return false;
      sum += w;
    }
    return sum === 100;
  }

  function bandFor(percent) {
    if (percent >= 90) return 'A';
    if (percent >= 80) return 'B';
    if (percent >= 70) return 'C';
    if (percent >= 60) return 'D';
    return 'F';
  }

  function weightedPercent(criterionScores, criteria) {
    var byId = {};
    criteria.forEach(function (c) { byId[c.id] = c; });
    var total = 0;
    var maxTotal = 0;
    criterionScores.forEach(function (s) {
      var c = byId[s.criterionId];
      if (!c) return;
      total += (Number(s.score) / Number(c.maxPoints)) * Number(c.weight);
      maxTotal += Number(c.weight);
    });
    if (maxTotal === 0) return 0;
    return Math.round((total / maxTotal) * 1000) / 10;
  }

  function overallMax(criteria) {
    var total = 0;
    criteria.forEach(function (c) {
      total += (Number(c.maxPoints) * Number(c.weight)) / 100;
    });
    return Math.round(total * 10) / 10;
  }

  /* Validate a model-produced grade. Every evidence quote must be a real
     substring of the submission — this is what stops invented evidence. */
  function validateGradeOutput(output, rubric, submissionText) {
    var errors = [];
    if (!output || typeof output !== 'object') return { ok: false, errors: ['Grade output is not an object.'] };
    if (!Array.isArray(output.scores)) return { ok: false, errors: ['Grade output has no scores list.'] };
    var seen = {};
    var hay = normalizeLower(submissionText);
    output.scores.forEach(function (s, i) {
      var label = 'Score ' + (i + 1);
      var crit = null;
      rubric.criteria.forEach(function (c) { if (c.id === s.criterionId) crit = c; });
      if (!crit) { errors.push(label + ': unknown criterion "' + s.criterionId + '".'); return; }
      if (seen[s.criterionId]) { errors.push(label + ': criterion "' + crit.name + '" scored twice.'); return; }
      seen[s.criterionId] = true;
      var score = Number(s.score);
      if (!isFinite(score) || score < 0 || score > Number(crit.maxPoints)) {
        errors.push(label + ' (' + crit.name + '): score ' + s.score + ' is outside 0–' + crit.maxPoints + '.');
      }
      if (!s.evidence || !normalize(s.evidence)) {
        errors.push(label + ' (' + crit.name + '): no evidence quote given.');
      } else if (hay.indexOf(normalizeLower(s.evidence)) === -1) {
        errors.push(label + ' (' + crit.name + '): evidence quote is not a line from the submission.');
      }
      if (!s.feedback || !normalize(s.feedback)) {
        errors.push(label + ' (' + crit.name + '): no feedback given.');
      }
    });
    rubric.criteria.forEach(function (c) {
      if (!seen[c.id]) errors.push('Criterion "' + c.name + '" was not scored.');
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function parseGradeJson(text, rubric, submissionText) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Model reply was not valid JSON.');
    }
    var check = validateGradeOutput(parsed, rubric, submissionText);
    if (!check.ok) throw new Error('Grade failed checks: ' + check.errors.join(' '));
    return parsed;
  }

  function splitSentences(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+/)
      .map(normalize)
      .filter(function (s) { return s.length >= 25; });
  }

  /* Local appeal reviewer — transparent, rule-based, used only when no API
     key is saved. The rule it applies is always named in the outcome. */
  function localAppealReview(opts) {
    var appealText = opts.appealText || '';
    var submissionText = opts.submissionText || '';
    var oldEvidence = opts.oldEvidence || '';
    var oldScore = Number(opts.oldScore);
    var maxPoints = Number(opts.maxPoints);
    if (oldScore >= maxPoints) {
      return { upheld: false, newScore: oldScore, rule: 'already-full-marks',
        reason: 'This criterion is already at full marks (' + oldScore + '/' + maxPoints + '), so there is nothing to raise.' };
    }
    var appealNorm = normalizeLower(appealText);
    var evidenceNorm = normalizeLower(oldEvidence);
    var quoted = splitSentences(submissionText).filter(function (s) {
      return appealNorm.indexOf(normalizeLower(s)) !== -1;
    });
    if (quoted.length === 0) {
      return { upheld: false, newScore: oldScore, rule: 'no-new-evidence',
        reason: 'The appeal did not quote a line from the work, so there is no new evidence to weigh. The score stands.' };
    }
    var fresh = quoted.filter(function (s) {
      return evidenceNorm.indexOf(normalizeLower(s)) === -1;
    });
    if (fresh.length === 0) {
      return { upheld: false, newScore: oldScore, rule: 'already-cited',
        reason: 'The line quoted in the appeal was already cited as evidence in the original grade. The score stands.' };
    }
    var line = fresh[0].length > 90 ? fresh[0].slice(0, 90) + '…' : fresh[0];
    return { upheld: true, newScore: Math.min(maxPoints, oldScore + 1), rule: 'new-evidence',
      reason: 'The appeal quoted a line the original grade did not cite — "' + line + '" — so the score rises by 1 point.' };
  }

  /* Static checks for Python code. The browser demo never executes Python. */
  function staticPythonChecks(code) {
    var src = String(code || '');
    var checks = [];
    checks.push({ name: 'Function defined', passed: /^\s*def\s+\w+\s*\(/m.test(src),
      detail: /^\s*def\s+\w+\s*\(/m.test(src) ? 'A top-level function definition was found.' : 'No top-level function definition (def …) was found.' });
    checks.push({ name: 'Returns a value', passed: /\breturn\b/.test(src),
      detail: /\breturn\b/.test(src) ? 'The code has a return statement.' : 'No return statement was found.' });
    checks.push({ name: 'Docstring present', passed: /def\s+\w+\s*\([^)]*\)\s*:\s*(?:"""|''')/.test(src),
      detail: /def\s+\w+\s*\([^)]*\)\s*:\s*(?:"""|''')/.test(src) ? 'The function starts with a docstring.' : 'The function has no docstring.' });
    var prints = (src.match(/\bprint\s*\(/g) || []).length;
    checks.push({ name: 'No debug prints', passed: prints === 0,
      detail: prints === 0 ? 'No print() calls left in the code.' : prints + ' print() call(s) left in the code.' });
    var lines = src.split('\n').filter(function (l) { return l.trim().length > 0; });
    var longLines = lines.filter(function (l) { return l.length > 100; }).length;
    checks.push({ name: 'Line length', passed: longLines === 0,
      detail: longLines === 0 ? 'No line is longer than 100 characters.' : longLines + ' line(s) longer than 100 characters.' });
    return checks;
  }

  function buildGeminiPrompt(rubric, kind, text) {
    var criteria = rubric.criteria.map(function (c) {
      return '- ' + c.id + ' — ' + c.name + ' (weight ' + c.weight + '%, max ' + c.maxPoints +
        ' points). Full marks means: ' + c.descriptor;
    }).join('\n');
    return 'You are a strict, fair grader. Grade the ' + kind + ' below against this rubric:\n' +
      criteria + '\n\nRules:\n' +
      '1. Score every criterion from 0 to its max points. Use the full range; do not give every criterion the same score.\n' +
      '2. For each criterion, quote ONE line from the submission as evidence. The quote must be copied exactly from the submission — do not paraphrase, and do not invent a line.\n' +
      '3. Write one sentence of specific feedback per criterion, naming what to fix.\n' +
      '4. Reply with JSON only, in exactly this shape:\n' +
      '{"scores":[{"criterionId":"<id>","score":<number>,"evidence":"<exact quote>","feedback":"<one sentence>"}]}\n\n' +
      'Submission:\n' + text;
  }

  function buildAppealPrompt(rubric, criterion, submissionText, oldScore, appealText) {
    return 'You are a strict, fair grader reviewing an appeal on ONE criterion only.\n' +
      'Criterion: ' + criterion.name + ' (max ' + criterion.maxPoints + ' points). Full marks means: ' + criterion.descriptor + '\n' +
      'Original score: ' + oldScore + '/' + criterion.maxPoints + '.\n' +
      'Student appeal: ' + appealText + '\n\n' +
      'Decide a new score from 0 to ' + criterion.maxPoints + '. Change the score only if the appeal points at real evidence in the submission. ' +
      'Quote ONE line from the submission as evidence for the new score — copied exactly, never invented. ' +
      'Reply with JSON only: {"score":<number>,"evidence":"<exact quote>","reason":"<one or two sentences>"}.\n\n' +
      'Submission:\n' + submissionText;
  }

  function exportMarkdown(submission, grade, rubric, appeals) {
    var lines = [];
    lines.push('# Grade sheet — ' + (submission.assignment || 'Assignment'));
    lines.push('');
    lines.push('Student: ' + (submission.studentName || 'Unnamed'));
    lines.push('Rubric: ' + rubric.name + ' | Overall: ' + grade.percent + '% (' + grade.band + ') | ' +
      grade.overallPoints + '/' + grade.overallMax + ' points');
    lines.push('Graded: ' + (grade.gradedAt || '') + ' | Source: ' + (grade.sourceLabel || grade.source || ''));
    lines.push('');
    grade.criterionScores.forEach(function (s) {
      var crit = null;
      rubric.criteria.forEach(function (c) { if (c.id === s.criterionId) crit = c; });
      if (!crit) return;
      lines.push('## ' + crit.name + ' — ' + s.score + '/' + crit.maxPoints);
      lines.push('');
      lines.push('> ' + s.evidence);
      lines.push('');
      lines.push(s.feedback);
      lines.push('');
    });
    if (appeals && appeals.length) {
      lines.push('## Appeal trail');
      lines.push('');
      appeals.forEach(function (a) {
        var crit = null;
        rubric.criteria.forEach(function (c) { if (c.id === a.criterionId) crit = c; });
        lines.push('- ' + (crit ? crit.name : a.criterionId) + ': ' + a.oldScore + ' → ' + a.newScore +
          ' (' + a.status + '). ' + a.reason);
        lines.push('  Appeal: "' + a.text + '"');
      });
      lines.push('');
    }
    lines.push('Scores are model judgements, not ground truth. Evidence quotes are lines from the submission.');
    return lines.join('\n');
  }

  return {
    normalize: normalize,
    validateWeights: validateWeights,
    bandFor: bandFor,
    weightedPercent: weightedPercent,
    overallMax: overallMax,
    validateGradeOutput: validateGradeOutput,
    parseGradeJson: parseGradeJson,
    localAppealReview: localAppealReview,
    staticPythonChecks: staticPythonChecks,
    buildGeminiPrompt: buildGeminiPrompt,
    buildAppealPrompt: buildAppealPrompt,
    exportMarkdown: exportMarkdown
  };
});
