const assert = require('node:assert/strict');
const test = require('node:test');

const { createEditorLogger } = require('../teacher-web/editor-logger.js');

test('uses debug threshold for localhost and info threshold for normal origins', () => {
  const local = createEditorLogger({ origin: 'http://127.0.0.1:4173', sink: () => {} });
  const normal = createEditorLogger({ origin: 'https://knownmap.com', sink: () => {} });

  assert.equal(local.level, 'debug');
  assert.equal(normal.level, 'info');
});

test('filters sensitive prose and credentials from diagnostic fields', () => {
  const entries = [];
  const logger = createEditorLogger({
    origin: 'http://localhost:4173',
    sink: (entry) => entries.push(entry)
  });

  logger.debug('node.create', {
    nodeId: 'node-1',
    pluginId: 'choice',
    timeSeconds: 12,
    captionText: 'private subtitle',
    nodeBody: 'private answer',
    password: 'secret',
    accessCode: 'KM-SECRET'
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].nodeId, 'node-1');
  assert.equal(entries[0].pluginId, 'choice');
  assert.equal('captionText' in entries[0], false);
  assert.equal('nodeBody' in entries[0], false);
  assert.equal('password' in entries[0], false);
  assert.equal('accessCode' in entries[0], false);
});

test('default console sink writes each entry exactly once', () => {
  const calls = [];
  const originalConsole = global.console;
  global.console = {
    info: (entry) => calls.push(['info', entry]),
    log: (entry) => calls.push(['log', entry])
  };

  try {
    const logger = createEditorLogger({
      origin: 'https://knownmap.com',
      level: 'info'
    });
    logger.info('node.save', { nodeId: 'node-1' });
  } finally {
    global.console = originalConsole;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'info');
  assert.equal(calls[0][1].action, 'node.save');
});
