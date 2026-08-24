const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../src/shared/course-package-contract.js');
const {
  EXAMPLE_COURSE_ID,
  EXAMPLE_COURSE_PACKAGE
} = require('../src/content/config/example-course.js');

test('bundled example is a valid read-only course package with stable UUID identity', () => {
  assert.equal(EXAMPLE_COURSE_ID, '1dfaf2f0-f826-46e8-afdb-89e2d0468a22');
  assert.equal(EXAMPLE_COURSE_PACKAGE.courseId, EXAMPLE_COURSE_ID);
  assert.equal(EXAMPLE_COURSE_PACKAGE.title, '英语面试表达：把答案说得具体');
  assert.equal(EXAMPLE_COURSE_PACKAGE.lessons.length, 1);
  assert.equal(
    EXAMPLE_COURSE_PACKAGE.lessons[0].lessonId,
    'a9a6f97e-475f-47e0-8412-993cc0f14ad8'
  );
  assert.equal(EXAMPLE_COURSE_PACKAGE.lessons[0].videoRef.videoId, 'BV1WW4y1e7GL');
  const nodes = EXAMPLE_COURSE_PACKAGE.lessons[0].nodes;
  assert.equal(nodes.length, 6);
  assert.deepEqual(
    nodes.slice(0, 2).map((node) => [node.trigger.timeSeconds, node.interaction]),
    [[2, 'notice'], [35, 'notice']]
  );
  assert.equal(nodes[0].display.title, '重点提示');
  assert.doesNotMatch(nodes[0].display.title, /00:02/);
  assert.match(nodes[0].display.body, /第一个节点/);
  assert.match(nodes[0].display.body, /第二个节点/);
  assert.match(nodes[0].display.body, /4 道题/);
  assert.match(nodes[0].display.body, /总结/);
  assert.match(nodes[0].display.body, /加油/);
  assert.equal(contract.validateCoursePackage(EXAMPLE_COURSE_PACKAGE).ok, true);
});
