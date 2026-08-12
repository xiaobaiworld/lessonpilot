/**
 * Unit checks for the student web runtime decision rules.
 * Run: node tests/student-web-runtime.test.js
 */

const nodes = [
  { id: 'specific-example', timeSeconds: 4, answer: 'b' },
  { id: 'fill-structure', timeSeconds: 8, answer: 'result' }
];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function evaluate(node, response) {
  return normalize(response) === normalize(node.answer);
}

function getAnswer(session, nodeId) {
  return session.answers.find((answer) => answer.nodeId === nodeId);
}

function getNextTrigger(session, currentTime) {
  return nodes.find((node) => currentTime >= node.timeSeconds && !getAnswer(session, node.id));
}

function recordAnswer(session, node, response, status = 'answered') {
  const previous = getAnswer(session, node.id);
  const correct = status === 'answered' ? evaluate(node, response) : false;
  session.answers = session.answers.filter((answer) => answer.nodeId !== node.id);
  session.answers.push({
    nodeId: node.id,
    status,
    response,
    correct,
    attempts: (previous?.attempts || 0) + 1
  });
  return session;
}

const checks = [
  {
    label: 'does not trigger before first node',
    run: () => getNextTrigger({ answers: [] }, 3.9) === undefined
  },
  {
    label: 'triggers first unfinished node at threshold',
    run: () => getNextTrigger({ answers: [] }, 4)?.id === 'specific-example'
  },
  {
    label: 'skips completed node and triggers next unfinished node',
    run: () => {
      const session = { answers: [{ nodeId: 'specific-example' }] };
      return getNextTrigger(session, 8)?.id === 'fill-structure';
    }
  },
  {
    label: 'normalizes fill blank answer',
    run: () => evaluate(nodes[1], ' Result ') === true
  },
  {
    label: 'increments attempts on retry',
    run: () => {
      const session = { answers: [] };
      recordAnswer(session, nodes[0], 'a');
      recordAnswer(session, nodes[0], 'b');
      const answer = getAnswer(session, nodes[0].id);
      return answer.attempts === 2 && answer.correct === true;
    }
  }
];

let failed = 0;
checks.forEach((check) => {
  if (check.run()) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${check.label}`);
  }
});

if (failed > 0) {
  process.exit(1);
}

console.log('All student-web runtime checks passed.');
