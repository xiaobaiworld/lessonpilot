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
  assert.equal(EXAMPLE_COURSE_PACKAGE.lessons[0].nodes.length, 5);
  assert.equal(contract.validateCoursePackage(EXAMPLE_COURSE_PACKAGE).ok, true);
});
