/* Auto-grader agent — UI. No key in this demo environment? Nothing live is
   graded, and the UI says so. Seeded grades are labelled "Seeded grade". */
(function () {
  'use strict';
  var L = window.GraderLogic;
  var LS_KEY = 'autograder-v1';
  var GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  var ui = { view: 'grade', selectedId: null, appealCriterion: null, appealFilter: 'all', detailId: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var st = JSON.parse(raw);
        if (st && Array.isArray(st.submissions)) return st;
      }
    } catch (e) { /* corrupted state: reseed */ }
    return freshState();
  }

  function freshState() {
    return {
      submissions: JSON.parse(JSON.stringify(window.SEED.SUBMISSIONS)),
      appeals: [],
      customRubrics: [],
      apiKey: '',
      model: 'gemini-2.5-flash'
    };
  }

  var state = loadState();
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  function rubrics() { return window.SEED.RUBRICS.concat(state.customRubrics); }
  function rubricById(id) {
    var found = null;
    rubrics().forEach(function (r) { if (r.id === id) found = r; });
    return found;
  }
  function submissionById(id) {
    var found = null;
    state.submissions.forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }
  function appealsFor(subId) {
    return state.appeals.filter(function (a) { return a.submissionId === subId; });
  }
  function hasAppeal(subId, criterionId) {
    return state.appeals.some(function (a) { return a.submissionId === subId && a.criterionId === criterionId && a.status !== 'pending'; });
  }

  function gradeTag(grade) {
    if (!grade) return '';
    if (grade.source === 'live') return '<span class="tag live">Live grade · Gemini ' + esc(grade.model || '') + '</span>';
    if (grade.source === 'seeded') return '<span class="tag seed">Seeded grade</span>';
    return '<span class="tag local">Local rule check</span>';
  }

  /* ---------- Gemini ---------- */
  function geminiGenerate(prompt, apiKey, model) {
    return fetch(GEMINI_BASE + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Gemini returned HTTP ' + res.status + '. Check the key and try again.');
      return res.json();
    }).then(function (data) {
      var parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      if (!parts || !parts[0] || !parts[0].text) throw new Error('Gemini returned an empty reply.');
      return parts[0].text;
    });
  }

  function computeGrade(rubric, criterionScores) {
    var percent = L.weightedPercent(criterionScores, rubric.criteria);
    var overallMax = L.overallMax(rubric.criteria);
    return {
      percent: percent,
      band: L.bandFor(percent),
      overallPoints: Math.round((percent / 100) * overallMax * 10) / 10,
      overallMax: overallMax
    };
  }

  function gradeLive(sub) {
    var rubric = rubricById(sub.rubricId);
    var status = document.getElementById('gradeStatus');
    var btn = document.getElementById('gradeBtn');
    if (status) status.textContent = 'Scoring ' + rubric.criteria.length + ' criteria with Gemini ' + state.model + '…';
    if (btn) btn.disabled = true;
    var prompt = L.buildGeminiPrompt(rubric, sub.kind, sub.text);
    var attempt = 0;
    function tryOnce() {
      attempt++;
      return geminiGenerate(prompt, state.apiKey, state.model)
        .then(function (text) { return L.parseGradeJson(text, rubric, sub.text); })
        .catch(function (err) {
          if (attempt < 2) {
            if (status) status.textContent = 'First reply failed the checks (' + err.message + ') — retrying once…';
            return tryOnce();
          }
          throw err;
        });
    }
    return tryOnce().then(function (parsed) {
      var scores = parsed.scores.map(function (s) {
        var crit = null;
        rubric.criteria.forEach(function (c) { if (c.id === s.criterionId) crit = c; });
        return { criterionId: s.criterionId, score: Number(s.score), maxPoints: crit.maxPoints, evidence: s.evidence, feedback: s.feedback };
      });
      var comp = computeGrade(rubric, scores);
      sub.grade = {
        source: 'live', sourceLabel: 'Live grade · Gemini ' + state.model, model: state.model,
        gradedAt: new Date().toISOString().slice(0, 10),
        percent: comp.percent, band: comp.band, overallPoints: comp.overallPoints, overallMax: comp.overallMax,
        criterionScores: scores
      };
      sub.status = 'graded';
      save();
      ui.selectedId = sub.id;
      render();
    }).catch(function (err) {
      if (status) status.textContent = '';
      showError('Live grading failed: ' + err.message + ' Nothing was saved as a grade.');
      if (btn) btn.disabled = false;
    });
  }

  /* ---------- JavaScript hidden-test runner (Web Worker, 2s timeout, no DOM) ---------- */
  function detectFunctionName(code) {
    var m = String(code).match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
    return m ? m[1] : null;
  }

  function runJsTests(sub) {
    var panel = document.getElementById('testPanel');
    if (!panel) return;
    var fnName = detectFunctionName(sub.text);
    var tests = fnName ? window.SEED.JS_TESTS[fnName] : null;
    if (!tests) {
      panel.innerHTML = '<div class="notice info">No hidden tests match this code. ' +
        'Hidden tests exist for sumEven; other functions get static checks only. ' +
        'Add a test set for a new function in data.js to run it here.</div>';
      return;
    }
    panel.innerHTML = '<p class="progress">Running ' + tests.length + ' hidden tests in a Web Worker (2-second timeout, no DOM access)…</p>';
    var workerSrc = 'onmessage = function(e) {\n' +
      '  var out = [];\n' +
      '  try { eval(e.data.code); } catch (err) { postMessage({ error: "Code failed to load: " + err.message }); return; }\n' +
      '  e.data.tests.forEach(function(t) {\n' +
      '    try { var ok = eval(t.run); out.push({ name: t.name, passed: ok === true, detail: ok === true ? "Passed." : "Failed — expression was not true." }); }\n' +
      '    catch (err) { out.push({ name: t.name, passed: false, detail: "Failed — " + err.message }); }\n' +
      '  });\n' +
      '  postMessage({ results: out });\n' +
      '};';
    var worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' })));
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      worker.terminate();
      panel.innerHTML = '<div class="notice err">The tests timed out after 2 seconds. The code may contain an infinite loop. Nothing was changed.</div>';
    }, 2000);
    worker.onmessage = function (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      if (e.data.error) {
        panel.innerHTML = '<div class="notice err">' + esc(e.data.error) + '</div>';
        return;
      }
      var results = e.data.results;
      var passed = results.filter(function (r) { return r.passed; }).length;
      sub.testRun = {
        language: 'javascript', passed: passed, failed: results.length - passed,
        ranAt: new Date().toISOString().slice(0, 10),
        note: 'Measured live in this browser — Web Worker, 2-second timeout, no DOM access.',
        results: results
      };
      save();
      renderTestPanel(sub);
    };
    worker.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      panel.innerHTML = '<div class="notice err">The test worker failed to start. Try again.</div>';
    };
    worker.postMessage({ code: sub.text, tests: tests });
  }

  function renderTestPanel(sub) {
    var panel = document.getElementById('testPanel');
    if (!panel) return;
    var tr = sub.testRun;
    if (!tr) {
      panel.innerHTML = '';
      return;
    }
    var html = '<h3>Hidden tests — ' + tr.passed + '/' + (tr.passed + tr.failed) + ' passed (measured)</h3>' +
      '<p class="small">' + esc(tr.note || '') + '</p>';
    tr.results.forEach(function (r) {
      html += '<div class="check-line"><span class="mark ' + (r.passed ? 'pass' : 'fail') + '">' + (r.passed ? '✓' : '✗') + '</span>' +
        '<span><strong>' + esc(r.name) + '</strong><br><span class="muted">' + esc(r.detail) + '</span></span></div>';
    });
    panel.innerHTML = html;
  }

  /* ---------- Appeals ---------- */
  function submitAppeal(sub, criterionId, appealText) {
    var rubric = rubricById(sub.rubricId);
    var criterion = null;
    rubric.criteria.forEach(function (c) { if (c.id === criterionId) criterion = c; });
    var current = null;
    sub.grade.criterionScores.forEach(function (s) { if (s.criterionId === criterionId) current = s; });
    if (!current) return;
    var statusEl = document.getElementById('appealStatus');
    function recordAppeal(result) {
      var appeal = {
        id: 'ap-' + Date.now(), submissionId: sub.id, criterionId: criterionId,
        text: appealText, status: result.upheld ? 'upheld' : 'denied',
        oldScore: current.score, newScore: result.newScore, reason: result.reason,
        ruleApplied: result.rule || null, decidedAt: new Date().toISOString().slice(0, 10)
      };
      state.appeals.push(appeal);
      if (result.upheld) {
        current.score = result.newScore;
        var comp = computeGrade(rubric, sub.grade.criterionScores);
        sub.grade.percent = comp.percent;
        sub.grade.band = comp.band;
        sub.grade.overallPoints = comp.overallPoints;
      }
      sub.status = 'appeal-resolved';
      save();
      ui.appealCriterion = null;
      render();
    }
    if (state.apiKey) {
      if (statusEl) statusEl.textContent = 'Re-grading ' + criterion.name + ' with Gemini ' + state.model + '…';
      var prompt = L.buildAppealPrompt(rubric, criterion, sub.text, current.score, appealText);
      geminiGenerate(prompt, state.apiKey, state.model).then(function (text) {
        var parsed = JSON.parse(text);
        var score = Number(parsed.score);
        if (!isFinite(score) || score < 0 || score > criterion.maxPoints) throw new Error('Re-grade score out of range.');
        var hay = L.normalize(sub.text).toLowerCase();
        if (!parsed.evidence || hay.indexOf(L.normalize(parsed.evidence).toLowerCase()) === -1) {
          throw new Error('Re-grade evidence quote is not a line from the submission.');
        }
        recordAppeal({ upheld: score !== current.score, newScore: score, reason: parsed.reason || 'Re-graded with the appeal attached.', rule: null });
      }).catch(function (err) {
        state.appeals.push({
          id: 'ap-' + Date.now(), submissionId: sub.id, criterionId: criterionId,
          text: appealText, status: 'pending', oldScore: current.score, newScore: current.score,
          reason: 'Live re-grade failed: ' + err.message, ruleApplied: null,
          decidedAt: new Date().toISOString().slice(0, 10)
        });
        sub.status = 'appeal-pending';
        save();
        ui.appealCriterion = null;
        render();
      });
    } else {
      var result = L.localAppealReview({
        appealText: appealText, submissionText: sub.text,
        oldEvidence: current.evidence, oldScore: current.score, maxPoints: criterion.maxPoints
      });
      recordAppeal(result);
    }
  }

  function retryAppeal(appealId) {
    var appeal = null;
    state.appeals.forEach(function (a) { if (a.id === appealId) appeal = a; });
    if (!appeal) return;
    state.appeals = state.appeals.filter(function (a) { return a.id !== appealId; });
    var sub = submissionById(appeal.submissionId);
    ui.selectedId = sub.id;
    ui.appealCriterion = appeal.criterionId;
    save();
    render();
    var ta = document.getElementById('appealText');
    if (ta) { ta.value = appeal.text; ta.focus(); }
  }

  /* ---------- Rendering ---------- */
  var viewEl = document.getElementById('view');
  var keyPill = document.getElementById('keyPill');

  function updateKeyPill() {
    if (state.apiKey) {
      keyPill.textContent = 'Key saved · ' + state.model;
      keyPill.classList.add('on');
    } else {
      keyPill.textContent = 'No API key saved';
      keyPill.classList.remove('on');
    }
  }

  function showError(msg) {
    var box = document.getElementById('errorBox');
    if (box) {
      box.classList.remove('hidden');
      box.textContent = msg;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert(msg);
    }
  }

  function criterionRows(sub, rubric) {
    var html = '';
    var appeals = appealsFor(sub.id);
    sub.grade.criterionScores.forEach(function (s) {
      var crit = null;
      rubric.criteria.forEach(function (c) { if (c.id === s.criterionId) crit = c; });
      if (!crit) return;
      var pct = Math.round((s.score / crit.maxPoints) * 100);
      var cls = pct >= 80 ? '' : (pct >= 60 ? 'mid' : 'low');
      var trail = appeals.filter(function (a) { return a.criterionId === s.criterionId; });
      var appealed = hasAppeal(sub.id, s.criterionId);
      html += '<div class="crit-row"><div class="crit-top"><span class="crit-name">' + esc(crit.name) +
        ' <span class="small">· weight ' + crit.weight + '%</span></span>' +
        '<span class="crit-score">' +
        (trail.length ? '<span class="old">' + trail[trail.length - 1].oldScore + '</span>' : '') +
        s.score + ' / ' + crit.maxPoints + '</span></div>' +
        '<div class="bar"><span class="' + cls + '" style="width:' + pct + '%"></span></div>' +
        '<p class="small">' + esc(crit.descriptor) + '</p>' +
        '<blockquote class="evidence">“' + esc(s.evidence) + '”</blockquote>' +
        '<p class="feedback">' + esc(s.feedback) + '</p>';
      trail.forEach(function (a) {
        html += '<div class="appeal-note' + (a.status === 'upheld' ? '' : ' denied') + '">' +
          '<span class="lbl">Appeal ' + a.status + ' — ' + a.oldScore + ' → ' + a.newScore + '</span><br>' +
          esc(a.reason) +
          (a.ruleApplied ? '<br><span class="small">Rule applied: ' + esc(a.ruleApplied) + ' (local appeal reviewer — no key saved).</span>' : '') +
          '<br><span class="small">Decided ' + esc(a.decidedAt) + '</span></div>';
      });
      if (!appealed) {
        html += '<div class="btnrow"><button class="btn secondary small" data-appeal="' + crit.id + '">Appeal this criterion</button></div>';
      } else {
        html += '<p class="small" style="margin-top:10px">This criterion has already been appealed once.</p>';
      }
      html += '</div>';
    });
    return html;
  }

  function gradeSheetHtml(sub) {
    var rubric = rubricById(sub.rubricId);
    if (!sub.grade) {
      return '<div class="notice info">Not graded yet. ' +
        (state.apiKey ? 'Click “Grade this submission” to grade it live.' : 'No API key saved — live grading needs a free Gemini key in Settings. Seeded submissions below already have grades.') +
        '</div>';
    }
    var g = sub.grade;
    return '<div class="sheet"><div class="sheet-head">' +
      '<span class="grade-big">' + g.percent + '%</span>' +
      '<span class="band">' + esc(g.band) + '</span>' +
      '<span class="meta"><strong>' + esc(sub.studentName || 'Unnamed') + '</strong> · ' + esc(sub.assignment || 'Assignment') + '<br>' +
      g.overallPoints + ' / ' + g.overallMax + ' points · ' + esc(rubric.name) + '<br>' + esc(g.sourceLabel || '') +
      (g.gradedAt ? ' · graded ' + esc(g.gradedAt) : '') + '</span></div>' +
      criterionRows(sub, rubric) + '</div>';
  }

  function appealFormHtml(sub) {
    var rubric = rubricById(sub.rubricId);
    var crit = null;
    rubric.criteria.forEach(function (c) { if (c.id === ui.appealCriterion) crit = c; });
    if (!crit) return '';
    var hint = state.apiKey
      ? 'The criterion will be re-graded by Gemini ' + state.model + ' with your appeal attached.'
      : 'No API key saved, so this appeal is decided by the local appeal reviewer. It raises the score by 1 point only when your appeal quotes a line from the work that the original grade did not cite. The rule applied is shown in the outcome.';
    return '<div class="card" id="appealCard"><h2>Appeal — ' + esc(crit.name) + '</h2>' +
      '<p class="small">' + hint + ' Only the disputed criterion is re-graded; every other score stays as it is.</p>' +
      '<label for="appealText">Your appeal (at least 20 characters — quote the line you mean)</label>' +
      '<textarea id="appealText" class="plain" placeholder="e.g. The essay does give evidence for the claim: &quot;Many students get far less because homework and phones keep them up late.&quot; That line names a cause, not just a claim."></textarea>' +
      '<div class="btnrow"><button class="btn" id="submitAppealBtn">Submit appeal</button>' +
      '<button class="btn ghost" id="cancelAppealBtn">Cancel</button></div>' +
      '<p class="progress" id="appealStatus"></p></div>';
  }

  function renderGradeView() {
    var keyNotice = state.apiKey ? '' :
      '<div class="notice"><strong>No API key saved.</strong> Live grading needs a free Gemini API key — ' +
      'paste one in <strong>Settings</strong> (it stays in this browser only). Until then, nothing here is graded live: ' +
      'open a seeded submission below to see a recorded grade, and try the appeal flow on it.</div>';
    var seedHtml = state.submissions.map(function (s) {
      var pct = s.grade ? s.grade.percent + '% (' + s.grade.band + ')' : 'not graded';
      return '<div class="seed-item"><div><div class="t">' + esc(s.studentName || 'Unnamed') + ' — ' + esc(s.assignment || 'Assignment') + '</div>' +
        '<div class="s">' + (s.kind === 'code' ? 'Code · ' + esc(s.language || '') : 'Essay') + ' · ' + esc(pct) +
        (s.status === 'appeal-resolved' ? ' · appeal decided' : '') + '</div></div>' +
        '<button class="btn secondary small" data-open="' + s.id + '">Open grade sheet</button></div>';
    }).join('');

    var selected = ui.selectedId ? submissionById(ui.selectedId) : null;
    var detailHtml = '';
    if (selected) {
      detailHtml = '<div class="card"><div class="btnrow" style="margin:0 0 12px"><strong style="font-size:17px;color:var(--ink)">Grade sheet</strong>' +
        '<span style="flex:1"></span><button class="btn secondary small" id="exportBtn">Export as Markdown</button>' +
        '<button class="btn ghost small" id="closeSheetBtn">Close</button></div>' +
        '<div id="errorBox" class="notice err hidden"></div>' +
        gradeSheetHtml(selected) +
        (selected.grade ? appealFormHtml(selected) : '') +
        (selected.kind === 'code' ? codePanelHtml(selected) : '') +
        '</div>';
    }

    viewEl.innerHTML =
      '<h1>Grade work, show the evidence.</h1>' +
      '<p class="lede">Paste an essay or a code file, pick a rubric, and get a score for every criterion — ' +
      'each one backed by a quoted line from the work itself. If a score is wrong, the student appeals that ' +
      'one criterion and the change is written into the grade.</p>' +
      keyNotice +
      '<div class="grid-2"><div class="card"><h2>New submission</h2>' +
      '<div id="errorBox" class="notice err hidden"></div>' +
      '<label for="fStudent">Student name (optional)</label><input type="text" id="fStudent" placeholder="e.g. Maya R.">' +
      '<label for="fAssignment">Assignment (optional)</label><input type="text" id="fAssignment" placeholder="e.g. Should schools start later?">' +
      '<label for="fRubric">Rubric</label><select id="fRubric">' +
      rubrics().map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + ' (' + r.kind + ')</option>'; }).join('') +
      '</select>' +
      '<label for="fLang">Code language (only for code rubrics)</label>' +
      '<select id="fLang"><option value="python">Python — static checks only</option><option value="javascript">JavaScript — hidden tests run in a Worker</option></select>' +
      '<label for="fText">Essay or code</label>' +
      '<textarea id="fText" placeholder="Paste the essay or code here…"></textarea>' +
      '<div class="btnrow"><button class="btn" id="gradeBtn">Grade this submission</button>' +
      '<label class="btn secondary small" style="margin:0;cursor:pointer">Upload a file<input type="file" id="fFile" accept=".txt,.md,.py,.js" class="hidden"></label></div>' +
      '<p class="progress" id="gradeStatus"></p>' +
      '<p class="small">Scores are model judgements, not ground truth. The checker verifies every evidence quote is a real line from the submission before the grade is shown.</p>' +
      '</div>' +
      '<div><div class="card"><h2>Seeded submissions</h2>' +
      '<p class="small">Three essays and two code submissions with grades recorded alongside them, so the demo works with no key. Each is labelled “Seeded grade”.</p>' +
      '<div class="seed-list">' + seedHtml + '</div></div>' +
      '<div class="card"><h2>How the appeal works</h2>' +
      '<p style="font-size:14px">Pick one criterion on any grade sheet, write the appeal, submit. Only that criterion is re-graded. ' +
      'The old score stays visible, struck through, next to the new one — and the reason is written underneath. ' +
      'A criterion can be appealed once.</p></div>' +
      '</div></div>' + detailHtml;

    bindGradeView();
    if (selected) {
      if (selected.kind === 'code') {
        renderTestPanel(selected);
        if (selected.language === 'python') renderStaticChecks(selected);
      }
      var sheet = viewEl.querySelector('.card .sheet');
      if (sheet) sheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function codePanelHtml(sub) {
    var html = '<div class="card" style="margin-top:16px"><h2>Code checks — measured, not judged</h2>';
    if (sub.language === 'python') {
      html += '<p class="small">Python is <strong>not executed</strong> in this browser demo. These are static checks only. ' +
        'A hosted version would run it in a sandboxed container with no network and a read-only filesystem.</p>' +
        '<div id="staticPanel"></div>';
      if (sub.testRun) {
        html += '<h3 style="margin-top:16px">Hidden tests — ' + sub.testRun.passed + '/' + (sub.testRun.passed + sub.testRun.failed) + ' passed (seeded result)</h3>' +
          '<p class="small">' + esc(sub.testRun.note || '') + '</p>';
        sub.testRun.results.forEach(function (r) {
          html += '<div class="check-line"><span class="mark ' + (r.passed ? 'pass' : 'fail') + '">' + (r.passed ? '✓' : '✗') + '</span>' +
            '<span><strong>' + esc(r.name) + '</strong><br><span class="muted">' + esc(r.detail) + '</span></span></div>';
        });
      }
    } else {
      html += '<p class="small">JavaScript runs in a Web Worker with a 2-second timeout and no DOM access. The worker is terminated on timeout.</p>' +
        '<div class="btnrow" style="margin-top:0"><button class="btn secondary" id="runTestsBtn">Run hidden tests</button></div>' +
        '<div id="testPanel" style="margin-top:12px"></div>';
    }
    return html + '</div>';
  }

  function renderStaticChecks(sub) {
    var panel = document.getElementById('staticPanel');
    if (!panel) return;
    var checks = L.staticPythonChecks(sub.text);
    panel.innerHTML = checks.map(function (c) {
      return '<div class="check-line"><span class="mark ' + (c.passed ? 'pass' : 'fail') + '">' + (c.passed ? '✓' : '✗') + '</span>' +
        '<span><strong>' + esc(c.name) + '</strong><br><span class="muted">' + esc(c.detail) + '</span></span></div>';
    }).join('');
  }

  function bindGradeView() {
    var gradeBtn = document.getElementById('gradeBtn');
    if (gradeBtn) gradeBtn.addEventListener('click', function () {
      var text = document.getElementById('fText').value.trim();
      if (text.length < 50) { showError('Paste at least 50 characters — a real essay or a real function.'); return; }
      var rubric = rubricById(document.getElementById('fRubric').value);
      var sub = {
        id: 'sub-' + Date.now(),
        studentName: document.getElementById('fStudent').value.trim(),
        assignment: document.getElementById('fAssignment').value.trim(),
        kind: rubric.kind, rubricId: rubric.id,
        language: rubric.kind === 'code' ? document.getElementById('fLang').value : null,
        text: text, createdAt: new Date().toISOString().slice(0, 10),
        status: 'draft', grade: null, testRun: null
      };
      if (!state.apiKey) {
        state.submissions.unshift(sub);
        save();
        ui.selectedId = sub.id;
        render();
        showError('No API key saved, so this submission was filed but not graded. Paste a free Gemini key in Settings, then open it from Submissions and grade it — or open a seeded submission below, which already has a grade.');
        return;
      }
      state.submissions.unshift(sub);
      save();
      ui.selectedId = sub.id;
      gradeLive(sub);
    });

    var fileInput = document.getElementById('fFile');
    if (fileInput) fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        document.getElementById('fText').value = String(reader.result || '');
        if (/\.py$/i.test(file.name)) document.getElementById('fLang').value = 'python';
        if (/\.js$/i.test(file.name)) document.getElementById('fLang').value = 'javascript';
        if (!document.getElementById('fAssignment').value) document.getElementById('fAssignment').value = file.name;
      };
      reader.readAsText(file);
    });

    viewEl.querySelectorAll('[data-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.selectedId = btn.getAttribute('data-open');
        ui.appealCriterion = null;
        render();
      });
    });

    var closeBtn = document.getElementById('closeSheetBtn');
    if (closeBtn) closeBtn.addEventListener('click', function () { ui.selectedId = null; ui.appealCriterion = null; render(); });

    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var sub = submissionById(ui.selectedId);
      var rubric = rubricById(sub.rubricId);
      var md = L.exportMarkdown(sub, sub.grade, rubric, appealsFor(sub.id));
      var blob = new Blob([md], { type: 'text/markdown' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'grade-sheet-' + sub.id + '.md';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    viewEl.querySelectorAll('[data-appeal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.appealCriterion = btn.getAttribute('data-appeal');
        render();
        var card = document.getElementById('appealCard');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    var submitAppealBtn = document.getElementById('submitAppealBtn');
    if (submitAppealBtn) submitAppealBtn.addEventListener('click', function () {
      var text = document.getElementById('appealText').value.trim();
      if (text.length < 20) { showError('Write at least 20 characters — quote the line from the work you mean.'); return; }
      submitAppeal(submissionById(ui.selectedId), ui.appealCriterion, text);
    });
    var cancelBtn = document.getElementById('cancelAppealBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { ui.appealCriterion = null; render(); });

    var runBtn = document.getElementById('runTestsBtn');
    if (runBtn) runBtn.addEventListener('click', function () { runJsTests(submissionById(ui.selectedId)); });
  }

  function renderSubmissionsView() {
    var graded = state.submissions.filter(function (s) { return s.grade; });
    var avg = graded.length ? Math.round(graded.reduce(function (a, s) { return a + s.grade.percent; }, 0) / graded.length * 10) / 10 : 0;
    var appealed = state.submissions.filter(function (s) { return s.status === 'appeal-resolved' || s.status === 'appeal-pending'; }).length;
    var upheld = state.appeals.filter(function (a) { return a.status === 'upheld'; }).length;

    var rows = state.submissions.map(function (s) {
      var pct = s.grade ? s.grade.percent + '%' : '—';
      return '<tr class="clickable" data-open="' + s.id + '"><td><strong>' + esc(s.studentName || 'Unnamed') + '</strong><br><span class="muted">' + esc(s.assignment || 'Assignment') + '</span></td>' +
        '<td>' + (s.kind === 'code' ? 'Code' : 'Essay') + '</td>' +
        '<td class="num">' + pct + '</td>' +
        '<td>' + esc(s.status.replace('-', ' ')) + '</td>' +
        '<td>' + esc(s.createdAt || '') + '</td></tr>';
    }).join('');

    var detail = '';
    var sel = ui.detailId ? submissionById(ui.detailId) : null;
    if (sel) {
      detail = '<div class="card"><div class="btnrow" style="margin:0 0 12px"><strong style="font-size:17px;color:var(--ink)">' +
        esc(sel.studentName || 'Unnamed') + ' — ' + esc(sel.assignment || 'Assignment') + '</strong>' +
        '<span style="flex:1"></span><button class="btn secondary small" id="exportBtn2">Export as Markdown</button>' +
        '<button class="btn ghost small" id="closeDetailBtn">Close</button></div>' +
        '<pre class="code">' + esc(sel.text) + '</pre>' +
        gradeSheetHtml(sel) +
        (sel.kind === 'code' && sel.testRun ? '<p class="small" style="margin-top:12px">Hidden tests: ' + sel.testRun.passed + '/' + (sel.testRun.passed + sel.testRun.failed) + ' passed (measured). ' + esc(sel.testRun.note || '') + '</p>' : '') +
        '</div>';
    }

    viewEl.innerHTML =
      '<h1>Submissions</h1><p class="lede">Every submission, its grade, and whether an appeal changed it.</p>' +
      '<div class="stat-row">' +
      '<div class="stat"><div class="n">' + state.submissions.length + '</div><div class="l">Submissions</div></div>' +
      '<div class="stat"><div class="n">' + (graded.length ? avg + '%' : '—') + '</div><div class="l">Class average</div></div>' +
      '<div class="stat"><div class="n">' + appealed + '</div><div class="l">Appeals filed</div></div>' +
      '<div class="stat"><div class="n">' + upheld + '</div><div class="l">Appeals upheld</div></div></div>' +
      '<div class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Type</th><th class="num">Score</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></div>' + detail;

    viewEl.querySelectorAll('tr[data-open]').forEach(function (tr) {
      tr.addEventListener('click', function () { ui.detailId = tr.getAttribute('data-open'); render(); });
    });
    var closeBtn = document.getElementById('closeDetailBtn');
    if (closeBtn) closeBtn.addEventListener('click', function () { ui.detailId = null; render(); });
    var exportBtn = document.getElementById('exportBtn2');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var sub = submissionById(ui.detailId);
      var md = L.exportMarkdown(sub, sub.grade, rubricById(sub.rubricId), appealsFor(sub.id));
      var blob = new Blob([md], { type: 'text/markdown' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'grade-sheet-' + sub.id + '.md';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function renderRubricsView() {
    var cards = rubrics().map(function (r) {
      var crits = r.criteria.map(function (c) {
        return '<div class="check-line"><span><strong>' + esc(c.name) + '</strong> — weight ' + c.weight + '%, max ' + c.maxPoints + ' points<br><span class="muted">' + esc(c.descriptor) + '</span></span></div>';
      }).join('');
      return '<div class="card"><h2>' + esc(r.name) + ' ' + (r.builtin ? '<span class="tag">Built in</span>' : '<span class="tag">Custom</span>') + '</h2>' +
        '<p class="small">Kind: ' + r.kind + ' · ' + r.criteria.length + ' criteria · weights sum to ' +
        r.criteria.reduce(function (a, c) { return a + Number(c.weight); }, 0) + '%</p>' + crits +
        (r.builtin ? '' : '<div class="btnrow"><button class="btn secondary small" data-del-rubric="' + r.id + '">Delete rubric</button></div>') +
        '</div>';
    }).join('');

    viewEl.innerHTML =
      '<h1>Rubrics</h1><p class="lede">A rubric is the whole grading contract: criteria, weights, and what full marks means. ' +
      'The model grades against it, and the student appeals against it.</p>' +
      '<div class="grid-2">' + cards + '</div>' +
      '<div class="card"><h2>Build a custom rubric</h2>' +
      '<p class="small">Weights must add up to 100% — saving is blocked until they do.</p>' +
      '<div id="errorBox" class="notice err hidden"></div>' +
      '<label for="rbName">Rubric name</label><input type="text" id="rbName" placeholder="e.g. Lab report — biology">' +
      '<label for="rbKind">Kind</label><select id="rbKind"><option value="essay">Essay / written work</option><option value="code">Code</option></select>' +
      '<div id="rbCriteria"></div>' +
      '<div class="btnrow"><button class="btn secondary" id="rbAddCrit">Add criterion</button>' +
      '<button class="btn" id="rbSave">Save rubric</button></div>' +
      '<p class="progress" id="rbStatus"></p></div>';

    var criteria = [
      { name: '', weight: 50, maxPoints: 10, descriptor: '' },
      { name: '', weight: 50, maxPoints: 10, descriptor: '' }
    ];
    function renderCriteria() {
      var box = document.getElementById('rbCriteria');
      box.innerHTML = criteria.map(function (c, i) {
        return '<div class="rubric-crit"><div class="row">' +
          '<div><label>Criterion name</label><input type="text" data-ci="' + i + '" data-f="name" value="' + esc(c.name) + '" placeholder="e.g. Method"></div>' +
          '<div><label>Weight %</label><input type="text" data-ci="' + i + '" data-f="weight" value="' + esc(c.weight) + '" inputmode="numeric"></div>' +
          '<div><label>Max points</label><input type="text" data-ci="' + i + '" data-f="maxPoints" value="' + esc(c.maxPoints) + '" inputmode="numeric"></div>' +
          '</div><label>What earns full marks</label><input type="text" data-ci="' + i + '" data-f="descriptor" value="' + esc(c.descriptor) + '" placeholder="One line, e.g. Method is described so another student could repeat it."></div>';
      }).join('');
      box.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var c = criteria[Number(inp.getAttribute('data-ci'))];
          var f = inp.getAttribute('data-f');
          c[f] = (f === 'weight' || f === 'maxPoints') ? Number(inp.value) || 0 : inp.value;
          updateRbStatus();
        });
      });
      updateRbStatus();
    }
    function updateRbStatus() {
      var el = document.getElementById('rbStatus');
      if (!el) return;
      var sum = criteria.reduce(function (a, c) { return a + (Number(c.weight) || 0); }, 0);
      el.textContent = 'Weights add up to ' + sum + '%' + (sum === 100 ? ' — ready to save.' : ' — must be 100% to save.');
    }
    renderCriteria();
    document.getElementById('rbAddCrit').addEventListener('click', function () {
      criteria.push({ name: '', weight: 0, maxPoints: 10, descriptor: '' });
      renderCriteria();
    });
    document.getElementById('rbSave').addEventListener('click', function () {
      var name = document.getElementById('rbName').value.trim();
      if (!name) { showError('Give the rubric a name.'); return; }
      if (criteria.some(function (c) { return !c.name.trim() || !c.descriptor.trim(); })) {
        showError('Every criterion needs a name and a one-line description of full marks.'); return;
      }
      if (!L.validateWeights(criteria)) { showError('Weights must add up to 100%.'); return; }
      state.customRubrics.push({
        id: 'rub-' + Date.now(), name: name, kind: document.getElementById('rbKind').value,
        builtin: false,
        criteria: criteria.map(function (c, i) {
          return { id: 'c' + Date.now() + i, name: c.name.trim(), weight: Number(c.weight), maxPoints: Number(c.maxPoints), descriptor: c.descriptor.trim() };
        })
      });
      save();
      render();
    });
    viewEl.querySelectorAll('[data-del-rubric]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.customRubrics = state.customRubrics.filter(function (r) { return r.id !== btn.getAttribute('data-del-rubric'); });
        save();
        render();
      });
    });
  }

  function renderAppealsView() {
    var list = state.appeals.slice().reverse();
    var filtered = ui.appealFilter === 'all' ? list : list.filter(function (a) { return a.status === ui.appealFilter; });
    var rows = filtered.map(function (a) {
      var sub = submissionById(a.submissionId);
      var rubric = sub ? rubricById(sub.rubricId) : null;
      var crit = null;
      if (rubric) rubric.criteria.forEach(function (c) { if (c.id === a.criterionId) crit = c; });
      return '<div class="card"><div class="btnrow" style="margin:0"><strong style="color:var(--ink)">' +
        esc(sub ? (sub.studentName || 'Unnamed') : 'Unknown') + ' — ' + esc(crit ? crit.name : a.criterionId) + '</strong>' +
        '<span class="tag">' + esc(a.status) + '</span><span class="small">' + esc(a.decidedAt || '') + '</span></div>' +
        '<p style="font-size:14px;margin-top:10px">Score: <strong>' + a.oldScore + ' → ' + a.newScore + '</strong><br>' +
        'Appeal: “' + esc(a.text) + '”<br>Outcome: ' + esc(a.reason) +
        (a.ruleApplied ? '<br><span class="small">Rule applied: ' + esc(a.ruleApplied) + ' (local appeal reviewer).</span>' : '') + '</p>' +
        (a.status === 'pending' ? '<div class="btnrow"><button class="btn small" data-retry-appeal="' + a.id + '">Retry re-grade</button></div>' : '') +
        (sub ? '<button class="btn secondary small" data-open-sub="' + sub.id + '">Open grade sheet</button>' : '') +
        '</div>';
    }).join('');

    viewEl.innerHTML =
      '<h1>Appeals</h1><p class="lede">Every appeal, its old and new score, and the written reason. ' +
      'Nothing is decided in a separate inbox — the decision is part of the grade sheet.</p>' +
      '<div class="btnrow" style="margin-bottom:16px">' +
      ['all', 'pending', 'upheld', 'denied'].map(function (f) {
        return '<button class="btn small ' + (ui.appealFilter === f ? '' : 'secondary') + '" data-filter="' + f + '">' + f.charAt(0).toUpperCase() + f.slice(1) + '</button>';
      }).join('') + '</div>' +
      (filtered.length ? rows : '<div class="card"><p>No ' + (ui.appealFilter === 'all' ? '' : ui.appealFilter + ' ') + 'appeals yet. ' +
      'Open a grade sheet and appeal a criterion to see one here.</p></div>');

    viewEl.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () { ui.appealFilter = btn.getAttribute('data-filter'); render(); });
    });
    viewEl.querySelectorAll('[data-retry-appeal]').forEach(function (btn) {
      btn.addEventListener('click', function () { retryAppeal(btn.getAttribute('data-retry-appeal')); });
    });
    viewEl.querySelectorAll('[data-open-sub]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.selectedId = btn.getAttribute('data-open-sub');
        ui.view = 'grade';
        render();
      });
    });
  }

  function renderSettingsView() {
    viewEl.innerHTML =
      '<h1>Settings</h1><p class="lede">Your key, your model, your data.</p>' +
      '<div class="card"><h2>Gemini API key</h2>' +
      '<p style="font-size:14px">Live grading and live appeals call the Gemini API with a free key from ' +
      '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>. ' +
      'The key is stored in this browser only (localStorage) and is sent nowhere except ' +
      '<code>generativelanguage.googleapis.com</code>. Without a key, seeded grades and the local appeal reviewer still work — nothing is faked.</p>' +
      '<div id="errorBox" class="notice err hidden"></div>' +
      '<label for="apiKey">API key</label>' +
      '<input type="text" id="apiKey" placeholder="AIza…" value="' + esc(state.apiKey) + '" autocomplete="off">' +
      '<label for="modelSel">Model</label><select id="modelSel">' +
      '<option value="gemini-2.5-flash"' + (state.model === 'gemini-2.5-flash' ? ' selected' : '') + '>gemini-2.5-flash (free tier, default)</option>' +
      '<option value="gemini-2.5-flash-lite"' + (state.model === 'gemini-2.5-flash-lite' ? ' selected' : '') + '>gemini-2.5-flash-lite (free tier, faster)</option>' +
      '</select>' +
      '<div class="btnrow"><button class="btn" id="saveKeyBtn">Save key</button>' +
      '<button class="btn secondary" id="testKeyBtn">Test key</button>' +
      '<button class="btn secondary" id="removeKeyBtn">Remove key</button></div>' +
      '<p class="progress" id="keyStatus"></p></div>' +
      '<div class="card"><h2>Demo data</h2>' +
      '<p style="font-size:14px">Reset restores the five seeded submissions and clears your own submissions, appeals, and custom rubrics. Your API key is kept.</p>' +
      '<div class="btnrow"><button class="btn secondary" id="resetBtn">Reset demo data</button></div></div>' +
      '<div class="card"><h2>What this demo does not do</h2>' +
      '<p style="font-size:14px">Python code is never executed here — static checks only. JavaScript runs in a Web Worker with a 2-second timeout and no DOM access. ' +
      'Data lives in this browser; clearing browser data clears submissions. Letter bands (A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60) are a demo default, not any institution’s official scale. ' +
      'Scores are model judgements, not ground truth.</p></div>';

    document.getElementById('saveKeyBtn').addEventListener('click', function () {
      var key = document.getElementById('apiKey').value.trim();
      if (!key) { showError('Paste a key first.'); return; }
      state.apiKey = key;
      state.model = document.getElementById('modelSel').value;
      save();
      updateKeyPill();
      document.getElementById('keyStatus').textContent = 'Key saved in this browser only.';
    });
    document.getElementById('testKeyBtn').addEventListener('click', function () {
      var key = document.getElementById('apiKey').value.trim();
      var model = document.getElementById('modelSel').value;
      var statusEl = document.getElementById('keyStatus');
      if (!key) { showError('Paste a key first.'); return; }
      statusEl.textContent = 'Testing key…';
      geminiGenerate('Reply with the single word ok.', key, model).then(function () {
        statusEl.textContent = 'Key works — Gemini ' + model + ' replied.';
      }).catch(function (err) {
        statusEl.textContent = 'Key test failed: ' + err.message;
      });
    });
    document.getElementById('removeKeyBtn').addEventListener('click', function () {
      state.apiKey = '';
      save();
      updateKeyPill();
      render();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      var key = state.apiKey;
      var model = state.model;
      state = freshState();
      state.apiKey = key;
      state.model = model;
      ui.selectedId = null;
      ui.detailId = null;
      save();
      render();
    });
  }

  function render() {
    updateKeyPill();
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === ui.view);
    });
    if (ui.view === 'grade') renderGradeView();
    else if (ui.view === 'submissions') renderSubmissionsView();
    else if (ui.view === 'rubrics') renderRubricsView();
    else if (ui.view === 'appeals') renderAppealsView();
    else renderSettingsView();
  }

  document.querySelectorAll('#nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      ui.view = b.getAttribute('data-view');
      render();
      window.scrollTo(0, 0);
    });
  });

  // Deep link: #<submission-id> opens that submission's grade sheet on load.
  if (window.location.hash) {
    var linked = submissionById(window.location.hash.slice(1));
    if (linked) ui.selectedId = linked.id;
  }

  render();
})();
