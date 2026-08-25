const assert = require('node:assert/strict');
const test = require('node:test');

const registry = require('../teacher-web/node-plugin-registry.js');
const timeline = require('../teacher-web/timeline-model.js');
const { createEditor } = require('../teacher-web/visual-node-editor.js');

const captions = [
  { id: 'caption-1', startSeconds: 0, endSeconds: 18, time: '00:00', text: 'one' },
  { id: 'caption-2', startSeconds: 18, endSeconds: 35, time: '00:18', text: 'two' },
  { id: 'caption-3', startSeconds: 35, endSeconds: 51, time: '00:35', text: 'three' }
];

test('click and drop placement call the same createAtTime action', () => {
  const changes = [];
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: [],
    idFactory: () => 'node-created',
    onChange: (nodes, meta) => changes.push({ nodes, meta })
  });

  editor.armPlugin('choice');
  editor.handleTimelineClick({ left: 100, width: 500, clientX: 350 });
  editor.saveDialog();
  editor.handleDrop('choice', { left: 100, width: 500, clientX: 350 });
  editor.saveDialog();

  assert.equal(changes.length, 2);
  assert.equal(changes[0].meta.action, 'node.create');
  assert.equal(changes[0].meta.source, 'click');
  assert.equal(changes[1].meta.action, 'node.create');
  assert.equal(changes[1].meta.source, 'drag');
  assert.deepEqual(changes[0].nodes[0], changes[1].nodes[0]);
});

test('cancelling a new node dialog does not add the node', () => {
  const changes = [];
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: [],
    idFactory: () => 'node-cancelled',
    onChange: (nodes) => changes.push(nodes)
  });

  editor.createAtTime('attention', 10, 'click');
  assert.equal(editor.getState().dialog.mode, 'create');
  editor.cancelDialog();

  assert.equal(editor.getState().nodes.length, 0);
  assert.equal(changes.length, 0);
});

test('moving and deleting a selected node emit canonical state changes', () => {
  const original = registry.createNode('blank', {
    timeSeconds: 10,
    captionId: 'caption-1',
    idFactory: () => 'node-blank'
  });
  const changes = [];
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: [original],
    onChange: (nodes, meta) => changes.push({ nodes, meta })
  });

  editor.selectNode('node-blank');
  editor.moveSelectedNode(40);
  assert.equal(editor.getState().nodes[0].trigger.timeSeconds, 40);
  assert.equal(editor.getState().nodes[0].trigger.captionId, 'caption-3');
  editor.deleteSelectedNode();

  assert.equal(editor.getState().nodes.length, 0);
  assert.deepEqual(changes.map((change) => change.meta.action), [
    'node.move',
    'node.delete'
  ]);
});

test('unknown drop data is rejected without changing nodes', () => {
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: []
  });

  assert.equal(editor.handleDrop('unknown', { left: 0, width: 100, clientX: 20 }), false);
  assert.equal(editor.getState().nodes.length, 0);
});

test('loaded nodes are rebound to the nearest current caption', () => {
  const node = registry.createNode('attention', {
    timeSeconds: 40,
    captionId: 'caption-stale',
    idFactory: () => 'node-rebound'
  });
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: [node]
  });

  editor.setNodes([node]);

  assert.equal(editor.getState().nodes[0].trigger.captionId, 'caption-3');
});

test('loaded nodes keep their saved timing and caption reference without subtitles', () => {
  const node = registry.createNode('attention', {
    timeSeconds: 173,
    captionId: 'caption-saved',
    idFactory: () => 'node-saved'
  });
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions: [],
    nodes: []
  });

  editor.setNodes([node]);

  assert.equal(editor.getState().durationSeconds, 180);
  assert.equal(editor.getState().nodes[0].trigger.timeSeconds, 173);
  assert.equal(editor.getState().nodes[0].trigger.captionId, 'caption-saved');
});

test('keyboard placement moves a time cursor and creates the armed node', () => {
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions: [],
    nodes: [],
    minimumDurationSeconds: 222,
    idFactory: () => 'node-keyboard'
  });

  editor.armPlugin('attention');
  assert.equal(editor.handleTimelineKeydown('End'), true);
  assert.equal(editor.getState().keyboardTimeSeconds, 222);
  assert.equal(editor.handleTimelineKeydown('ArrowLeft'), true);
  assert.ok(editor.getState().keyboardTimeSeconds < 222);
  assert.equal(editor.handleTimelineKeydown('Enter'), true);
  assert.equal(editor.getState().dialog.source, 'keyboard');
  assert.equal(editor.getState().dialog.draft.trigger.timeSeconds, editor.getState().keyboardTimeSeconds);
});

test('zoom is bounded and exposed as editor state', () => {
  const editor = createEditor({
    document: null,
    registry,
    timeline,
    captions,
    nodes: []
  });

  editor.setZoom(2);
  assert.equal(editor.getState().zoom, 1.5);
  editor.adjustZoom(-2);
  assert.equal(editor.getState().zoom, 0.75);
});

test('closing the dialog restores focus to the element that opened it', () => {
  let focusCount = 0;
  const opener = { focus: () => { focusCount += 1; } };
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener() {}
  };
  const editor = createEditor({
    document: {
      activeElement: opener,
      addEventListener() {},
      removeEventListener() {}
    },
    registry,
    timeline,
    captions,
    nodes: [],
    idFactory: () => 'node-focus',
    elements: {
      '#node-editor-dialog': dialog
    }
  });

  editor.createAtTime('attention', 10, 'click');
  editor.saveDialog();

  assert.equal(focusCount, 1);
});
