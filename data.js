/* Auto-grader agent — built-in rubrics and seeded submissions.
   Seeded grades are recorded with the seed data and labelled "Seeded grade"
   in the UI. They were not produced by a live model call in this demo. */
window.SEED = (function () {
  'use strict';

  var RUBRICS = [
    {
      id: 'essay',
      name: 'Essay — argumentative',
      kind: 'essay',
      builtin: true,
      criteria: [
        { id: 'thesis', name: 'Thesis', weight: 25, maxPoints: 10, descriptor: 'A clear position, stated early, that the rest of the essay actually defends.' },
        { id: 'evidence', name: 'Evidence', weight: 30, maxPoints: 10, descriptor: 'Specific facts, figures, or named sources that support each claim — not just assertions.' },
        { id: 'structure', name: 'Structure', weight: 25, maxPoints: 10, descriptor: 'Paragraphs in a logical order, counter-arguments addressed, conclusion follows from the argument.' },
        { id: 'language', name: 'Language', weight: 20, maxPoints: 10, descriptor: 'Clear sentences, correct grammar, precise words, no filler.' }
      ]
    },
    {
      id: 'code',
      name: 'Code — function assignment',
      kind: 'code',
      builtin: true,
      criteria: [
        { id: 'correctness', name: 'Correctness', weight: 40, maxPoints: 10, descriptor: 'The function returns the right answer for normal, edge, and empty inputs.' },
        { id: 'readability', name: 'Readability', weight: 25, maxPoints: 10, descriptor: 'Clear names, a docstring, short functions, no leftover debug code.' },
        { id: 'efficiency', name: 'Efficiency', weight: 20, maxPoints: 10, descriptor: 'No wasted work: sensible loops, no repeated computation that grows with input size.' },
        { id: 'tests', name: 'Hidden tests', weight: 15, maxPoints: 10, descriptor: 'Passes the hidden test suite. This score comes from running the tests, not from judgement.' }
      ]
    }
  ];

  var ESSAY_AVG = 'School should start later because teenagers need more sleep. Most students are tired in the morning and cannot concentrate in their first lessons.\n\n' +
    'Research shows that teenagers need about nine hours of sleep. Many students get far less because homework and phones keep them up late.\n\n' +
    "Some people say starting later would clash with parents' work and after-school sports. That is a fair point, but health should come first.\n\n" +
    'In conclusion, later start times would help students learn better and feel better. Schools should try it for one term and see what happens.';

  var ESSAY_STRONG = "Should schools start later? The evidence says yes, and the case is stronger than most people think.\n\n" +
    "Teenagers' body clocks shift during puberty, so a 7 a.m. start asks them to learn at a time their brains treat as the middle of the night. The American Academy of Pediatrics recommends start times of 8:30 a.m. or later for exactly this reason.\n\n" +
    'The results show up in the numbers. When Seattle moved high-school starts from 7:50 to 8:45 a.m., students gained an average of 34 minutes of sleep a night, and first-period grades improved. A 2017 study in Science Advances reported the same pattern across two districts.\n\n' +
    "Critics argue that later starts clash with bus schedules, parents' work, and after-school sport. Those are real costs, and any change has to be planned with transport and employers, not announced overnight.\n\n" +
    'But the costs of the current system are larger and quieter: tired students, worse grades, and more car crashes on the morning drive. A later start is a small change with measured benefits, and schools should make it.';

  var ESSAY_WEAK = 'Homework should be banned because it is boring and takes up all my free time. Students already spend the whole day at school and they should be able to relax when they get home.\n\n' +
    'Homework is bad for health. It makes students stressed and tired and they cannot sleep properly. Everyone knows this is true.\n\n' +
    'Some teachers say homework helps you learn but I do not think it does. You can learn everything in class if the teacher explains it well.\n\n' +
    'In conclusion homework should be banned right now. Students would be happier and school would be better for everyone.';

  var CODE_PY = 'def fizzbuzz(n):\n' +
    '    out = []\n' +
    '    for i in range(1, n):\n' +
    '        if i % 15 == 0:\n' +
    '            out.append("FizzBuzz")\n' +
    '        elif i % 3 == 0:\n' +
    '            out.append("Fizz")\n' +
    '        elif i % 5 == 0:\n' +
    '            out.append("Buzz")\n' +
    '        else:\n' +
    '            out.append(str(i))\n' +
    '    return out';

  var CODE_JS = 'function sumEven(arr) {\n' +
    '  let total = 0;\n' +
    '  for (const n of arr) {\n' +
    '    if (n > 0 && n % 2 === 0) {\n' +
    '      total += n;\n' +
    '    }\n' +
    '  }\n' +
    '  return total;\n' +
    '}';

  var SUBMISSIONS = [
    {
      id: 'seed-essay-avg', studentName: 'Maya R.', assignment: 'Should schools start later?',
      kind: 'essay', rubricId: 'essay', language: null, text: ESSAY_AVG,
      createdAt: '2026-11-20', status: 'graded', seeded: true,
      grade: {
        source: 'seeded', sourceLabel: 'Seeded grade — recorded with the demo data',
        gradedAt: '2026-11-20', percent: 72.5, band: 'C', overallPoints: 7.3, overallMax: 10,
        criterionScores: [
          { criterionId: 'thesis', score: 8, maxPoints: 10, evidence: 'School should start later because teenagers need more sleep.', feedback: 'Clear position in the first sentence; it could say what "later" means in practice.' },
          { criterionId: 'evidence', score: 7, maxPoints: 10, evidence: 'Research shows that teenagers need about nine hours of sleep.', feedback: 'States a fact but names no source — "research shows" needs a study, a place, or a number.' },
          { criterionId: 'structure', score: 7, maxPoints: 10, evidence: 'In conclusion, later start times would help students learn better and feel better.', feedback: 'Four paragraphs in a sensible order, but the counter-argument gets one sentence and no answer.' },
          { criterionId: 'language', score: 7, maxPoints: 10, evidence: 'Most students are tired in the morning and cannot concentrate in their first lessons.', feedback: 'Plain and readable; a few sentences repeat the same idea in different words.' }
        ]
      },
      testRun: null
    },
    {
      id: 'seed-essay-strong', studentName: 'Arjun K.', assignment: 'Should schools start later?',
      kind: 'essay', rubricId: 'essay', language: null, text: ESSAY_STRONG,
      createdAt: '2026-11-20', status: 'graded', seeded: true,
      grade: {
        source: 'seeded', sourceLabel: 'Seeded grade — recorded with the demo data',
        gradedAt: '2026-11-20', percent: 87.5, band: 'B', overallPoints: 8.8, overallMax: 10,
        criterionScores: [
          { criterionId: 'thesis', score: 9, maxPoints: 10, evidence: 'Should schools start later? The evidence says yes, and the case is stronger than most people think.', feedback: 'Position and confidence are set in the first line; the essay then has to earn it, and mostly does.' },
          { criterionId: 'evidence', score: 9, maxPoints: 10, evidence: 'When Seattle moved high-school starts from 7:50 to 8:45 a.m., students gained an average of 34 minutes of sleep a night, and first-period grades improved.', feedback: 'Named place, named numbers, second study cited — the strongest evidence in this set.' },
          { criterionId: 'structure', score: 8, maxPoints: 10, evidence: 'But the costs of the current system are larger and quieter: tired students, worse grades, and more car crashes on the morning drive.', feedback: 'Counter-argument is faced directly; the conclusion is short and follows from the argument.' },
          { criterionId: 'language', score: 9, maxPoints: 10, evidence: "Teenagers' body clocks shift during puberty, so a 7 a.m. start asks them to learn at a time their brains treat as the middle of the night.", feedback: 'Concrete image, no filler, varied sentence length.' }
        ]
      },
      testRun: null
    },
    {
      id: 'seed-essay-weak', studentName: 'Priya S.', assignment: 'Should homework be banned?',
      kind: 'essay', rubricId: 'essay', language: null, text: ESSAY_WEAK,
      createdAt: '2026-11-20', status: 'graded', seeded: true,
      grade: {
        source: 'seeded', sourceLabel: 'Seeded grade — recorded with the demo data',
        gradedAt: '2026-11-20', percent: 49, band: 'F', overallPoints: 4.9, overallMax: 10,
        criterionScores: [
          { criterionId: 'thesis', score: 5, maxPoints: 10, evidence: 'Homework should be banned because it is boring and takes up all my free time.', feedback: 'A position is stated, but "boring" is a feeling, not a reason a reader can weigh.' },
          { criterionId: 'evidence', score: 4, maxPoints: 10, evidence: 'Everyone knows this is true.', feedback: '"Everyone knows" is not evidence. No study, number, or example anywhere in the essay.' },
          { criterionId: 'structure', score: 5, maxPoints: 10, evidence: 'In conclusion homework should be banned right now.', feedback: 'The conclusion repeats the opening instead of following from an argument that was built.' },
          { criterionId: 'language', score: 6, maxPoints: 10, evidence: 'Students already spend the whole day at school and they should be able to relax when they get home.', feedback: 'Readable, but short flat sentences and repeated words ("boring", "better") throughout.' }
        ]
      },
      testRun: null
    },
    {
      id: 'seed-code-py', studentName: 'Dev P.', assignment: 'FizzBuzz — return the list to n',
      kind: 'code', rubricId: 'code', language: 'python', text: CODE_PY,
      createdAt: '2026-11-21', status: 'graded', seeded: true,
      grade: {
        source: 'seeded', sourceLabel: 'Seeded grade — recorded with the demo data',
        gradedAt: '2026-11-21', percent: 71, band: 'C', overallPoints: 7.1, overallMax: 10,
        criterionScores: [
          { criterionId: 'correctness', score: 7, maxPoints: 10, evidence: 'for i in range(1, n):', feedback: 'range(1, n) stops one short — fizzbuzz(15) never returns "FizzBuzz" as its last item.' },
          { criterionId: 'readability', score: 6, maxPoints: 10, evidence: 'def fizzbuzz(n):', feedback: 'No docstring and no type hints; the logic itself is easy to follow.' },
          { criterionId: 'efficiency', score: 8, maxPoints: 10, evidence: 'out.append(str(i))', feedback: 'Single pass, linear time, nothing wasted.' },
          { criterionId: 'tests', score: 8, maxPoints: 10, evidence: 'out.append("FizzBuzz")', feedback: 'Hidden tests: 4 of 5 passed (measured). The failing test is fizzbuzz(15) — the last item is missing.' }
        ]
      },
      testRun: {
        language: 'python', passed: 4, failed: 1, ranAt: '2026-11-21',
        note: 'Seeded result — recorded when this code was checked. Python is not executed in the browser demo.',
        results: [
          { name: 'fizzbuzz(3) returns ["1","2","Fizz"]', passed: true, detail: 'Passed.' },
          { name: 'fizzbuzz(5) ends with "Buzz"', passed: true, detail: 'Passed.' },
          { name: '"Fizz" appears in fizzbuzz(6)', passed: true, detail: 'Passed.' },
          { name: 'fizzbuzz(15) ends with "FizzBuzz"', passed: false, detail: 'Failed — last item is "Buzz", not "FizzBuzz". range(1, n) excludes n.' },
          { name: 'len(fizzbuzz(5)) is 5', passed: true, detail: 'Passed.' }
        ]
      }
    },
    {
      id: 'seed-code-js', studentName: 'Anaya M.', assignment: 'sumEven — add up the even numbers',
      kind: 'code', rubricId: 'code', language: 'javascript', text: CODE_JS,
      createdAt: '2026-11-21', status: 'graded', seeded: true,
      grade: {
        source: 'seeded', sourceLabel: 'Seeded grade — recorded with the demo data',
        gradedAt: '2026-11-21', percent: 72.5, band: 'C', overallPoints: 7.3, overallMax: 10,
        criterionScores: [
          { criterionId: 'correctness', score: 6, maxPoints: 10, evidence: 'if (n > 0 && n % 2 === 0) {', feedback: 'Negative even numbers are skipped — sumEven([-2, 3]) returns 0 instead of -2.' },
          { criterionId: 'readability', score: 8, maxPoints: 10, evidence: 'for (const n of arr) {', feedback: 'Clear names and a simple loop; a short comment on the rule would help.' },
          { criterionId: 'efficiency', score: 9, maxPoints: 10, evidence: 'let total = 0;', feedback: 'Single pass, constant extra memory.' },
          { criterionId: 'tests', score: 7, maxPoints: 10, evidence: 'return total;', feedback: 'Hidden tests: 3 of 4 passed (measured). The failing test is the negative-number case.' }
        ]
      },
      testRun: {
        language: 'javascript', passed: 3, failed: 1, ranAt: '2026-11-21',
        note: 'Seeded result — recorded when this code was checked. Run the tests live below to re-check.',
        results: [
          { name: 'sumEven([1,2,3,4]) is 6', passed: true, detail: 'Passed.' },
          { name: 'sumEven([]) is 0', passed: true, detail: 'Passed.' },
          { name: 'sumEven([2,4]) is 6', passed: true, detail: 'Passed.' },
          { name: 'sumEven([-2,3]) is -2', passed: false, detail: 'Failed — returned 0. The n > 0 check drops negative evens.' }
        ]
      }
    }
  ];

  /* Hidden tests for live JavaScript runs. Each test is a JS expression
     evaluated after the submitted code, in a Web Worker. */
  var JS_TESTS = {
    'sumEven': [
      { name: 'sumEven([1,2,3,4]) is 6', run: 'sumEven([1,2,3,4]) === 6' },
      { name: 'sumEven([]) is 0', run: 'sumEven([]) === 0' },
      { name: 'sumEven([2,4]) is 6', run: 'sumEven([2,4]) === 6' },
      { name: 'sumEven([-2,3]) is -2', run: 'sumEven([-2,3]) === -2' }
    ]
  };

  return { RUBRICS: RUBRICS, SUBMISSIONS: SUBMISSIONS, JS_TESTS: JS_TESTS };
})();
