const assert = require('node:assert/strict');
const test = require('node:test');

const timeline = require('../teacher-web/timeline-model.js');

const captions = [
  { id: 'caption-1', startSeconds: 0, endSeconds: 18, time: '00:00', text: 'one' },
  { id: 'caption-2', startSeconds: 18, endSeconds: 35, time: '00:18', text: 'two' },
  { id: 'caption-3', startSeconds: 35, endSeconds: 51, time: '00:35', text: 'three' }
];

test('derives a stable duration from subtitle end times', () => {
  assert.equal(timeline.durationFromCaptions(captions), 51);
  assert.equal(timeline.durationFromCaptions([{ startSeconds: 4 }]), 4);
  assert.equal(timeline.durationFromCaptions([]), 1);
});

test('derives a usable duration from saved nodes when subtitles are unavailable', () => {
  assert.equal(timeline.durationFromContent([], []), 60);
  assert.equal(timeline.durationFromContent([], [
    { id: 'node-a', trigger: { timeSeconds: 173 } }
  ]), 180);
  assert.equal(timeline.durationFromContent([], [], 222), 222);
  assert.equal(timeline.durationFromContent([], [
    { id: 'node-a', trigger: { timeSeconds: 173 } }
  ], 222), 222);
  assert.equal(timeline.durationFromContent(captions, [
    { id: 'node-a', trigger: { timeSeconds: 173 } }
  ]), 173);
});

test('converts timeline coordinates to bounded seconds and percentages', () => {
  assert.equal(timeline.secondsFromClientX({ left: 100, width: 500, clientX: 350, durationSeconds: 60 }), 30);
  assert.equal(timeline.secondsFromClientX({ left: 100, width: 500, clientX: 0, durationSeconds: 60 }), 0);
  assert.equal(timeline.secondsFromClientX({ left: 100, width: 500, clientX: 900, durationSeconds: 60 }), 60);
  assert.equal(timeline.percentFromSeconds(30, 60), 50);
});

test('finds the caption containing or nearest to a placement time', () => {
  assert.equal(timeline.nearestCaption(captions, 37).id, 'caption-3');
  assert.equal(timeline.nearestCaption(captions, 17).id, 'caption-1');
  assert.equal(timeline.nearestCaption(captions, 80).id, 'caption-3');
  assert.equal(timeline.nearestCaption([], 80), null);
});

test('sorts nodes by time and ID without mutating the input', () => {
  const nodes = [
    { id: 'b', trigger: { timeSeconds: 2 } },
    { id: 'a', trigger: { timeSeconds: 1 } },
    { id: 'c', trigger: { timeSeconds: 2 } }
  ];
  assert.deepEqual(timeline.sortNodes(nodes).map((node) => node.id), ['a', 'b', 'c']);
  assert.deepEqual(nodes.map((node) => node.id), ['b', 'a', 'c']);
});

test('assigns separate visual lanes to nodes that are too close', () => {
  const nodes = [
    { id: 'a', trigger: { timeSeconds: 10 } },
    { id: 'b', trigger: { timeSeconds: 11 } },
    { id: 'c', trigger: { timeSeconds: 12 } }
  ];
  const placed = timeline.assignLanes(nodes, { durationSeconds: 60, minGapPercent: 4 });
  assert.deepEqual(placed.map((node) => node.lane), [0, 1, 2]);
});

test('moves one node and updates its nearest caption while preserving other fields', () => {
  const nodes = [
    {
      id: 'node-a',
      enabled: true,
      interaction: 'notice',
      trigger: { kind: 'time_cross', timeSeconds: 10, captionId: 'caption-1' },
      display: { title: 'keep' }
    },
    {
      id: 'node-b',
      enabled: true,
      interaction: 'blank',
      trigger: { kind: 'time_cross', timeSeconds: 30, captionId: 'caption-2' },
      display: { title: 'other' }
    }
  ];
  const moved = timeline.moveNode(nodes, 'node-a', {
    timeSeconds: 40,
    captions,
    captionId: 'caption-3'
  });

  assert.equal(moved[1].id, 'node-a');
  assert.equal(moved[1].trigger.timeSeconds, 40);
  assert.equal(moved[1].trigger.captionId, 'caption-3');
  assert.equal(moved[1].display.title, 'keep');
  assert.equal(nodes[0].trigger.timeSeconds, 10);
});
