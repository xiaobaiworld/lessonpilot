const assert = require('node:assert/strict');
const test = require('node:test');

const registry = require('../teacher-web/node-plugin-registry.js');

test('registers exactly the four current teacher node plugins', () => {
  assert.deepEqual(registry.listPlugins().map((plugin) => plugin.id), [
    'attention',
    'choice',
    'blank',
    'qa'
  ]);
  for (const plugin of registry.listPlugins()) {
    assert.equal(typeof plugin.label, 'string');
    assert.equal(typeof plugin.createDefault, 'function');
    assert.ok(Array.isArray(plugin.fields));
  }
});

test('click and drag placements create the same canonical node', () => {
  const placement = {
    timeSeconds: 35.24,
    captionId: 'caption-3',
    idFactory: () => 'node-fixed'
  };

  assert.deepEqual(
    registry.createNode('choice', placement),
    registry.createNode('choice', placement)
  );
});

test('creates valid defaults for all four backend node combinations', () => {
  const expected = {
    attention: ['attention', 'notice'],
    choice: ['practice', 'choice'],
    blank: ['practice', 'blank'],
    qa: ['followup', 'free_text']
  };

  for (const [pluginId, [family, interaction]] of Object.entries(expected)) {
    const node = registry.createNode(pluginId, {
      timeSeconds: 12,
      captionId: 'caption-1',
      idFactory: () => `node-${pluginId}`
    });
    assert.equal(node.family, family);
    assert.equal(node.interaction, interaction);
    assert.equal(node.trigger.timeSeconds, 12);
    assert.equal(node.trigger.captionId, 'caption-1');
    assert.equal(node.effects.pause, true);
  }
});

test('rejects unknown plugins and invalid placements', () => {
  assert.throws(
    () => registry.createNode('unknown', { timeSeconds: 1 }),
    /未知节点组件/
  );
  assert.throws(
    () => registry.createNode('attention', { timeSeconds: -1 }),
    /触发时间/
  );
  assert.throws(
    () => registry.createNode('attention', { timeSeconds: Infinity }),
    /触发时间/
  );
});

test('changing plugin type creates only the target type fields', () => {
  const node = registry.createNode('choice', {
    timeSeconds: 5,
    captionId: null,
    idFactory: () => 'node-choice'
  });
  const converted = registry.convertNode('blank', node, {
    timeSeconds: 8,
    captionId: 'caption-2',
    idFactory: () => 'node-blank'
  });

  assert.equal(converted.id, 'node-blank');
  assert.equal(converted.interaction, 'blank');
  assert.equal(converted.trigger.timeSeconds, 8);
  assert.equal(converted.trigger.captionId, 'caption-2');
  assert.equal('options' in converted.display, false);
  assert.equal('answer' in converted.evaluation, false);
  assert.deepEqual(converted.evaluation.normalize, ['trim', 'casefold']);
});
